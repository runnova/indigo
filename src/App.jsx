import {
  Show,
  createEffect,
  onMount,
  createMemo,
  createSignal,
  on,
  batch,
} from "solid-js";

import Tooltip from "./components/utility/tooltip/Tooltip.jsx";

import {
  HiOutlineHashtag,
  HiOutlineUsers,
  HiOutlineMapPin,
  HiOutlineMagnifyingGlass,
  HiOutlineInbox,
  HiOutlineUserCircle,
  HiOutlineArrowLeft,
  HiOutlineBars3,
} from "solid-icons/hi";

const appIcon = `${import.meta.env.BASE_URL}icon.svg`;

import MemberPopout from "./components/rightSidebar/memberList/MemberPopout.jsx";
import {
  cacheKey,
  preload,
  applyEventToCache,
  invalidateServer,
  PAGE_SIZE,
} from "./components/channelCache.js";
import ServerBar from "./components/serverSidebar/ServerBar.jsx";
import UserDisplay from "./components/serverSidebar/UserDisplay.jsx";
import ServerSidebar from "./components/serverSidebar/ServerSidebar.jsx";
import MessageComposer from "./components/compose/MessageComposer.jsx";

import { VirtualMessageList } from "./scrolling";
import { ForumView } from "./components/forumView/ForumView";

import RightSidebar from "./components/rightSidebar/RightSidebar.jsx";
import {
  useServerConnection,
  ensureConnected,
  connections,
  applyIdlePolicy,
} from "./core/server_connection.jsx";
import MediaPreview from "./components/MediaPreview";
import useAppInitialization from "./core/useAppInitialization.js";

import { Rotur } from "rotur-sdk";
import "./themeManager";
import { addTheme } from "./themeManager";
addTheme(`${import.meta.env.BASE_URL}themes/fun.css`);

import "https://embed.rotur.dev/embed.js";
import { VoiceChannelView } from "./components/voiceChannel/VoiceChannelView.jsx";
import { bindVoiceEvents } from "./core/voiceClient.js";

import ContextMenu from "./components/Contextmenu.jsx";

import "./core/ContextMenuDefs.jsx";
import "./core/Hotkeys.jsx";

import Spotlight from "./components/spotlight/Spotlight.jsx";
import { updateClockOffset } from "./core/useMessageSigning.js";
import ServerJoinDialog from "./components/dialogs/ServerJoinDialog.jsx";

import {
  state,
  setState,
  tempState,
  unreads,
  setUnreads,
  preview,
  setPreview,
  loaded,
  setLoaded,
  getServerUnreadTotal,
  getServerPingTotal,
  previewServer,
  serverBarWidth,
  setServerBarWidth,
  firstBarWidth,
  setFirstBarWidth,
  thirdBarWidth,
  setThirdBarWidth,
  socketReady,
  setSocketReady,
  presenceStore,
  setPresenceStore,
  applyRoomState,
  applyStatusUpdate,
  conn,
  setConn,
  openMessageLink,
  clearJoinUrl,
  switchToChannel,
  thirdBarCollapsed,
  setThirdBarCollapsed,
  urlDeepLinkActive,
  setUrlDeepLinkActive,
  pendingServerJoin,
  setPendingServerJoin,
  logout,
  emojiPicker,
  setEmojiPicker,
} from "./state.js";

export {
  state,
  setState,
  tempState,
  unreads,
  setUnreads,
  preview,
  setPreview,
  loaded,
  setLoaded,
  getServerUnreadTotal,
  getServerPingTotal,
  previewServer,
  serverBarWidth,
  setServerBarWidth,
  firstBarWidth,
  setFirstBarWidth,
  thirdBarWidth,
  setThirdBarWidth,
  socketReady,
  setSocketReady,
  presenceStore,
  setPresenceStore,
  applyRoomState,
  applyStatusUpdate,
  conn,
  openMessageLink,
  clearJoinUrl,
  switchToChannel,
  thirdBarCollapsed,
  setThirdBarCollapsed,
  urlDeepLinkActive,
  setUrlDeepLinkActive,
  pendingServerJoin,
  setPendingServerJoin,
  logout,
  emojiPicker,
  setEmojiPicker,
};

function preloadChannelMessages(channelName) {
  const src = state.current.server?.src;
  return preload(cacheKey(src, channelName), () =>
    conn.send({ cmd: "messages_get", channel: channelName, limit: PAGE_SIZE }),
  );
}

