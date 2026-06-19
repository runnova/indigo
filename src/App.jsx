import {
  Show,
  createEffect,
  onMount,
  createMemo
} from "solid-js";

import { createStore } from "solid-js/store";

import { useServerConnection } from "./server_connection";
import MemberPopout from "./components/MemberPopout.jsx";

import ServerBar from "./components/ServerBar.jsx";
import ServerSidebar from "./components/ServerSidebar.jsx";
import MemberList from "./components/MemberList.jsx";
import MessageComposer from "./components/MessageComposer.jsx";

import { VirtualMessageList } from "./scolling";

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
};

export const [unreads, setUnreads] = createStore({});

const savedState = JSON.parse(
  localStorage.getItem("state") || "{}"
);

export const [state, setState] = createStore({
  ...defaultState,
  ...savedState,
  serverChannels: {
    ...defaultState.serverChannels,
    ...savedState.serverChannels
  }
});
export var tempState = {};
window.tempState = tempState

function App() {
  const conn = useServerConnection();
  onMount(() => {
    tempState.conn = conn;
    const server = state.current.server;
    if (!server) return;

    const settings = JSON.parse(localStorage.getItem("settings") || "{}");

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
    if (conn.status() !== "ready") return;

    const serverSrc = state.current.server?.src;
    if (!serverSrc) return;

    const savedChannel = state.serverChannels[serverSrc];
    if (!savedChannel) return;

    if (
      conn.channels().some(c => c.name === savedChannel)
    ) {
      setState("current", "channel", savedChannel);
    }
  });

  createEffect(() => {
    if (conn.status() !== "ready") return;

    conn.send({
      cmd: "unreads_get"
    });
  });

  createEffect(() => {
    if (conn.status() !== "ready") return;

    const channel = state.current.channel;
    if (!channel) return;

    conn.send({
      cmd: "unreads_ack",
      channel
    });
  });

  function selectServer(server) {
    if (
      state.current.server?.src === server.src &&
      conn.status() === "ready"
    ) return;

    setState("current", {
      server,
      channel: state.serverChannels[server.src] ?? null
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
        label: "ONLINE",
        users: onlineUsers,
      });
    }

    const offlineUsers = members.filter(user =>
      !online.has(user.username)
    );

    if (offlineUsers.length) {
      sections.push({
        label: "OFFLINE",
        users: offlineUsers,
      });
    }

    return sections;
  });
  // const channelIcons = {
  //   text: HiSolidHashtag,
  //   voice: HiSolidSpeakerWave,
  //   announcement: HiSolidMegaphone,
  //   forum: HiSolidChatBubbleLeftRight,
  // };
  return (
    <div class="main x">

      <ServerBar
        servers={state.servers}
        currentServer={state.current.server}
        onSelect={selectServer}
      />

      <div class="server_content x fill">
        <div class="first_bar bar">
          <Show when={conn.status() === "ready"}>
            <ServerSidebar
              serverInfo={conn.serverInfo()}
              channels={conn.channels()}
              currentChannel={state.current.channel}
              unreads={unreads}
              onSelectChannel={selectChannel}
            />
          </Show>
        </div>

        <div class="fill y">
          <div class="topbar">
            <div class="channelbar">
              <Show when={state.current.channel} fallback={currentServerName()}>
                # {state.current.channel}
              </Show>
            </div>
            <Show when={statusLabel()}>
              <div class="connection_status">{statusLabel()}</div>
            </Show>
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
                  />
                }

                <MessageComposer
                  channel={state.current.channel}
                  onSend={(content) =>
                    conn.send({
                      cmd: "message_new",
                      channel: state.current.channel,
                      content,
                      ...(state.replying && {
                        reply_to: state.replying.id
                      })
                    })
                  }
                />
              </Show>
            </div>

            <div class="third_bar bar">
              <MemberList
                sections={memberSections()}
                onlineUsers={onlineUsers()}
                roles={conn.roles?.()}
                getHoistedRole={getHoistedRole}
              />
            </div>
          </div>
        </div>
      </div>
      <MemberPopout />
    </div >
  );
}

export default App;