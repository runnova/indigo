import { createSignal, For, Show } from "solid-js";
import { createStore } from "solid-js/store";
import { useServerConnection } from "./server_connection";
import { VirtualMessageList } from "./scolling"

const [state, setState] = createStore({
  servers: [
    { src: "dms.mistium.com", icon: null, name: "dms" },
    { src: "chats.mistium.com", icon: null, name: "sopher" },
  ],
  current: {
    channel: null,
    server: null,
  },
});

function App() {
  const conn = useServerConnection();
const roturToken = () => localStorage.getItem("rotur_token") ?? null;

  function selectServer(server) {
    if (state.current.server?.src === server.src && conn.status() === "ready") return;

    setState("current", { server, channel: null });

    if (roturToken()) {
      conn.connect(server, roturToken());
    } else {
      conn.connectCracked(server, { username: "guest", password: "guest" });
    }
  }

  function selectChannel(channelName) {
    setState("current", "channel", channelName);
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

      <div class="server_content y fill">

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

        <div class="fill x" style={
          {
            height: 0,
            flex: 1
          }}>

          <div class="first_bar bar">
            <Show when={conn.status() === "ready"}>
              <div class="channel_list y">
                <div class="channel_list_header">{currentServerName()}</div>
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

          <div class="third_bar bar" />

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