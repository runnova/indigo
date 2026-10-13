import { createSignal, createEffect } from "solid-js";
import { createStore } from "solid-js/store";
import {
  ensureConnected,
  serverEmojis,
} from "./core/server_connection.jsx";
import { updateClockOffset } from "./core/useMessageSigning.js";

export const [emojiPicker, setEmojiPicker] = createStore({
  open: false,
  x: 0,
  y: 0,
  onSelect: null,
});

export const defaultState = {
  servers: [{ src: "dms.mistium.com", icon: null, name: "dms" }],
  serverGroups: [],
  current: {
    channel: null,
    server: null,
    thread: null,
    channel_type: "",
  },
  serverChannels: {},
  replying: null,
  editing: null,
  thirdBarContext: "members",
  searchQuery: "",
  theme: {
    stylesheets: [],
    quickCss: "",
  },
  settings: {
    dmsServer: "dms.mistium.com",
    profileOverlays: true,
    sendTypingStatus: true,
    ownerCrown: false,
    channelPreload: false,
    idleConnections: "keep",
    loadAttachments: "all",
    showNicknames: "nickname",
    blockedMessages: "collapsed",
    messageLogger: false,
    serverBarWidth: 66,
    firstBarWidth: 260,
    thirdBarWidth: 320,
    displayChannelName: true,
    parseMarkdown: true,
    twemoji: true,
    customProfileThemes: true,
    clientName: "Indigo",
    showSendButton: true,
    windowManager: true,
    pingSound: "triangle",
  },
};

export const [unreads, setUnreads] = createStore({
  servers: {},
});

export const [preview, setPreview] = createSignal(null);
export const [loaded, setLoaded] = createStore({ done: false });

export function getServerUnreadTotal(src) {
  const server = unreads.servers?.[src];

  if (!server) return 0;

  return Object.entries(server)
    .filter(([key]) => key !== "online")
    .reduce((sum, [, entry]) => sum + (entry?.count ?? 0), 0);
}

export function getServerPingTotal(src) {
  const server = unreads.servers?.[src];

  if (!server) return 0;

  return Object.entries(server)
    .filter(([key]) => key !== "online")
    .reduce((sum, [, entry]) => sum + (entry?.ping_count ?? 0), 0);
}

export async function previewServer(serverSrc) {
  const res = await fetch(`https://${serverSrc}/info`);

  if (!res.ok) {
    throw new Error(`Failed to load server info (${res.status})`);
  }

  const data = await res.json();

  return {
    src: serverSrc,
    name: data.server?.name ?? serverSrc,
    icon: data.server?.icon || null,
    banner: data.server?.banner || null,
    owner: data.server?.owner ?? null,
    stats: {
      connectedUsers: data.stats?.connected_users ?? 0,
      totalUsers: data.stats?.total_users ?? 0,
      totalChannels: data.stats?.total_channels ?? 0,
      totalRoles: data.stats?.total_roles ?? 0,
    },
  };
}

const savedState = JSON.parse(localStorage.getItem("state") || "{}");

export const [state, setState] = createStore({
  servers: savedState.servers ?? defaultState.servers,
  serverGroups: savedState.serverGroups ?? defaultState.serverGroups,
  current: {
    ...defaultState.current,
    ...(savedState.current ?? {}),
  },
  serverChannels: {
    ...defaultState.serverChannels,
    ...(savedState.serverChannels ?? {}),
  },
  replying: null,
  editing: null,
  thirdBarContext: "members",
  searchQuery: "",
  theme: {
    ...defaultState.theme,
    ...(savedState.theme ?? {}),
  },
  settings: {
    ...defaultState.settings,
    ...(savedState.settings ?? {}),
  },
});

export const [serverBarWidth, setServerBarWidth] = createSignal(
  state.settings.serverBarWidth,
);

export const [firstBarWidth, setFirstBarWidth] = createSignal(
  state.settings.firstBarWidth,
);

export const [thirdBarWidth, setThirdBarWidth] = createSignal(
  state.settings.thirdBarWidth,
);

createEffect(() => {
  setState("settings", "firstBarWidth", firstBarWidth());
});

createEffect(() => {
  setState("settings", "thirdBarWidth", thirdBarWidth());
});

