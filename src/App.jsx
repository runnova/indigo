import {
  Show,
  createEffect,
  onMount,
  createMemo, createSignal
} from "solid-js";

import { createStore } from "solid-js/store";

import {
  HiOutlineHashtag,
  HiOutlineUsers,
  HiOutlineMapPin,
  HiOutlineMagnifyingGlass,
  HiOutlineInbox,
  HiOutlineUserCircle
} from "solid-icons/hi";
import appIcon from "/public/icon.svg";

import MemberPopout from "./components/MemberPopout.jsx";

import ServerBar from "./components/ServerBar.jsx";
import ServerSidebar from "./components/ServerSidebar.jsx";
import MessageComposer from "./components/MessageComposer.jsx";

import { VirtualMessageList } from "./scolling";

import RightSidebar from "./components/RightSidebar.jsx";

import {
  useServerConnection,
  ensureConnected,
  connections
} from "./server_connection";

const defaultState = {
  servers: [
    { src: "dms.mistium.com", icon: null, name: "dms" },
    { src: "chats.mistium.com", icon: null, name: "sopher" },
  ],
  current: {
    channel: null,
    server: null,
  },
  serverChannels: {},
  replying: null,
  thirdBarContext: "",
  searchQuery: ""
};
export const [unreads, setUnreads] = createStore({
  servers: {}
});

export const [loaded, setLoaded] = createStore({ done: false });
const [showLoader, setShowLoader] = createSignal(true);
function getServerUnreadTotal(src) {
  const server =
    unreads.servers?.[src];

  if (!server) return 0;

  return Object.entries(server)
    .filter(([key]) => key !== "online")
    .reduce((sum, [, count]) => sum + count, 0);
}

const savedState = JSON.parse(
  localStorage.getItem("state") || "{}"
);

export const [state, setState] = createStore({
  servers: savedState.servers ?? defaultState.servers,
  current: {
    ...defaultState.current,
    ...(savedState.current ?? {})
  },
  serverChannels: {
    ...defaultState.serverChannels,
    ...(savedState.serverChannels ?? {})
  },
  replying: null,
  thirdBarContext: "",
  searchQuery: ""
});

export var tempState = {};
window.tempState = tempState

