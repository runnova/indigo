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
async function fetchRoturValidator(validatorKey, roturToken) {
  const url = `https://api.rotur.dev/generate_validator?auth=${encodeURIComponent(roturToken)}&key=${encodeURIComponent(validatorKey)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Rotur validator request failed: ${res.status}`);
  const data = await res.json();
  if (!data.validator) throw new Error("Rotur response missing validator field");
  return data.validator;
}

export function useServerConnection() {
  let ws = null;

  const [status, setStatus] = createSignal("idle");
  const [serverInfo, setServerInfo] = createSignal(null);
  const [me, setMe] = createSignal(null);
  const [channels, setChannels] = createSignal([]);
  const [roles, setRoles] = createSignal([]);
  const [members, setMembers] = createSignal([]);
  const [membersOnline, setMembersOnline] = createSignal([]);
  const [lastEvent, setLastEvent] = createSignal(null);
  const [error, setError] = createSignal(null);

  let _roturToken = null;
  let _crackedUser = null;
  let _currentSrc = null;

  function emit(packet) {
    setLastEvent({ ...packet, _ts: Date.now() });
  }

  function handlePacket(packet) {
    emit(packet);

    switch (packet.cmd) {
      case "handshake": {
        const val = packet.val ?? {};
        setServerInfo({
          name: val.server?.name ?? _currentSrc,
          icon: val.server?.icon ?? null,
          banner: val.server?.banner ?? null,
          limits: val.limits ?? {},
          auth_mode: val.auth_mode ?? "rotur",
          validator_key: val.validator_key ?? null,
          capabilities: val.capabilities ?? [],
        });
        setStatus("authenticating");
        _doAuth(val);
        break;
      }

      case "auth_success":
        break;

      case "auth_error":
        setError(packet.val ?? "Authentication failed");
        setStatus("error");
        ws?.close();
        break;

      case "ready": {
        setMe(packet.user ?? null);
        setStatus("ready");
        send({ cmd: "channels_get" });
        send({ cmd: "users_list" });
        send({ cmd: "users_online" });
        send({ cmd: "roles_list" });
        break;
      }

      case "channels_get":
        setChannels(packet.val ?? []);
        break;

      case "roles_list":
        setRoles(packet.val ?? []);
        break;

      case "users_list":
        setMembers(packet.users ?? []);
        break;

      case "users_online":
        setMembersOnline(packet.users ?? []);
        break;

      case "error":
        console.warn("[ws] server error:", packet.val, packet.src ?? "");
        break;

      case "rate_limit":
        console.warn("[ws] rate limited for", packet.length, "ms");
        break;

      default:
        break;
    }
  }

  async function _doAuth(handshakeVal) {
    const authMode = handshakeVal.auth_mode ?? "rotur";

    if (
      authMode === "cracked-only" ||
      (authMode === "cracked" && _crackedUser)
    ) {
      if (!_crackedUser) {
        setError("Server requires cracked auth but no credentials provided");
        setStatus("error");
        return;
      }

      send({
        cmd: "login",
        username: _crackedUser.username,
        password: _crackedUser.password,
      });

      return;
    }

    try {
      if (_roturToken) {
        const validator = await fetchRoturValidator(
          handshakeVal.validator_key,
          _roturToken
        );

        send({
          cmd: "auth",
          validator,
        });

        return;
      }

      const style_url = "assets/roturstyle.css";

      const css = await fetch(style_url).then(r => r.text());
      const dataUri = `data:text/css;charset=utf-8,${encodeURIComponent(css)}`;

      const e = document.createElement("iframe");
      e.id = "rotur-auth";
      e.src = `https://rotur.dev/auth?system=orion&styles=${encodeURIComponent(dataUri)}`;

      document.body.appendChild(e);

      const _roturAuthHandler = async (a) => {
        if (
          a.origin === "https://rotur.dev" &&
          a.data?.type === "rotur-auth-token"
        ) {
          e.remove();
          window.removeEventListener("message", _roturAuthHandler);

          _roturToken = a.data.token;

          const settings = JSON.parse(
            localStorage.getItem("settings") || "{}"
          );

          settings.type = "token";
          settings.token = _roturToken;

          localStorage.setItem(
            "settings",
            JSON.stringify(settings)
          );

          const validator = await fetchRoturValidator(
            handshakeVal.validator_key,
            _roturToken
          );

          send({
            cmd: "auth",
            validator,
          });
        }
      };

      window.addEventListener("message", _roturAuthHandler);
    } catch (err) {
      setError(err.message);
      setStatus("error");
      ws?.close();
    }
  }

  function connect(server, roturToken) {
    disconnect();

    _currentSrc = server.src;

    const saved = localStorage.getItem("settings");

    try {
      const parsed = saved ? JSON.parse(saved) : null;

      _roturToken =
        roturToken ??
        (parsed?.type === "token" ? parsed.token : null);
    } catch {
      _roturToken = roturToken ?? null;
    }

    _crackedUser = null;

    _open(server.src);
  }
  function connectCracked(server, credentials) {
    disconnect();

    _currentSrc = server.src;
    _roturToken = null;
    _crackedUser = credentials;

    _open(server.src);
  }

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
    setRoles([]);
    setMembers([]);
    setMembersOnline([]);

    const url = `wss://${src}`;
    ws = new WebSocket(url);

    ws.onopen = () => setStatus("handshake");

   ws.onmessage = (ev) => {
  try {
    console.log("WS packet size:", ev.data.length);
    console.log("WS packet start:", ev.data.slice(0, 500));

    const packet = JSON.parse(ev.data);
    handlePacket(packet);
  } catch (e) {
    console.error("[ws] parse error:", e);
    console.error("Raw packet:", ev.data?.slice?.(0, 1000));
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
    status,
    serverInfo,
    me,
    channels,
    roles,
    members,
    membersOnline,
    lastEvent,
    error,

    connect,
    connectCracked,
    register,
    send,
    disconnect,
  };
}