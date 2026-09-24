import { createSignal } from "solid-js";
import { state, setState, unreads, setUnreads, setLoaded } from "../App";
import { createStore } from "solid-js/store";

export const [serverEmojis, setServerEmojis] = createStore({});

export const connections = new Map();

function saveToken(token) {
  const settings = JSON.parse(localStorage.getItem("settings") || "{}");

  settings.type = "token";
  settings.token = token;

  localStorage.setItem("settings", JSON.stringify(settings));
  localStorage.setItem("rotur_embed_token", token);
  location.reload();
}
export async function fetchRoturValidator(validatorKey, roturToken) {
  const url = `https://api.rotur.dev/generate_validator?key=${encodeURIComponent(validatorKey)}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${roturToken}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Rotur validator request failed: ${res.status}`);
  }

  const data = await res.json();

  if (!data.validator) {
    throw new Error("Rotur response missing validator field");
  }

  return data.validator;
}
async function requestRoturToken() {
  await tempState.rotur.login({
    system: "orion",
    timeout: 60_000,
    requires: "full",
  });

  return tempState.rotur.token;
}

export async function authenticate({
  handshake,
  roturToken,
  crackedUser,
  onToken,
}) {
  const authMode = handshake.auth_mode ?? "rotur";

  if (authMode === "cracked-only" || (authMode === "cracked" && crackedUser)) {
    if (!crackedUser) {
      throw new Error(
        "Server requires cracked auth but no credentials provided",
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

  const validator = await fetchRoturValidator(handshake.validator_key, token);

  return {
    cmd: "auth",
    client: state.settings.clientName || "Indigo",
    device: "computer",
    validator,
  };
}
export function reconnectServer(src) {
  const connection = connections.get(src);

  if (!connection) return false;

  if (connection.reconnectTimer) {
    clearTimeout(connection.reconnectTimer);
    connection.reconnectTimer = null;
  }

  connection.reconnectAttempts = 0;
  connection.state.status = "connecting";
  connection.state.error = null;

  syncActive(connection);

  if (
    connection.ws &&
    connection.ws.readyState !== WebSocket.CLOSED &&
    connection.ws.readyState !== WebSocket.CLOSING
  ) {
    connection.ws.close();
  } else {
    openSocket(connection);
  }

  return true;
}

export function ensureConnected(
  server,
  { roturToken = null, crackedUser = null } = {},
) {
  if (connections.has(server.src)) {
    return connections.get(server.src);
  }

  return createConnection(server, roturToken, crackedUser);
}
function openSocket(connection) {
  let ws;

  try {
    ws = new WebSocket(`wss://${connection.src}`);
  } catch {
    return;
  }

  connection.ws = ws;
  if (connection.mode === "active") {
    connection.ui?.setSocket?.(ws);
  }

  ws.onopen = () => {
    connection.reconnectAttempts = 0;
    connection.state.status = "handshake";
  };

  ws.onmessage = (ev) => {
    const packet = JSON.parse(ev.data);

    handlePacket(connection, packet);
  };

  ws.onerror = () => {
    connection.state.error =
      "Failed to connect to " + connection.src + ". It may be down.";

    connection.state.status = "error";

    syncActive(connection);
  };

  ws.onclose = () => {
    handleDisconnect(connection);
  };
}
function handleDisconnect(connection) {
  setUnreads("servers", connection.src, "online", false);

  if (
    connection.state.status === "error" &&
    connection.reconnectAttempts >= connection.maxReconnectAttempts
  ) {
    syncActive(connection);
    return;
  }

  if (
    connection.mode === "active" &&
    connection.reconnectAttempts < connection.maxReconnectAttempts
  ) {
    connection.reconnectAttempts++;

    connection.state.status = "connecting";
    connection.state.error = null;

    syncActive(connection);

    connection.reconnectTimer = setTimeout(() => {
      openSocket(connection);
    }, 2000);

    return;
  }

  if (connection.state.status !== "error") {
    connection.state.status = "closed";
  }

  syncActive(connection);
}
function createConnection(server, roturToken, crackedUser) {
  const connection = {
    src: server.src,
    roturToken,
    crackedUser,
    ws: null,
    mode: "idle",
    pending: [],
    reconnectAttempts: 0,
    maxReconnectAttempts: 2,
    reconnectTimer: null,
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
      loaded: false,
    },
  };

  setUnreads("servers", server.src, (prev) => prev ?? { online: false });
  connections.set(server.src, connection);

  openSocket(connection);

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
        owner: val.server?.owner ?? null,
      };

      if (!state.servers.some((server) => server.src === info.src)) {
        setState("servers", (servers) => [
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
        signing_url: val.signing_url ?? null,
        server_time: val.server_time ?? null,
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
        .then((packet) => {
          connection.ws.send(JSON.stringify(packet));
        })
        .catch((err) => {
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
      connection.state.error = packet.val ?? "Authentication failed";

      connection.state.status = "error";

      syncActive(connection);

      connection.ws?.close();

      break;

    case "ready":
      setUnreads("servers", connection.src, "online", true);
      connection.state.status = "ready";
      connection.state.me = packet.user ?? null;

      while (connection.pending.length) {
        connection.ws.send(JSON.stringify(connection.pending.shift()));
      }

      syncActive(connection);

      if (!connection.state.loaded) {
        connection.state.loaded = true;
        setLoaded({ done: true });

        const echoedCapabilities = [
          "ping",
          "capabilities",
          "config_get",
          "config_update",
          "server_update",
          "server_stats",
          // "server_maintenance",
          // "webhook_create",
          "webhook_get",
          // "webhook_list",
          // "webhook_update",
          // "webhook_delete",
          // "webhook_regenerate",
          "channels_get",
          "channel_get",
          // "channel_create",
          // "channel_update",
          // "channel_move",
          // "channel_delete",
          "message_new",
          "message_signatures_v1",
          "message_get",
          "messages_batch",
          "message_replies",
          "messages_get",
          "messages_around",
          "messages_search",
          "pings_get",
          "message_edit",
          "message_delete",
          "message_pin",
          "message_unpin",
          "messages_pinned",
          "poll_vote",
          "poll_end",
          "poll_get",
          "unreads_get",
          "unreads_ack",
          "unreads_update",
          "threads_get",
          "thread_create",
          "thread_get",
          "thread_delete",
          "thread_update",
          "thread_join",
          "thread_leave",
          "thread_pin",
          "thread_unpin",
          "user_metadata_v1",
          "users_online",
          "users_list",
          "users_banned",
          "user_ban",
          "user_unban",
          "user_kick",
          "user_timeout",
          "user_update",
          "user_leave",
          "status_set",
          "status_get",
          "roles_list",
          "role_create",
          "role_update",
          "role_delete",
          "role_reorder",
          "user_roles_get",
          "user_roles_set",
          "self_role_add",
          "self_role_remove",
          "self_roles_list",
          "self_roles_reorder",
          "reaction_add",
          "reaction_remove",
          "emoji_add",
          "emoji_delete",
          "emoji_list",
          "emoji_get",
          "emoji_update",
          "sticker_add",
          "sticker_delete",
          "sticker_list",
          "sticker_get",
          "sticker_update",
          "attachment_upload",
          "attachment_get",
          "attachment_list",
          "attachment_delete",
          "slash_register",
          "slash_list",
          "slash_call",
          "slash_signatures_v1",
          "slash_response",
          "voice_join",
          "voice_leave",
          "voice_mute",
          "voice_unmute",
          "voice_state",
          "report_create",
          "report_list",
          "report_resolve",
          "modlog_get",
          "modlog_summary",
          "access_mode_set",
          "access_mode_get",
          "whitelist_add",
          "whitelist_remove",
          "whitelist_list",
          "server_password_set",
          "application_submit",
          "application_list",
          "application_review",
          "application_delete",
          "invite_create",
          "invite_list",
          "invite_delete",
          // "plugin_list",
          // "plugin_get",
          // "plugin_install",
          // "plugin_uninstall",
          // "plugin_enable",
          // "plugin_disable",
          // "plugin_reload",
          // "plugin_file_list",
          // "plugin_file_get",
          // "plugin_file_put",
          "typing",
          "message_react_add",
          "message_react_remove",
          "server_side_embeds",
          "auth",
        ];

        connection.ws.send(
          JSON.stringify({
            cmd: "capabilities",
            val: echoedCapabilities,
          }),
        );

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
      setServerEmojis(connection.src, connection.state.emojis);
      syncActive(connection);
      break;

    case "users_list":
      connection.state.members = packet.users ?? [];

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
        channels[name] = {
          count: info.unread_count ?? 0,
          ping_count: info.ping_count ?? 0,
        };
      }

      setUnreads("servers", connection.src, (prev) => ({
        ...prev,
        ...channels,
      }));

      break;
    }

    case "user_connect": {
      const user = packet.user ?? packet.val;
      if (
        user &&
        !connection.state.membersOnline.some(
          (u) => u.username === user.username,
        )
      ) {
        connection.state.membersOnline = [
          ...connection.state.membersOnline,
          user,
        ];
      }
      syncActive(connection);
      break;
    }

    case "user_disconnect": {
      const username =
        packet.username ?? packet.user?.username ?? packet.val?.username;
      connection.state.membersOnline = connection.state.membersOnline.filter(
        (u) => u.username !== username,
      );
      syncActive(connection);
      break;
    }

    case "user_join": {
      const user = packet.user ?? packet.val;
      if (user) connection.state.members = [...connection.state.members, user];
      syncActive(connection);
      break;
    }

    case "user_leave":
    case "user_kick": {
      const username =
        packet.username ?? packet.user?.username ?? packet.val?.username;
      connection.state.members = connection.state.members.filter(
        (u) => u.username !== username,
      );
      connection.state.membersOnline = connection.state.membersOnline.filter(
        (u) => u.username !== username,
      );
      syncActive(connection);
      break;
    }

    case "user_update":
    case "nickname_update":
    case "nickname_remove": {
      const user = packet.user ?? packet.val;
      const username = user?.username ?? packet.username;
      if (username) {
        const merge = (u) => (u.username === username ? { ...u, ...user } : u);
        connection.state.members = connection.state.members.map(merge);
        connection.state.membersOnline =
          connection.state.membersOnline.map(merge);
      }
      syncActive(connection);
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
  let activeConnection = null;

  function attachConnection(connection) {
    connection.ui = {
      setSocket(socket) {
        ws = socket;
      },
      setStatus,
      setServerInfo,
      setMe,
      setChannels,
      setRoles,
      setEmojis,
      setMembers,
      setMembersOnline,
      setError,
      emit: (packet) =>
        setLastEvent({
          ...packet,
          _ts: Date.now(),
        }),
    };
    setStatus(connection.state.status);
    setError(connection.state.error ?? null);

    setServerInfo(connection.state.serverInfo);

    setMe(connection.state.me);

    setChannels(connection.state.channels);

    setRoles(connection.state.roles);

    setEmojis(connection.state.emojis);

    setMembers(connection.state.members);

    setMembersOnline(connection.state.membersOnline);
  }
  function emit(packet) {
    setLastEvent({ ...packet, _ts: Date.now() });
  }

  function connect(server, roturToken) {
    disconnect();

    let connection = connections.get(server.src);

    if (!connection) {
      connection = createConnection(server, roturToken, null);
    }

    connection.mode = "active";
    activeConnection = connection;

    setLastEvent(null);
    attachConnection(connection);

    ws = connection.ws;
  }
  function connectCracked(server, credentials) {
    disconnect();

    let connection = connections.get(server.src);

    if (!connection) {
      connection = createConnection(server, null, credentials);
    }

    connection.mode = "active";

    activeConnection = connection;
    ws = connection.ws;
    attachConnection(connection);
  }

  function register(username, password) {
    send({
      cmd: "register",
      username,
      password,
    });
  }

  function send(payload) {
    const connection = activeConnection;

    if (!connection) return;

    const ws = connection.ws;

    if (ws.readyState !== WebSocket.OPEN || status() !== "ready") {
      connection.pending.push(payload);
      return;
    }

    ws.send(JSON.stringify(payload));
  }

  function disconnect() {
    if (activeConnection) {
      activeConnection.mode = "idle";

      if (activeConnection.reconnectTimer) {
        clearTimeout(activeConnection.reconnectTimer);
        activeConnection.reconnectTimer = null;
      }
    }

    activeConnection = null;
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