function App() {
  const conn = useServerConnection();
  const currentChannel = createMemo(() =>
    conn
      .channels()
      .find(channel => channel.name === state.current.channel)
  );
  onMount(() => {
    tempState.conn = conn;

    const server =
      state.current.server ??
      state.servers[0];

    if (!server) return;

    setState("current", "server", server);

    const settings = JSON.parse(
      localStorage.getItem("settings") || "{}"
    );

    if (settings.type === "token" && settings.token) {
      conn.connect(server, settings.token);
    } else {
      conn.connectCracked(server, {
        username: "guest",
        password: "guest"
      });
    }
  });
  function getPersistedState() {
    return {
      servers: state.servers,
      current: state.current,
      serverChannels: state.serverChannels
    };
  }
  createEffect(() => {
    localStorage.setItem(
      "state",
      JSON.stringify(getPersistedState())
    );
  });
  createEffect(() => {
    const info = conn.serverInfo();
    const current = state.current.server;

    if (!info || !current?.src) return;

    setState(
      "servers",
      (s) => s.src === current.src,
      {
        icon: info.icon,
        name: info.name
      }
    );
  });
  createEffect(() => {
    tempState.roles = conn.roles;
    tempState.members = conn.members;
    tempState.membersOnline = conn.membersOnline;
  });
  createEffect(() => {
    if (conn.status() !== "ready") return;

    const serverSrc = state.current.server?.src;
    if (!serverSrc) return;

    const savedChannel =
      state.serverChannels[serverSrc];

    if (!savedChannel) return;

    if (
      conn.channels().some(
        c => c.name === savedChannel
      )
    ) {
      setState(
        "current",
        "channel",
        savedChannel
      );
    }
  });

  createEffect((prev) => {
    const ready =
      conn.status() === "ready";

    if (ready && !prev) {
      conn.send({
        cmd: "unreads_get"
      });
    }

    return ready;
  }, false);

  createEffect(() => {
    if (conn.status() !== "ready") return;

    const channel = state.current.channel;
    const serverSrc = state.current.server?.src;

    if (!channel || !serverSrc) return;

    if (!unreads.servers[serverSrc]) {
      setUnreads("servers", serverSrc, {});
    }

    conn.send({
      cmd: "unreads_ack",
      channel
    });

    setUnreads(
      "servers",
      serverSrc,
      channel,
      0
    );
  });

  createEffect(() => {
    const settings = JSON.parse(
      localStorage.getItem("settings") || "{}"
    );

    for (const server of state.servers) {
      if (server.src === state.current.server?.src) {
        continue;
      }

      ensureConnected(
        server,
        settings.type === "token"
          ? {
            roturToken: settings.token
          }
          : {
            crackedUser: {
              username: "guest",
              password: "guest"
            }
          }
      );
    }
  });

  function selectServer(server) {
    if (!server.src && server.url) server.src = server.url;
    if (
      state.current.server?.src === server.src &&
      conn.status() === "ready"
    ) return;
    setState("current", {
      server,
      channel: null
    });

    const settings = JSON.parse(localStorage.getItem("settings") || "{}");

    if (settings.type === "token" && settings.token) {
      conn.connect(server, settings.token);
    } else {
      conn.connectCracked(server, {
        username: "guest",
        password: "guest"
      });
    }
  }

  function selectChannel(channelName) {
    setState("current", "channel", channelName);

    const serverSrc = state.current.server?.src;
    if (serverSrc) {
      setState("serverChannels", serverSrc, channelName);
    }
  }

  const currentServerName = () =>
    conn.serverInfo()?.name ?? state.current.server?.name ?? "";

  const statusLabel = () => ({
    idle: "",
    connecting: "Connecting…",
    handshake: "Handshaking…",
    authenticating: "Authenticating…",
    ready: "",
    error: `Error: ${conn.error()}`,
    closed: "Disconnected",
  }[conn.status()] ?? "");
  const getHoistedRole = (user) => {
    const roles = conn.roles?.() ?? {};

    return user.roles?.find(roleId =>
      roles[roleId]?.hoisted
    );
  };

  const onlineUsers = createMemo(
    () => new Set(conn.membersOnline().map((u) => u.username))
  );
  const memberSections = createMemo(() => {
    const online = new Set(
      conn.membersOnline().map(u => u.username)
    );

    const roles = conn.roles?.() ?? {};
    const members = conn.members();

    const sections = [];
    const assigned = new Set();
    const hoistedSections = new Map();

    for (const user of members) {
      if (!online.has(user.username)) continue;

      const roleId = user.roles?.find(
        id => roles[id]?.hoisted
      );

      if (!roleId) continue;

      if (!hoistedSections.has(roleId)) {
        hoistedSections.set(roleId, []);
      }

      hoistedSections.get(roleId).push(user);
      assigned.add(user.username);
    }

    const sortedHoistedSections = [...hoistedSections.entries()]
      .sort(
        ([a], [b]) =>
          (roles[a]?.position ?? 0) -
          (roles[b]?.position ?? 0)
      );

    for (const [roleId, users] of sortedHoistedSections) {
      users.sort((a, b) =>
        a.username.localeCompare(b.username)
      );
      sections.push({
        label: roles[roleId]?.name ?? roleId,
        users,
      });
    }

    const onlineUsers = members.filter(user =>
      online.has(user.username) &&
      !assigned.has(user.username)
    );

    if (onlineUsers.length) {
      sections.push({
        label: "Online",
        users: onlineUsers,
      });
    }

    const offlineUsers = members.filter(user =>
      !online.has(user.username)
    );

    if (offlineUsers.length) {
      sections.push({
        label: "Offline",
        users: offlineUsers,
      });
    }

    return sections;
  });

  const [fadeOut, setFadeOut] = createSignal(false);
  createEffect(() => {
    if (loaded.done) {
      setFadeOut(true);

      setTimeout(() => {
        setShowLoader(false);
      }, 300);
    }
  });
  return (
    <div class="main x">
      <ServerBar
        servers={state.servers}
        currentServer={state.current.server}
        unreadTotal={getServerUnreadTotal}
        unreads={unreads}
        onSelect={selectServer}
      />

      <div class="server_content x fill">
        <Show when={showLoader()}>
          <div class={`appLoader ${fadeOut() ? "fade-out" : ""}`}>
            <div className="logoLoader">
              <img src={appIcon} alt="Indigo" className="logo" />
            </div>
          </div>
        </Show>
        <div class="first_bar bar y">
          <Show when={conn.status() === "ready"}>
            <ServerSidebar
              serverInfo={conn.serverInfo()}
              channels={conn.channels()}
              currentChannel={state.current.channel}
              unreads={unreads}
              onSelectChannel={selectChannel}
            />
          </Show>
          <div className="user_display x">
            <div class="pfpWO">
              <img
                src={`https://avatars.rotur.dev/${conn?.me()?.username}`}
                alt=""
                class="pfp"
                loading="lazy"
              />
              <img
                src={`https://avatars.rotur.dev/.overlay/${conn?.me()?.username}`}
                alt=""
                class="overlay"
                loading="lazy"
              />
            </div>

            <span>{conn?.me()?.username}</span>
          </div>
        </div>

        <div class="fill y">
          <div class="topbar">
            <div class="channelbar x">
              <Show when={state.current.channel} fallback={currentServerName()}>
                <HiOutlineHashtag style={{ "transform": "translateY(-1px)" }} /> <span>{currentChannel()?.display_name || currentChannel()?.name}</span>
                &bull;
                <div className="channel_desc">
                  {currentChannel()?.description}
                </div>
              </Show>
              <div class="inpgrp x">
                <button onClick={() => setState("thirdBarContext", "selfroles")}>
                  <HiOutlineUserCircle />
                </button>
                <button onClick={() => setState("thirdBarContext", "inbox")}>
                  <HiOutlineInbox />
                </button>

                <button onClick={() => setState("thirdBarContext", "pinned")}>
                  <HiOutlineMapPin />
                </button>

                <div class="searchbox">
                  <input
                    type="text"
                    class="message_search_input"
                    placeholder="Search messages..."
                    onFocus={() => setState("thirdBarContext", "search")}

                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;

                      setState("searchQuery", e.currentTarget.value);
                      setState("thirdBarContext", "search");
                    }}
                  />
                  <HiOutlineMagnifyingGlass />
                </div>

                <button onClick={() => setState("thirdBarContext", "members")}>
                  <HiOutlineUsers />
                </button>
              </div>
            </div>
          </div>
          <div class="x fill server_content_box">
            <div class="interactive_section y fill">
              <Show
                when={conn.status() === "ready" && state.current.channel}
                fallback={
                  <div class="empty_state fill y">
                    <Show when={!state.current.server}>
                      <p>Select a server to get started.</p>
                    </Show>
                    <Show when={state.current.server && conn.status() !== "ready"}>
                      <p>{statusLabel() || "Connecting…"}</p>
                    </Show>
                    <Show when={conn.status() === "ready" && !state.current.channel}>
                      <p>Pick a channel from the sidebar.</p>
                    </Show>
                  </div>
                }
              >

                {
                  <VirtualMessageList
                    channel={state.current.channel}
                    sendRequest={conn.send}
                    wsMessages={conn.lastEvent}
                    onReady={(api) => {
                      tempState.virtMsgList = api;
                    }}
                  />
                }

                <MessageComposer
                  channel={state.current.channel}
                  onSend={(content, attachments) =>
                    conn.send({
                      cmd: "message_new",
                      channel: state.current.channel,
                      content,
                      attachments,
                      ...(state.replying && {
                        reply_to: state.replying.id
                      })
                    })
                  }
                />
              </Show>
            </div>

            <RightSidebar
              sections={memberSections()}
              onlineUsers={onlineUsers()}
              roles={conn.roles?.()}
              getHoistedRole={getHoistedRole}
              state={state}
              conn={conn}
            />
          </div>
        </div>
      </div>
      <MemberPopout />
    </div >
  );
}

export default App;