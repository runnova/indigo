/**
 * useServerConnection.js
 *
 * Manages a single WebSocket connection to one OriginChats server.
 * Handles the full protocol lifecycle:
 *   connect → handshake → auth (Rotur or cracked) → ready → dispatch events
 *
 * Usage:
 *   const conn = useServerConnection();
 *   conn.connect(server);          // server = { src, name, icon }
 *   conn.send({ cmd: "..." });     // only after status() === "ready"
 *   conn.disconnect();
 *
 * Signals exposed:
 *   conn.status()     — "idle" | "connecting" | "handshake" | "authenticating" | "ready" | "error" | "closed"
 *   conn.serverInfo() — { name, icon, banner, limits, auth_mode, validator_key } from handshake
 *   conn.me()         — user object from "ready" packet
 *   conn.channels()   — array from "channels_get" response, kept live
 *   conn.lastEvent()  — the most recent raw parsed packet (for VirtualMessageList etc.)
 *   conn.error()      — human-readable error string, or null
 */

import { createSignal } from "solid-js";

// ─── Rotur auth helpers ───────────────────────────────────────────────────────

/**
 * Exchange a Rotur auth token for a short-lived validator.
 * The token should have been obtained from https://rotur.dev/auth?return_to=…
 */
async function fetchRoturValidator(validatorKey, roturToken) {
  const url = `https://api.rotur.dev/generate_validator?auth=${encodeURIComponent(roturToken)}&key=${encodeURIComponent(validatorKey)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Rotur validator request failed: ${res.status}`);
  const data = await res.json();
  if (!data.validator) throw new Error("Rotur response missing validator field");
  return data.validator;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useServerConnection() {
  let ws = null;

  const [status, setStatus] = createSignal("idle");
  const [serverInfo, setServerInfo] = createSignal(null);
  const [me, setMe] = createSignal(null);
  const [channels, setChannels] = createSignal([]);
  const [lastEvent, setLastEvent] = createSignal(null);
  const [error, setError] = createSignal(null);

  // Credentials — set before calling connect(), or provided via connectCracked()
  let _roturToken = null;   // for Rotur flow
  let _crackedUser = null;  // { username, password } for cracked flow
  let _currentSrc = null;

  // ── Internal helpers ────────────────────────────────────────────────────────

  function emit(packet) {
    // Always expose the raw event so consumers (VirtualMessageList etc.) can react
    setLastEvent({ ...packet, _ts: Date.now() });
  }

  function handlePacket(packet) {
    emit(packet);

    switch (packet.cmd) {

      // ── Handshake ──────────────────────────────────────────────────────────
      case "handshake": {
        const val = packet.val ?? {};
        setServerInfo({
          name:          val.server?.name   ?? _currentSrc,
          icon:          val.server?.icon   ?? null,
          banner:        val.server?.banner ?? null,
          limits:        val.limits         ?? {},
          auth_mode:     val.auth_mode      ?? "rotur",
          validator_key: val.validator_key  ?? null,
          capabilities:  val.capabilities  ?? [],
        });
        setStatus("authenticating");
        _doAuth(val);
        break;
      }

      // ── Auth results ───────────────────────────────────────────────────────
      case "auth_success":
        // Wait for "ready" — nothing to do yet
        break;

      case "auth_error":
        setError(packet.val ?? "Authentication failed");
        setStatus("error");
        ws?.close();
        break;

      // ── Ready ──────────────────────────────────────────────────────────────
      case "ready": {
        setMe(packet.user ?? null);
        setStatus("ready");
        // Immediately fetch channels
        send({ cmd: "channels_get" });
        break;
      }

      // ── Channels ───────────────────────────────────────────────────────────
      case "channels_get":
        setChannels(packet.val ?? []);
        break;

      // ── Server errors / rate limits ────────────────────────────────────────
      case "error":
        console.warn("[ws] server error:", packet.val, packet.src ?? "");
        break;

      case "rate_limit":
        console.warn("[ws] rate limited for", packet.length, "ms");
        break;

      // ── Everything else is forwarded via lastEvent() to subscribers ────────
      default:
        break;
    }
  }

  async function _doAuth(handshakeVal) {
    const authMode = handshakeVal.auth_mode ?? "rotur";

    // Cracked auth ──────────────────────────────────────────────────────────
    if (authMode === "cracked-only" || (authMode === "cracked" && _crackedUser)) {
      if (!_crackedUser) {
        setError("Server requires cracked auth but no credentials provided");
        setStatus("error");
        return;
      }
      // Try login first; if user doesn't exist and registration is open the
      // server will respond with auth_error — caller can retry with register.
      send({ cmd: "login", username: _crackedUser.username, password: _crackedUser.password });
      return;
    }

    // Rotur auth ────────────────────────────────────────────────────────────
    if (!_roturToken) {
      setError("No Rotur token available for authentication");
      setStatus("error");
      return;
    }
    try {
      const validator = await fetchRoturValidator(handshakeVal.validator_key, _roturToken);
      send({ cmd: "auth", validator });
    } catch (err) {
      setError(err.message);
      setStatus("error");
      ws?.close();
    }
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Connect to a server using Rotur authentication.
   * @param {{ src: string, name?: string, icon?: string }} server
   * @param {string} roturToken  — token from Rotur OAuth redirect
   */
  function connect(server, roturToken) {
    disconnect();

    _currentSrc  = server.src;
    _roturToken  = roturToken ?? null;
    _crackedUser = null;

    _open(server.src);
  }

  /**
   * Connect using cracked (username + password) auth.
   * @param {{ src: string }} server
   * @param {{ username: string, password: string }} credentials
   */
  function connectCracked(server, credentials) {
    disconnect();

    _currentSrc  = server.src;
    _roturToken  = null;
    _crackedUser = credentials;

    _open(server.src);
  }

  /**
   * Register a new cracked account and authenticate.
   * Call this only after connectCracked() has opened the socket and the
   * server replied auth_error (e.g. "user not found").
   */
  function register(username, password) {
    _crackedUser = { username, password };
    send({ cmd: "register", username, password });
  }

  function _open(src) {
    setStatus("connecting");
    setError(null);
    setServerInfo(null);
    setMe(null);
    setChannels([]);

    const url = `wss://${src}`;
    ws = new WebSocket(url);

    ws.onopen = () => setStatus("handshake");

    ws.onmessage = (ev) => {
      try {
        const packet = JSON.parse(ev.data);
        handlePacket(packet);
      } catch (e) {
        console.error("[ws] parse error", e);
      }
    };

    ws.onerror = (ev) => {
      setError("WebSocket error");
      setStatus("error");
    };

    ws.onclose = (ev) => {
      if (status() === "ready" || status() === "handshake" || status() === "authenticating") {
        setStatus("closed");
      }
      ws = null;
    };
  }

  function send(payload) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn("[ws] send attempted while not open", payload);
      return;
    }
    ws.send(JSON.stringify(payload));
  }

  function disconnect() {
    ws?.close();
    ws = null;
    setStatus("idle");
  }

  return {
    // State signals
    status,
    serverInfo,
    me,
    channels,
    lastEvent,
    error,

    // Actions
    connect,
    connectCracked,
    register,
    send,
    disconnect,
  };
}