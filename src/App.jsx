import {
  Show,
  createEffect,
  onMount,
  createMemo, createSignal, on
} from "solid-js";

import { createStore } from "solid-js/store";

import {
  HiOutlineHashtag,
  HiOutlineUsers,
  HiOutlineMapPin,
  HiOutlineMagnifyingGlass,
  HiOutlineInbox,
  HiOutlineUserCircle,
  HiOutlineArrowTopRightOnSquare,
  HiOutlineTrash,
  HiOutlineArrowPath,
  HiOutlineArrowUturnLeft,
  HiOutlineClipboard,
  HiOutlineChatBubbleLeftRight,
  HiOutlineCommandLine,
  HiOutlineDocumentText,
  HiOutlineChatBubbleBottomCenterText
} from "solid-icons/hi";
const appIcon = `${import.meta.env.BASE_URL}icon.svg`;

import MemberPopout from "./components/rightSidebar/memberList/MemberPopout.jsx";

import ServerBar from "./components/serverSidebar/ServerBar.jsx";
import UserDisplay from "./components/serverSidebar/UserDisplay.jsx";
import ServerSidebar from "./components/serverSidebar/ServerSidebar.jsx";
import MessageComposer from "./components/compose/MessageComposer.jsx";

import { VirtualMessageList, getMessageById, addFakeMessage } from "./scolling";
import { ForumView } from "./components/ForumView";

import RightSidebar from "./components/rightSidebar/RightSidebar.jsx";
import SystemContextMenu from './components/Systemcontextmenu.js';

import {
  useServerConnection,
  ensureConnected,
  connections
} from "./server_connection";
import MediaPreview from "./components/MediaPreview";

import { Rotur } from "rotur-sdk";
import "./themeManager";
import {
  addTheme,
  removeTheme,
  listThemes,
  resetThemes,
  quickCss,
  setQuickCss
} from "./themeManager";
addTheme("/themes/fun.css");

import ContextMenu from './components/Contextmenu.jsx';

const removeServer = (src) => {
  setState("servers", servers =>
    servers.filter(server => server.src !== src)
  );
};

SystemContextMenu.init([
  {
    'data-context': 'server',
    actions: [
      {
        label: 'Open',
        icon: HiOutlineArrowTopRightOnSquare,
        fn: (el) => el.click(),
      },
      {
        label: 'Remove',
        icon: HiOutlineTrash,
        fn: (el) => {
          removeServer(el.dataset.src)
        },
      },
      {
        label: 'Reset cache',
        icon: HiOutlineArrowPath,
        fn: (el) => console.log('reset cache', el),
      },
    ],
  },
  {
    'data-context': 'message',
    actions: [
      {
        label: 'Reply',
        icon: HiOutlineArrowUturnLeft,
        fn: (el) => {
          const msg = getMessageById(el.dataset.id);
          console.log(el.dataset.id, msg)
          setState("replying", {
            id: el.dataset.id,
            user: msg.user,
            content: msg.content,
          });
        },
      },
      {
        label: 'Copy ID',
        icon: HiOutlineClipboard,
        fn: (el) => console.log(el.dataset.id),
      },
      {
        label: 'Message Actions',
        icon: HiOutlineChatBubbleLeftRight,
        actions: [
          {
            label: 'Packet inspect',
            icon: HiOutlineCommandLine,
            fn: (el) => {
              const msg = getMessageById(el.dataset.id);
              console.log(el.dataset.id, msg)
              addFakeMessage({
                user: "Indigo",
                avatar: "/icon_small.svg",
                content: `\`\`\`json
${JSON.stringify(msg, null, 2)}
\`\`\``,
              });
            },
          },
          {
            label: 'Copy text',
            icon: HiOutlineDocumentText,
            fn: (el) => console.log('copy text', el),
          },
          {
            label: 'Quote',
            icon: HiOutlineChatBubbleBottomCenterText,
            fn: (el) => console.log('quote', el),
          },
        ],
      },
    ],
  },
]);


