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
import { state, setState, unreads, setUnreads, setLoaded } from "./App"


export const connections = new Map();

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

export async function fetchRoturValidator(validatorKey, roturToken) {
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
export function ensureConnected(
  server,
  {
    roturToken = null,
    crackedUser = null
  } = {}
) {
  if (connections.has(server.src)) {
    return connections.get(server.src);
  }

  return createConnection(
    server,
    roturToken,
    crackedUser
  );
}
function createConnection(server, roturToken, crackedUser) {
  const connection = {
    src: server.src,
    roturToken,
    crackedUser,
    ws: null,
    mode: "idle",
    pending: [],
    state: {
      status: "connecting",
      error: null,
      serverInfo: null,
      me: null,
      channels: [],
      roles: [],
      emojis: [],
      members: [],
      membersOnline: [],
      loaded: false
    }
  };

  if (!unreads.servers?.[server.src]) {
    setUnreads(
      "servers",
      server.src,
      {}
    );
  }

  setUnreads(
    "servers",
    server.src,
    "online",
    false
  );

  const ws = new WebSocket(`wss://${server.src}`);

  connection.ws = ws;

  ws.onopen = () => {
    connection.state.status = "handshake";
  };

  ws.onmessage = ev => {
    const packet = JSON.parse(ev.data);

    handlePacket(
      connection,
      packet,
      roturToken,
      crackedUser
    );
  };

  ws.onclose = () => {
    connection.state.status = "closed";

    setUnreads(
      "servers",
      connection.src,
      "online",
      false
    );
  };

  ws.onerror = () => {
    connection.state.status = "error";

    setUnreads(
      "servers",
      connection.src,
      "online",
      false
    );
  };

  connections.set(server.src, connection);

  return connection;
}
function syncActive(connection) {
  if (connection.mode !== "active") return;

  const ui = connection.ui;

  if (!ui) return;

  ui.setStatus(connection.state.status);
  ui.setServerInfo(connection.state.serverInfo);
  ui.setMe(connection.state.me);
  ui.setChannels(connection.state.channels);
  ui.setRoles(connection.state.roles);
  ui.setEmojis(connection.state.emojis);
  ui.setMembers(connection.state.members);
  ui.setMembersOnline(connection.state.membersOnline);
  ui.setError(connection.state.error ?? null);
}

function handlePacket(connection, packet) {
  if (connection.mode === "active") {
    connection.ui?.emit(packet);
  }

  switch (packet.cmd) {
    case "handshake": {
      const val = packet.val ?? {};

      const info = {
        src: connection.src,
        name: val.server?.name ?? connection.src,
        icon: val.server?.icon ?? null,
        banner: val.server?.banner ?? null,
      };

      if (!state.servers.some(server => server.src === info.src)) {
        setState("servers", servers => [
          ...servers,
          {
            src: info.src,
            name: info.name,
            icon: info.icon,
          },
        ]);
      }

      connection.state.serverInfo = {
        ...info,
        limits: val.limits ?? {},
        auth_mode: val.auth_mode ?? "rotur",
        validator_key: val.validator_key ?? null,
        capabilities: val.capabilities ?? [],
      };

      connection.state.status = "authenticating";

      syncActive(connection);

      authenticate({
        handshake: val,
        roturToken: connection.roturToken,
        crackedUser: connection.crackedUser,
        onToken(token) {
          connection.roturToken = token;
          saveToken(token);
        },
      })
        .then(packet => {
          connection.ws.send(JSON.stringify(packet));
        })
        .catch(err => {
          connection.state.error = err.message;
          connection.state.status = "error";

          syncActive(connection);

          connection.ws?.close();
        });

      break;
    }

    case "auth_success":
      break;

    case "auth_error":
      connection.state.error =
        packet.val ?? "Authentication failed";

      connection.state.status = "error";

      syncActive(connection);

      connection.ws?.close();

      break;

    case "ready":
      setUnreads(
        "servers",
        connection.src,
        "online",
        true
      );
      connection.state.status = "ready";
      connection.state.me = packet.user ?? null;

      while (connection.pending.length) {
        connection.ws.send(
          JSON.stringify(connection.pending.shift())
        );
      }

      syncActive(connection);

      if (!connection.state.loaded) {
        connection.state.loaded = true;
        setLoaded({ done: true })
        connection.ws.send(JSON.stringify({ cmd: "channels_get" }));
        connection.ws.send(JSON.stringify({ cmd: "users_list" }));
        connection.ws.send(JSON.stringify({ cmd: "users_online" }));
        connection.ws.send(JSON.stringify({ cmd: "roles_list" }));
        connection.ws.send(JSON.stringify({ cmd: "emoji_list" }));
      }

      break;
    case "channels_get":
      connection.state.channels = packet.val ?? [];
      syncActive(connection);
      break;

    case "roles_list":
      connection.state.roles = packet.val ?? [];
      syncActive(connection);
      break;

    case "emoji_list":
      connection.state.emojis = packet.emojis ?? [];
      syncActive(connection);
      break;

    case "users_list":
      connection.state.members =
        packet.users ?? [];

      syncActive(connection);
      break;

    case "users_online":
      connection.state.membersOnline = packet.users ?? [];
      syncActive(connection);
      break;

    case "error":
      console.warn("[ws] server error:", packet.val, packet.src ?? "");
      break;

    case "rate_limit":
      console.warn("[ws] rate limited for", packet.length, "ms");
      break;
    case "unreads_get": {
      const channels = {};

      for (const [name, info] of Object.entries(packet.unreads ?? {})) {
        channels[name] = info.unread_count ?? 0;
      }

      setUnreads(
        "servers",
        connection.src,
        prev => ({
          ...prev,
          ...channels
        })
      );

      break;
    }
    default:
      break;
  }
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


  function attachConnection(connection) {
    connection.ui = {
      setStatus,
      setServerInfo,
      setMe,
      setChannels,
      setRoles,
      setEmojis,
      setMembers,
      setMembersOnline,
      setError,
      emit: packet =>
        setLastEvent({
          ...packet,
          _ts: Date.now()
        })
    };
    setStatus(connection.state.status);
    setError(connection.state.error ?? null);

    setServerInfo(
      connection.state.serverInfo
    );

    setMe(
      connection.state.me
    );

    setChannels(
      connection.state.channels
    );

    setRoles(
      connection.state.roles
    );

    setEmojis(
      connection.state.emojis
    );

    setMembers(
      connection.state.members
    );

    setMembersOnline(
      connection.state.membersOnline
    );
  }
  function emit(packet) {
    setLastEvent({ ...packet, _ts: Date.now() });
  }




  function connect(server, roturToken) {
    disconnect();

    let connection =
      connections.get(server.src);

    if (!connection) {
      connection = createConnection(
        server,
        roturToken,
        null
      );
    }

    connection.mode = "active";
    setLastEvent(null);
    attachConnection(connection);

    ws = connection.ws;
  }
  function connectCracked(server, credentials) {
    disconnect();

    let connection = connections.get(server.src);

    if (!connection) {
      connection = createConnection(
        server,
        null,
        credentials
      );
    }

    connection.mode = "active";

    ws = connection.ws;
    attachConnection(connection);

  }

  function register(username, password) {
    send({
      cmd: "register",
      username,
      password
    });
  }

  function send(payload) {
    const connection =
      [...connections.values()]
        .find(c => c.ws === ws);

    if (
      !ws ||
      ws.readyState !== WebSocket.OPEN ||
      status() !== "ready"
    ) {
      connection?.pending.push(payload);
      return;
    }

    ws.send(JSON.stringify(payload));
  }

  function disconnect() {
    if (!ws) return;

    const connection =
      [...connections.values()]
        .find(c => c.ws === ws);

    if (connection) {
      connection.mode = "idle";
    }

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
    ensureConnected,
    register,
    send,
    disconnect,
  };
}