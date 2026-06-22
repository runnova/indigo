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
import { state, setState } from "./App"

export const idleConnections = new Map();

function saveToken(token) {
  const settings = JSON.parse(
    localStorage.getItem("settings") || "{}"
  );

  settings.type = "token";
  settings.token = token;

  localStorage.setItem(
    "settings",
    JSON.stringify(settings)
  );
}

export function connectIdle(server, token) {
  const ws = new WebSocket(`wss://${server.src}`);

  ws.onmessage = async (ev) => {
    const packet = JSON.parse(ev.data);

    if (packet.cmd === "handshake") {
      try {
        const authPacket = await authenticate({
          handshake: packet.val,
          roturToken: token,
          crackedUser: null,
        });

        ws.send(JSON.stringify(authPacket));
      } catch (err) {
        ws.close();
      }
    }
  };

  return ws;
}

async function fetchRoturValidator(validatorKey, roturToken) {
  const url = `https://api.rotur.dev/generate_validator?auth=${encodeURIComponent(roturToken)}&key=${encodeURIComponent(validatorKey)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Rotur validator request failed: ${res.status}`);
  const data = await res.json();
  if (!data.validator) throw new Error("Rotur response missing validator field");
  return data.validator;
}

async function requestRoturToken() {
  const styleUrl = "assets/roturstyle.css";

  const css = await fetch(styleUrl).then(r => r.text());
  const dataUri = `data:text/css;charset=utf-8,${encodeURIComponent(css)}`;

  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");

    iframe.id = "rotur-auth";
    iframe.src =
      `https://rotur.dev/auth?system=orion&styles=${encodeURIComponent(dataUri)}`;

    document.body.appendChild(iframe);

    const handler = (event) => {
      if (
        event.origin === "https://rotur.dev" &&
        event.data?.type === "rotur-auth-token"
      ) {
        window.removeEventListener("message", handler);
        iframe.remove();
        resolve(event.data.token);
      }
    };

    window.addEventListener("message", handler);

    iframe.addEventListener("error", () => {
      window.removeEventListener("message", handler);
      iframe.remove();
      reject(new Error("Rotur auth failed"));
    });
  });
}

export async function authenticate({
  handshake,
  roturToken,
  crackedUser,
  onToken,
}) {
  const authMode = handshake.auth_mode ?? "rotur";

  if (
    authMode === "cracked-only" ||
    (authMode === "cracked" && crackedUser)
  ) {
    if (!crackedUser) {
      throw new Error(
        "Server requires cracked auth but no credentials provided"
      );
    }

    return {
      cmd: "login",
      username: crackedUser.username,
      password: crackedUser.password,
    };
  }

  let token = roturToken;

  if (!token) {
    token = await requestRoturToken();

    if (onToken) {
      onToken(token);
    }
  }

  const validator = await fetchRoturValidator(
    handshake.validator_key,
    token
  );

  return {
    cmd: "auth",
    validator,
  };
}

export function useServerConnection() {
  let ws = null;

  const [status, setStatus] = createSignal("idle");
  const [serverInfo, setServerInfo] = createSignal(null);
  const [me, setMe] = createSignal(null);
  const [channels, setChannels] = createSignal([]);
  const [roles, setRoles] = createSignal([]);
  const [emojis, setEmojis] = createSignal([]);
  const [members, setMembers] = createSignal([]);
  const [membersOnline, setMembersOnline] = createSignal([]);
  const [lastEvent, setLastEvent] = createSignal(null);
  const [error, setError] = createSignal(null);

  let _roturToken = null;
  let _crackedUser = null;
  let _currentSrc = null;

  function loadServerData() {
    send({ cmd: "channels_get" });
    send({ cmd: "users_list" });
    send({ cmd: "users_online" });
    send({ cmd: "roles_list" });
    send({ cmd: "emoji_list" });
  }


  function emit(packet) {
    setLastEvent({ ...packet, _ts: Date.now() });
  }

  function handlePacket(packet, socket) {
    emit(packet);

    switch (packet.cmd) {
      case "handshake": {
        const val = packet.val ?? {};

        const info = {
          src: _currentSrc,
          name: val.server?.name ?? _currentSrc,
          icon: val.server?.icon ?? null,
          banner: val.server?.banner ?? null,
        };

        if (!state.servers.some(s => s.src === info.src)) {
          setState("servers", servers => [...servers, info]);
        }

        setServerInfo({
          ...info,
          limits: val.limits ?? {},
          auth_mode: val.auth_mode ?? "rotur",
          validator_key: val.validator_key ?? null,
          capabilities: val.capabilities ?? [],
        });

        setStatus("authenticating");

        authenticate({
          handshake: val,
          roturToken: _roturToken,
          crackedUser: _crackedUser,
          onToken(token) {
            _roturToken = token;
            saveToken(token);
          },
        })
          .then(send)
          .catch(err => {
            setError(err.message);
            setStatus("error");
            ws?.close();
          });

        break;
      }

      case "auth_success":
        break;

      case "auth_error":
        setError(packet.val ?? "Authentication failed");
        setStatus("error");
        ws?.close();
        break;

      case "ready":
        setMe(packet.user ?? null);
        setStatus("ready");
        loadServerData();
        break;

      case "channels_get":
        setChannels(packet.val ?? []);
        break;

      case "roles_list":
        setRoles(packet.val ?? []);
        break;

      case "emoji_list":
        setEmojis(packet.emojis ?? []);
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
    setEmojis([]);
    setMembers([]);
    setMembersOnline([]);

    const url = `wss://${src}`;
    const socket = new WebSocket(url);

    ws = socket;

    socket.onopen = () => setStatus("handshake");

    socket.onmessage = (ev) => {
      try {
        const packet = JSON.parse(ev.data);
        handlePacket(packet, socket);
      } catch (e) {
        console.error("[ws] parse error:", e);
      }
    };

    socket.onerror = () => {
      if (ws !== socket) return;

      setError("WebSocket error");
      setStatus("error");
    };

    socket.onclose = () => {
      if (ws !== socket) return;

      if (
        status() === "ready" ||
        status() === "handshake" ||
        status() === "authenticating"
      ) {
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
    setMe,
    channels,
    roles,
    emojis,
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