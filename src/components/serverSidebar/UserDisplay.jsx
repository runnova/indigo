import { Show, createResource, createSignal } from "solid-js";
import { conn, tempState } from "../../App";
import { Dynamic } from "solid-js/web";

import {
  HiOutlineCheckCircle,
  HiOutlineClock,
  HiOutlineMinusCircle,
  HiOutlineEyeSlash
} from "solid-icons/hi";

const PRESENCES = {
  online: {
    icon: HiOutlineCheckCircle,
    color: "#22c55e"
  },
  idle: {
    icon: HiOutlineClock,
    color: "#f59e0b"
  },
  dnd: {
    icon: HiOutlineMinusCircle,
    color: "#ef4444"
  },
  invisible: {
    icon: HiOutlineEyeSlash,
    color: "#6b7280"
  }
};

export default function UserDisplay(props) {
  const [expanded, setExpanded] = createSignal(false);

  const [status] = createResource(
    () => conn.me()?.username,
    username => username ? tempState.rotur.status.get(username) : null
  );

  const [presence, setPresence] = createSignal("online");
  const [customStatus, setCustomStatus] = createSignal("");

  const toggle = () => {
    const value = !expanded();
    setExpanded(value);
    props.onExpand?.(value);
  };

  const updatePresence = value => {
    setPresence(value);
    tempState.rotur.socket.setPresence(value);
  };

  const updateStatus = value => {
    setCustomStatus(value);
    tempState.rotur.socket.setStatus(value);
  };


  const [menuOpen, setMenuOpen] = createSignal(false);
  const current = PRESENCES[presence()];
  return (
    <div
      class="user_display"
      classList={{ expanded: expanded() }}
    >
      <Show when={expanded()}>
        <div class="editor y">

          <div class="presence">

            <button onClick={() => setMenuOpen(v => !v)}>
              <Dynamic
                component={current.icon}
                size={18}
                color={current.color}
              />
              <span>{presence()}</span>
            </button>

            <Show when={menuOpen()}>
              <div class="dropup">
                <For each={Object.entries(PRESENCES)}>
                  {([name, data]) => (
                    <button
                      onClick={() => {
                        updatePresence(name);
                        setMenuOpen(false);
                      }}
                    >
                      <Dynamic
                        component={data.icon}
                        size={18}
                        color={data.color}
                      />
                      <span>{name}</span>
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>
          <input
            type="text"
            placeholder="What's happening?"
            value={customStatus()}
            onInput={e => updateStatus(e.currentTarget.value)}
          />
        </div>
      </Show>
      <div class="header x" onClick={toggle}>
        <div class="pfpWO">
          <img
            src={`https://avatars.rotur.dev/${conn.me()?.username}`}
            alt=""
            class="pfp"
            loading="lazy"
          />
          <img
            src={`https://avatars.rotur.dev/.overlay/${conn.me()?.username}`}
            alt=""
            class="overlay"
            loading="lazy"
          />
        </div>

        <div class="data y fill">
          <span>{conn.me()?.username}</span>
          <small>
            {status()?.presence} &bull; {status()?.status}
          </small>
        </div>
      </div>

    </div>
  );
}