const [firstBarWidth, setFirstBarWidth] = createSignal(260);
export const [thirdBarWidth, setThirdBarWidth] = createSignal(320);


const defaultState = {
  servers: [
    { src: "dms.mistium.com", icon: null, name: "dms" },
    { src: "chats.mistium.com", icon: null, name: "sopher" },
  ],
  current: {
    channel: null,
    server: null,
    thread: null,
  },
  serverChannels: {},
  replying: null,
  thirdBarContext: "members",
  searchQuery: "",
  theme: {
    stylesheets: [],
    quickCss: ""
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
  }
};
export const [unreads, setUnreads] = createStore({
  servers: {}
});
export const [preview, setPreview] = createSignal(null);

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
  thirdBarContext: "members",
  searchQuery: "",
  theme: {
    ...defaultState.theme,
    ...(savedState.theme ?? {})
  },
  settings: {
    ...defaultState.settings,
    ...(savedState.settings ?? {})
  },
});

export var tempState = {};
window.tempState = tempState
window.state = state;

export var conn;

function preloadChannelMessages(channelName) {
  return new Promise((resolve) => {
    let resolved = false;

    const dispose = createEffect(on(conn.lastEvent, (packet) => {
      if (resolved || !packet) return;
      if (packet.cmd === "messages_get" && packet.channel === channelName) {
        resolved = true;
        resolve(packet.messages ?? []);
      }
    }));

    conn.send({ cmd: "messages_get", channel: channelName, limit: 20 });

    setTimeout(() => {
      if (!resolved) resolve([]);
    }, 5000);
  });
}
function App() {
  conn = useServerConnection();
  const currentChannel = createMemo(() =>
    conn
      .channels()
      .find(channel => channel.name === state.current.channel)
  );
  onMount(async () => {
    Object.assign(tempState, {
      conn,
      roles: conn.roles,
      members: conn.members,
      membersOnline: conn.membersOnline
    });

    const server =
      state.current.server ??
      state.servers[0];

    if (!server) return;
    setState("current", "server", server);

    const settings = JSON.parse(
      localStorage.getItem("settings") || "{}"
    );

    if (settings.type === "token" && settings.token) {
      tempState.rotur = new Rotur({ token: settings.token });
      conn.connect(server, settings.token);
    } else {
      conn.connectCracked(server, {
        username: "guest",
        password: "guest"
      });
    }
    const getHostname = (src) => {
      return new URL(
        src.includes("://") ? src : `https://${src}`
      ).hostname;
    };
    await tempState.rotur.connectSocket();

    await tempState.rotur.socket.join(
      state.servers.map(({ src }) => `originChats:${getHostname(src)}`)
    );
  });
  function getPersistedState() {
    return {
      servers: state.servers,
      current: state.current,
      serverChannels: state.serverChannels,
      theme: state.theme,
      settings: state.settings,
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

    const channels = conn.channels();
    if (!channels.length) return;

    const serverSrc = state.current.server?.src;
    if (!serverSrc) return;

    const savedChannel = state.serverChannels[serverSrc];
    if (!savedChannel) return;

    if (
      state.current.channel !== savedChannel &&
      channels.some(c => c.name === savedChannel)
    ) {
      setTimeout(() => {
        setState("current", "channel", savedChannel)
      }, 500);
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
    error: `Error: ${conn?.error()}`,
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
        onReorder={(servers) => setState("servers", servers)}
      />
      <div class="server_content x fill">
        <Show when={showLoader()}>
          <div class={`appLoader ${fadeOut() ? "fade-out" : ""}`}>
            <div className="logoLoader">
              <img src={appIcon} alt="Indigo" className="logo" />
            </div>
          </div>
        </Show>
        <div
          class="first_bar bar y"
          style={{
            width: `${firstBarWidth()}px`,
            "min-width": `${firstBarWidth()}px`,
            "max-width": `${firstBarWidth()}px`,
          }}
        >
          <Show when={conn.status() === "ready"}>
            <ServerSidebar
              serverInfo={conn.serverInfo()}
              channels={conn.channels()}
              currentChannel={state.current.channel}
              unreads={unreads}
              onSelectChannel={selectChannel}
              preloadChannel={preloadChannelMessages}
            />
          </Show>
          <UserDisplay></UserDisplay>
        </div>
        <div
          class="resize_handle"
          onMouseDown={(e) => {
            const start = e.clientX;
            const startWidth = firstBarWidth();

            const move = (ev) => {
              setFirstBarWidth(
                Math.max(180, Math.min(500, startWidth + ev.clientX - start))
              );
            };

            const up = () => {
              window.removeEventListener("mousemove", move);
              window.removeEventListener("mouseup", up);
            };

            window.addEventListener("mousemove", move);
            window.addEventListener("mouseup", up);
          }}
        />
        <div class="fill y">
          <div class="topbar">
            <div class="channelbar x">
              <Show when={state.current.channel} fallback={currentServerName()}>
                <HiOutlineHashtag style={{ "transform": "translateY(-1px)" }} /> <span>{currentChannel()?.display_name || currentChannel()?.name}</span>
                &bull;
                <div className="channel_desc">
                  {currentChannel()?.description || state.current?.thread?.name || ""}
                </div>
              </Show>
              <div class="inpgrp x">
                <button
                  className={state.thirdBarContext === "selfroles" ? "active" : ""}
                  onClick={() => setState("thirdBarContext", "selfroles")}
                >
                  <HiOutlineUserCircle />
                </button>

                <button
                  className={state.thirdBarContext === "inbox" ? "active" : ""}
                  onClick={() => setState("thirdBarContext", "inbox")}
                >
                  <HiOutlineInbox />
                </button>

                <button
                  className={state.thirdBarContext === "pinned" ? "active" : ""}
                  onClick={() => setState("thirdBarContext", "pinned")}
                >
                  <HiOutlineMapPin />
                </button>

                <button
                  className={state.thirdBarContext === "members" ? "active" : ""}
                  onClick={() => setState("thirdBarContext", "members")}
                >
                  <HiOutlineUsers />
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
                  currentChannel()?.type === "forum"
                    ? (
                      <ForumView
                        channel={state.current.channel}
                        sendRequest={conn.send}
                        wsMessages={conn.lastEvent}
                        onReady={(api) => { tempState.virtMsgList = api; }}
                      />
                    )
                    : (
                      <VirtualMessageList
                        channel={state.current.channel}
                        sendRequest={conn.send}
                        wsMessages={conn.lastEvent}
                        onReady={(api) => { tempState.virtMsgList = api; }}
                      />
                    )
                }
                <MessageComposer
                  channel={state.current.channel}
                  onSend={(content, attachments) => {
                    conn.send({
                      cmd: "message_new",
                      channel: state.current.channel,
                      content,
                      attachments,
                      ...(state.replying && {
                        reply_to: state.replying.id
                      })
                    });

                    if (state.replying) {
                      setState("replying", null);
                    }
                  }}
                />
              </Show>
            </div>

            <div
              class="resize_handle left"
              onMouseDown={(e) => {
                const start = e.clientX;
                const startWidth = thirdBarWidth();

                const move = (ev) => {
                  setThirdBarWidth(
                    Math.max(220, Math.min(500, startWidth - (ev.clientX - start)))
                  );
                };

                const up = () => {
                  window.removeEventListener("mousemove", move);
                  window.removeEventListener("mouseup", up);
                };

                window.addEventListener("mousemove", move);
                window.addEventListener("mouseup", up);
              }}
            />
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
      <Show when={preview()}>
        <MediaPreview
          src={preview().src}
          type={preview().type}
          onClose={() => setPreview(null)}
        />
      </Show>
      <ContextMenu />
    </div >
  );
}

export default App;

// :3