createEffect(() => {
  setState("settings", "serverBarWidth", serverBarWidth());
});

export var tempState = {};
tempState.preAckUnreadCounts = {};

createEffect(() => {
  tempState.serverEmojis = { ...serverEmojis };
});

window.tempState = tempState;
window.state = state;

export const [socketReady, setSocketReady] = createSignal(false);
export const [presenceStore, setPresenceStore] = createStore({});

export function applyRoomState(msg) {
  if (!Array.isArray(msg?.members)) return;
  for (const m of msg.members) {
    setPresenceStore(m.username, (prev) => ({
      ...prev,
      presence: m.presence,
      activities: m.activities ?? [],
      status: m.status,
      data: m.data,
    }));
  }
}

export function applyStatusUpdate(msg) {
  const username = msg.username ?? msg.user_id;
  if (!username) return;
  setPresenceStore(username, (prev) => ({
    ...prev,
    presence: msg.presence,
    activities: msg.activities ?? prev?.activities ?? [],
  }));
}

export var conn;
export function setConn(c) {
  conn = c;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function openMessageLink({ host, channel, threadId, id }) {
  const alreadyThere =
    state.current.server?.src === host &&
    state.current.channel === channel &&
    (state.current.thread?.id ?? null) === (threadId ?? null);

  if (!alreadyThere) {
    await switchToChannel(host, channel, threadId);
    await sleep(300);
  }

  for (let attempt = 0; attempt < 20; attempt++) {
    const list = tempState.virtMsgList;
    if (list?.jumpToMessage) {
      try {
        const result = await list.jumpToMessage(id);
        if (result !== false) return;
      } catch {}
    }
    await sleep(250);
  }
}

export function clearJoinUrl() {
  const params = new URLSearchParams(window.location.search);

  params.delete("s");
  params.delete("c");
  params.delete("t");

  const query = params.toString();

  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`,
  );
}

export async function switchToChannel(server, channel, threadId) {
  const src =
    typeof server === "string" ? server : (server?.src ?? server?.url);
  let normalizedServer = state.servers.find((s) => s.src === src);
  if (!normalizedServer) {
    normalizedServer =
      typeof server === "object" ? { ...server, src } : { src };
    setState("servers", (servers) => [...servers, normalizedServer]);
  }
  const previousServer = state.current.server?.src;
  if (previousServer !== normalizedServer.src || conn?.status() !== "ready") {
    setState("current", {
      server: normalizedServer,
      channel: null,
      thread: null,
    });
    const settings = JSON.parse(localStorage.getItem("settings") || "{}");
    if (settings.type === "token" && settings.token) {
      conn.connect(normalizedServer, settings.token);
    } else {
      conn.connectCracked(normalizedServer, {
        username: "guest",
        password: "guest",
      });
    }
    await new Promise((resolve) => {
      let interval;

      const check = () => {
        if (conn.status() === "ready") {
          clearInterval(interval);
          resolve();
        }
      };

      interval = setInterval(check, 50);
      check();
    });
  } else {
    setState("current", "server", normalizedServer);
  }
  setState("current", "channel", channel);
  if (normalizedServer.src) {
    setState("serverChannels", normalizedServer.src, channel);
  }

  if (threadId) {
    const channels = conn.channels?.() ?? [];
    const parentChannel = channels.find((ch) => ch.name === channel);
    const thread =
      parentChannel?.threads?.find((t) => t.id === threadId) ?? null;
    setState("current", "thread", thread);
  } else {
    setState("current", "thread", null);
  }
}

export const [thirdBarCollapsed, setThirdBarCollapsed] = createSignal(false);
export const [urlDeepLinkActive, setUrlDeepLinkActive] = createSignal(false);
export const [pendingServerJoin, setPendingServerJoin] = createSignal(null);

export function logout() {
  const settings = JSON.parse(localStorage.getItem("settings") || "{}");

  if (settings.type === "token") {
    localStorage.setItem(
      "settings",
      JSON.stringify({
        ...settings,
        token: null,
      }),
    );
  } else {
    localStorage.removeItem("settings");
  }

  tempState.conn?.close?.();
  tempState.rotur?.logout();
  window.location.reload();
}