function App() {
  const activeConn = useServerConnection();
  setConn(activeConn);

  tempState.conn = activeConn;
  bindVoiceEvents(activeConn);

  const [showLoader, setShowLoader] = createSignal(true);

  onMount(async () => {
    const params = new URLSearchParams(window.location.search);
    const serverSrc = params.get("s");
    const channel = params.get("c");
    const thread = params.get("t");

    if (!serverSrc) return;

    const alreadyJoined = state.servers.some((s) => s.src === serverSrc);

    if (alreadyJoined) {
      await switchToChannel(serverSrc, channel || null, thread || undefined);
      return;
    }

    setUrlDeepLinkActive(true);

    try {
      const info = await previewServer(serverSrc);
      setPendingServerJoin({
        src: serverSrc,
        channel: channel || null,
        thread: thread || null,
        info,
      });
    } catch (error) {
      console.error("Failed to preview server:", error);
      setUrlDeepLinkActive(false);
    }
  });

  createEffect(() => {
    const e = conn.lastEvent();
    if (!e?.channel || conn.status() !== "ready") return;
    const src = state.current.server?.src;
    if (!src || e.channel === state.current.channel) return;
    applyEventToCache(cacheKey(src, e.channel), e, {
      messageLogger: state.settings.messageLogger,
    });
  });

  createEffect(
    on(
      () => state.current.server?.src,
      (_src, prevSrc) => invalidateServer(prevSrc),
      { defer: true },
    ),
  );
  createEffect(
    on(
      () => conn.status(),
      (status) => {
        if (status !== "ready") invalidateServer(state.current.server?.src);
      },
      { defer: true },
    ),
  );

  createEffect(() => {
    state.settings.idleConnections;
    state.settings.dmsServer;
    applyIdlePolicy();
  });

  let deepLinkThreadApplied = false;
  createEffect(() => {
    if (deepLinkThreadApplied) return;
    if (conn.status() !== "ready") return;

    const params = new URLSearchParams(window.location.search);
    const t = params.get("t");
    if (!t) {
      deepLinkThreadApplied = true;
      return;
    }

    const channels = conn.channels();
    if (!channels.length) return;

    const parentChannel = channels.find(
      (ch) => ch.name === state.current.channel,
    );
    const thread = parentChannel?.threads?.find((th) => th.id === t);

    if (thread) {
      setState("current", "thread", thread);
      deepLinkThreadApplied = true;
    }
  });

  const [loadingProgress, setLoadingProgress] = createSignal(0);
  const currentChannel = createMemo(() =>
    conn.channels().find((channel) => channel.name === state.current.channel),
  );
  const currentChannelPingCount = createMemo(() => {
    const src = state.current.server?.src;
    const channelName = state.current.channel;
    if (!src || !channelName) return 0;
    return unreads.servers?.[src]?.[channelName]?.ping_count ?? 0;
  });

  createEffect(() => {
    if (urlDeepLinkActive()) return;

    const src = state.current.server?.src;
    const channel = state.current.channel;
    const thread = state.current.thread?.id;

    const params = new URLSearchParams();
    if (src) params.set("s", src);
    if (channel) params.set("c", channel);
    if (thread) params.set("t", thread);

    const query = params.toString();
    const newUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;

    if (
      newUrl !==
      `${window.location.pathname}${window.location.search}${window.location.hash}`
    ) {
      window.history.replaceState(null, "", newUrl);
    }
  });
  useAppInitialization(conn, setState, state, Rotur, setLoadingProgress);
  function getPersistedState() {
    return {
      servers: state.servers,
      serverGroups: state.serverGroups,
      current: state.current,
      serverChannels: state.serverChannels,
      theme: state.theme,
      settings: state.settings,
    };
  }
  createEffect(() => {
    localStorage.setItem("state", JSON.stringify(getPersistedState()));
  });
  createEffect(() => {
    const info = conn.serverInfo();
    const current = state.current.server;

    if (!info || !current?.src) return;

    setState("servers", (s) => s.src === current.src, {
      icon: info.icon,
      name: info.name,
    });
  });
  let restoreTimeout;

  createEffect(() => {
    clearTimeout(restoreTimeout);
    if (conn.status() !== "ready") return;

    if (urlDeepLinkActive()) return;

    const channels = conn.channels();
    if (!channels.length) return;

    const serverSrc = state.current.server?.src;
    if (!serverSrc) return;

    const savedChannel = state.serverChannels[serverSrc];
    if (!savedChannel) return;

    if (
      state.current.channel !== savedChannel &&
      channels.some((c) => c.name === savedChannel)
    ) {
      restoreTimeout = setTimeout(() => {
        setState("current", "channel", savedChannel);
        setState("current", "thread", null);
      }, 500);
    }
  });

  createEffect((prev) => {
    // get unreads
    const ready = conn.status() === "ready";

    if (ready && !prev) {
      conn.send({
        cmd: "unreads_get",
      });
    }

    return ready;
  }, false);

  createEffect(() => {
    // mark as read
    if (conn.status() !== "ready") return;
    const channel = state.current.channel;
    const serverSrc = state.current.server?.src;
    if (!channel || !serverSrc) return;

    const key = `${serverSrc}:${channel}`;
    if (!(key in tempState.preAckUnreadCounts)) {
      tempState.preAckUnreadCounts[key] =
        unreads.servers?.[serverSrc]?.[channel]?.count ?? 0;
    }

    conn.send({ cmd: "unreads_ack", channel });
    setUnreads("servers", serverSrc, channel, { count: 0, ping_count: 0 });
  });
  createEffect(() => {
    console.log("current.server =", state.current.server);
  });

  createEffect(() => {
    if (conn.status() !== "ready") return;

    const channel = state.current.channel;
    const thread = state.current.thread;

    if (!channel || !thread) return;

    tempState.virtMsgList?.openThread?.(thread);
  });

  createEffect(() => {
    // idle servers
    const settings = JSON.parse(localStorage.getItem("settings") || "{}");

    for (const server of state.servers) {
      if (server.src === state.current.server?.src) {
        continue;
      }

      ensureConnected(
        server,
        settings.type === "token"
          ? {
              roturToken: settings.token,
            }
          : {
              crackedUser: {
                username: "guest",
                password: "guest",
              },
            },
      );
    }
  });
  const [fadeOut, setFadeOut] = createSignal(false);
  createEffect(async () => {
    if (loaded.done) {
      setFadeOut(true);
      if (tempState.conn.me())
        tempState.conn.me().friends = (
          await tempState?.rotur.friends.list()
        )?.friends;

      setTimeout(() => {
        setShowLoader(false);
      }, 300);
    }
  });

  createEffect(() => {
    // collect emojis from all connections
    const emojiMap = {};

    for (const [src, connection] of connections.entries()) {
      emojiMap[src] = connection.state.emojis ?? [];
    }

    tempState.serverEmojis = emojiMap;
  });

  function selectServer(server) {
    if (!server.src && server.url) server.src = server.url;
    if (state.current.server?.src === server.src && conn.status() === "ready")
      return;
    setState("current", {
      server,
      channel: null,
      channel_type: "",
    });

    const settings = JSON.parse(localStorage.getItem("settings") || "{}");

    if (settings.type === "token" && settings.token) {
      conn.connect(server, settings.token);
    } else {
      conn.connectCracked(server, {
        username: "guest",
        password: "guest",
      });
    }
  }

  createEffect(() => {
    if (conn.status() !== "ready") return;

    const handshake = conn.serverInfo();
    if (handshake?.server_time) {
      updateClockOffset(handshake.server_time * 1000, Date.now());
    }
  });

  function selectChannel(channelName) {
    batch(() => {
      setState("current", "channel", channelName);
      setState("current", "channel_type", "");
      setState("current", "thread", null);

      const serverSrc = state.current.server?.src;
      if (serverSrc) setState("serverChannels", serverSrc, channelName);
    });
  }
  const currentServerName = () =>
    conn.serverInfo()?.name ?? state.current.server?.name ?? "";

  const statusLabel = () =>
    ({
      idle: "",
      connecting: "Connecting…",
      handshake: "Handshaking…",
      authenticating: "Authenticating…",
      ready: "",
      error: `Error: ${conn?.error()}`,
      closed: "Disconnected",
    })[conn.status()] ?? "";

  return (
    <div class="main x">
      <div
        class="server_bar_wrapper"
        style={{
          width: `${serverBarWidth()}px`,
          "min-width": `${serverBarWidth()}px`,
          "max-width": `${serverBarWidth()}px`,
        }}
      >
        <ServerBar
          servers={state.servers}
          groups={state.serverGroups}
          currentServer={state.current.server}
          unreadTotal={getServerUnreadTotal}
          pingTotal={getServerPingTotal}
          unreads={unreads}
          onSelect={selectServer}
          onReorder={(servers) => setState("servers", servers)}
          onGroupsChange={(groups) => setState("serverGroups", groups)}
        />
      </div>
      <div
        class="resize_handle server_bar_resize"
        onMouseDown={(e) => {
          const start = e.clientX;
          const startWidth = serverBarWidth();

          const move = (ev) => {
            setServerBarWidth(
              Math.max(56, Math.min(180, startWidth + ev.clientX - start)),
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
      <div class="server_content x fill">
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
              serverSrc={state.current.server?.src}
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
                Math.max(180, Math.min(500, startWidth + ev.clientX - start)),
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
          <div
            className="actual_real_servercontent fill y"
            style={{ height: "0" }}
          >
            {/*
            <Show when={state.current?.channel_type === "dms_shop"}>
              <iframe
                src="https://rotur.dev/embed/shop"
                sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms allow-storage-access-by-user-activation"
                allow="storage-access"
                frameborder="0"
                className="fill"
              ></iframe>
              </Show> */}
            <Show when={state.current?.channel_type === "dms_home"}>
              <div class="topbar">
                <div class="channelbar x">
                  <Show
                    when={state.current.channel}
                    fallback={currentServerName()}
                  >
                    <HiOutlineHashtag
                      style={{ transform: "translateY(-1px)" }}
                    />
                    <span>Home</span>
                    <div class="inpgrp x fill">
                      <div class="searchbox fill">
                        <input
                          type="text"
                          class="message_search_input"
                          placeholder="Search friends..."
                        />
                        <HiOutlineMagnifyingGlass />
                      </div>
                    </div>
                  </Show>
                </div>
              </div>
              <div class="x fill server_content_box dmshome">
                <RightSidebar state={state} conn={conn} type="fill" />
              </div>
            </Show>

            <Show when={!state.current?.channel_type.startsWith("dms_")}>
              <div class="topbar">
                <div class="channelbar x">
                  <Show
                    when={state.current.channel}
                    fallback={currentServerName()}
                  >
                    <div className="channel_data fill x">
                      <div className="mobile_only">
                        <HiOutlineArrowLeft
                          onclick={() => {
                            document
                              .querySelector(".server_bar_wrapper")
                              ?.scrollIntoView({
                                behavior: "smooth",
                                block: "start",
                              });
                          }}
                        ></HiOutlineArrowLeft>
                      </div>
                      <HiOutlineHashtag
                        style={{ transform: "translateY(-1px)" }}
                      />{" "}
                      <span>
                        {currentChannel()?.display_name ||
                          currentChannel()?.name}
                      </span>
                      <Show when={currentChannelPingCount() > 0}>
                        <span
                          class="channel_badge channel_badge--ping channelbar_ping_badge"
                          title={`${currentChannelPingCount()} mention(s)`}
                        >
                          @{currentChannelPingCount()}
                        </span>
                      </Show>
                      &bull;
                      <div className="channel_desc">
                        {currentChannel()?.description ||
                          state.current?.thread?.name ||
                          ""}
                      </div>
                      <div className="mobile_only">
                        <HiOutlineBars3
                          onclick={() => {
                            document
                              .querySelector(".third_bar")
                              ?.scrollIntoView({
                                behavior: "smooth",
                                block: "start",
                              });
                          }}
                        ></HiOutlineBars3>
                      </div>
                    </div>
                  </Show>
                  <div class="inpgrp x">
                    <button
                      className={
                        state.thirdBarContext === "selfroles" ? "active" : ""
                      }
                      onClick={() => {
                        if (
                          state.thirdBarContext === "selfroles" &&
                          !thirdBarCollapsed()
                        ) {
                          setThirdBarCollapsed(true);
                        } else {
                          setState("thirdBarContext", "selfroles");
                          setThirdBarCollapsed(false);
                        }
                      }}
                    >
                      <HiOutlineUserCircle />
                    </button>

                    <button
                      className={
                        state.thirdBarContext === "inbox" ? "active" : ""
                      }
                      onClick={() => {
                        if (
                          state.thirdBarContext === "inbox" &&
                          !thirdBarCollapsed()
                        ) {
                          setThirdBarCollapsed(true);
                        } else {
                          setState("thirdBarContext", "inbox");
                          setThirdBarCollapsed(false);
                        }
                      }}
                    >
                      <HiOutlineInbox />
                    </button>

                    <button
                      className={
                        state.thirdBarContext === "pinned" ? "active" : ""
                      }
                      onClick={() => {
                        if (
                          state.thirdBarContext === "pinned" &&
                          !thirdBarCollapsed()
                        ) {
                          setThirdBarCollapsed(true);
                        } else {
                          setState("thirdBarContext", "pinned");
                          setThirdBarCollapsed(false);
                        }
                      }}
                    >
                      <HiOutlineMapPin />
                    </button>

                    <button
                      className={
                        state.thirdBarContext === "members" ? "active" : ""
                      }
                      onClick={() => {
                        if (
                          state.thirdBarContext === "members" &&
                          !thirdBarCollapsed()
                        ) {
                          setThirdBarCollapsed(true);
                        } else {
                          setState("thirdBarContext", "members");
                          setThirdBarCollapsed(false);
                        }
                      }}
                    >
                      <HiOutlineUsers />
                    </button>
                    <div class="searchbox">
                      <input
                        type="text"
                        class="message_search_input"
                        placeholder="Search messages..."
                        onFocus={() => {
                          setState("thirdBarContext", "search");
                          setThirdBarCollapsed(false);
                        }}
                        onKeyDown={(e) => {
                          if (e.key !== "Enter") return;
                          setState("searchQuery", e.currentTarget.value);
                          setState("thirdBarContext", "search");
                          setThirdBarCollapsed(false);
                        }}
                      />
                      <HiOutlineMagnifyingGlass />
                    </div>
                  </div>
                </div>
              </div>
              <div class="x fill server_content_box">
                <div
                  class="interactive_section y fill"
                  id="interactive_section"
                >
                  <Show
                    when={conn.status() === "ready" && state.current.channel}
                    fallback={
                      <div class="empty_state fill y">
                        <Show when={!state.current.server}>
                          <p>Select a server to get started.</p>
                        </Show>
                        <Show
                          when={
                            state.current.server && conn.status() !== "ready"
                          }
                        >
                          <p>{statusLabel() || "Connecting…"}</p>
                        </Show>
                        <Show
                          when={
                            conn.status() === "ready" && !state.current.channel
                          }
                        >
                          <p>Pick a channel from the sidebar.</p>
                        </Show>
                      </div>
                    }
                  >
                    {currentChannel()?.type === "voice" ? (
                      <VoiceChannelView
                        channel={state.current.channel}
                        server={state.current.server}
                        conn={conn}
                      />
                    ) : currentChannel()?.type === "forum" ? (
                      <ForumView
                        channel={state.current.channel}
                        sendRequest={conn.send}
                        wsMessages={conn.lastEvent}
                        onReady={(api) => {
                          tempState.virtMsgList = api;
                        }}
                      />
                    ) : (
                      <>
                        <VirtualMessageList
                          channel={state.current.channel}
                          thread={state.current.thread}
                          sendRequest={conn.send}
                          wsMessages={conn.lastEvent}
                          onReady={(api) => {
                            tempState.virtMsgList = api;
                          }}
                        />

                        <MessageComposer
                          channel={state.current.channel}
                          thread={state.current.thread}
                        />
                      </>
                    )}
                  </Show>
                </div>

                <div
                  class="resize_handle left"
                  onMouseDown={(e) => {
                    const start = e.clientX;
                    const startWidth = thirdBarWidth();

                    const move = (ev) => {
                      setThirdBarWidth(
                        Math.max(
                          220,
                          Math.min(500, startWidth - (ev.clientX - start)),
                        ),
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
                  state={state}
                  conn={conn}
                  type={currentChannel()?.type === "chat" ? "chat" : undefined}
                  username={currentChannel()?.display_name}
                />
              </div>
            </Show>
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
      <Spotlight />
      <Tooltip />
      <ServerJoinDialog
        join={pendingServerJoin()}
        onCancel={() => {
          setPendingServerJoin(null);
          setUrlDeepLinkActive(false);
          clearJoinUrl();
        }}
        onJoin={async () => {
          const join = pendingServerJoin();

          if (!join) return;

          setPendingServerJoin(null);

          await switchToChannel(
            join.src,
            join.channel,
            join.thread || undefined,
          );

          setUrlDeepLinkActive(false);
        }}
      />
      <Show when={showLoader()}>
        <div class={`appLoader ${fadeOut() ? "fade-out" : ""}`}>
          <div class="logoLoader">
            <img src={appIcon} alt="Indigo" class="logo" />

            <div class="loaderProgress">
              <div
                class="loaderProgressFill"
                style={{
                  width: `${loadingProgress()}%`,
                }}
              />
            </div>

            <span class="loaderText">{loadingProgress()}%</span>
          </div>
        </div>
      </Show>
    </div>
  );
}

export default App;

// :3
