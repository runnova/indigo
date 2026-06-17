import { createSignal, For, Show, createEffect, onMount, createMemo } from "solid-js";
import { createStore } from "solid-js/store";
import { useServerConnection } from "./server_connection";
import { VirtualMessageList } from "./scolling"
import { HiSolidChevronRight } from "solid-icons/hi";

const defaultState = {
  servers: [
    { src: "dms.mistium.com", icon: null, name: "dms" },
    { src: "chats.mistium.com", icon: null, name: "sopher" },
  ],
  current: {
    channel: null,
    server: null,
  },
  serverChannels: {}
};

const [state, setState] = createStore(
  JSON.parse(localStorage.getItem("state") || "null") ?? defaultState
);

function App() {
  const conn = useServerConnection();
  onMount(() => {
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

  createEffect(() => {
    localStorage.setItem("state", JSON.stringify(state));
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
  return (
    <div class="main x">

      <div class="server_bar y">
        <For each={state.servers}>
          {(server) => (
            <div
              class={`server_single${state.current.server?.src === server.src ? " server_single--active" : ""}`}
              onClick={() => selectServer(server)}
              title={server.name}
            >
              <img
                src={server.icon ?? "https://static.vecteezy.com/system/resources/thumbnails/045/763/121/small/speech-bubble-transparent-background-transparent-chat-talking-speech-bubble-free-png.png"}
                alt={server.name}
                class="server_icon"
              />
            </div>
          )}
        </For>
      </div>

      <div class="server_content x fill">
        <div class="first_bar bar">
          <Show when={conn.status() === "ready"}>
            <div className="server_info">
              <div className="header">
                <Show when={conn.serverInfo().banner}>
                  <img src={conn.serverInfo().banner} alt="Server Banner" className="banner" />
                </Show>
                <div className="dropdown x">
                  <span>{conn.serverInfo().name}</span>
                  <HiSolidChevronRight />
                </div>
              </div>
            </div>
            <div class="channel_list y">
              <For each={conn.channels().filter(c => c.type === "text")}>
                {(ch) => (
                  <div
                    class={`channel_item${state.current.channel === ch.name ? " channel_item--active" : ""}`}
                    onClick={() => selectChannel(ch.name)}
                  >
                    # {ch.display_name ?? ch.name}
                  </div>
                )}
              </For>
            </div>
          </Show>

          <Show when={conn.status() !== "ready" && conn.status() !== "idle"}>
            <div class="sidebar_status">
              <Show when={conn.status() === "error"} fallback={
                <span class="sidebar_status__spinner">⟳</span>
              }>
                <span class="sidebar_status__error">{conn.error()}</span>
              </Show>
            </div>
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

                <div class="text_box x">
                  <textarea
                    id="message_input"
                    placeholder={`Message #${state.current.channel}`}
                    class="fill"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        const content = e.currentTarget.value.trim();
                        if (!content) return;
                        conn.send({ cmd: "message_new", channel: state.current.channel, content });
                        e.currentTarget.value = "";
                      }
                    }}
                  />
                  <div class="action_buttons">
                    <button class="icon_button">
                      <div class="icon">emoji</div>
                    </button>
                  </div>
                </div>
              </Show>
            </div>

            <div class="third_bar bar">

              <div class="members_list y">
                <For each={memberSections()}>
                  {(section) => (
                    <>
                      <div class="member_section_label">
                        {section.label} — {section.users.length}
                      </div>

                      <For each={section.users}>
                        {(user) => {
                          const roleId = getHoistedRole(user) ?? user.roles?.[0];
                          const role = conn.roles?.()?.[roleId];

                          const online =
                            onlineUsers().has(user.username);

                          return (
                            <div class="member_item x">
                              {online && (
                                <img
                                  src={
                                    "https://avatars.rotur.dev/" +
                                    user.username
                                  }
                                  alt=""
                                  class="pfp"
                                />
                              )}

                              <span
                                style={{
                                  color: role?.color,
                                  opacity: (online) ? 1 : .5
                                }}
                              >
                                {user.username}
                              </span>
                            </div>
                          );
                        }}
                      </For>
                    </>
                  )}
                </For>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div >
  );
}

export function Message(props) {
  return (
    <div class="message_single y">
      {props.reply && (
        <div class="reply_preview x">
          <div class="text">{props.reply}</div>
        </div>
      )}
      <div class="actual_message x">
        <img src={props.avatar} alt="" class="pfp" />
        <div class="message_content y flex">
          <div class="message_meta x">
            <div class="username">{props.username}</div>
            <div class="time">{props.time}</div>
          </div>
          <div class="message_text">{props.content}</div>
          {props.attachment && (
            <div class="attatchments">
              <img src={props.attachment} alt="" class="attatched" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;