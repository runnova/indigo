import { Show, createResource, createEffect, createSignal, onCleanup } from "solid-js";
import { conn, state, tempState } from "../../App";
import { Dynamic } from "solid-js/web";

import {
  HiOutlineCheckCircle,
  HiOutlineClock,
  HiOutlineMinusCircle,
  HiOutlineEyeSlash,
  HiOutlineChevronDown,
  HiOutlineChevronUp
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
    async username => {
      if (!username) return null;

      try {
        return await tempState.rotur.status.get(username);
      } catch {
        return null;
      }
    }
  );

  const [presence, setPresence] = createSignal("online");

  const [customStatus, setCustomStatus] = createSignal("");

  let statusTimeout;

  createEffect(() => {
    const value = customStatus();

    clearTimeout(statusTimeout);

    statusTimeout = setTimeout(() => {
      tempState.rotur.socket.send({
        cmd: "set_status",
        presence: presence(),
        status: value,
      });
    }, 400);
  });

  onCleanup(() => clearTimeout(statusTimeout));

  const toggle = () => {
    const value = !expanded();
    setExpanded(value);
    props.onExpand?.(value);
  };

  const updatePresence = async (value) => {

    setPresence(value);

    tempState.rotur.socket.send({
      cmd: "set_status",
      presence: value,
      status: status()?.status,
    });
  };

  const updateStatus = async (value) => {
    setCustomStatus(value);

    tempState.rotur.socket.setStatus();

    tempState.rotur.socket.send({
      cmd: "set_status",
      presence: status()?.presence || "online",
      status: value,
    });
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

              <Dynamic
                component={menuOpen() ? HiOutlineChevronDown : HiOutlineChevronUp}
                size={16}
              />
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
            value={status()?.status}
            onInput={e => setCustomStatus(e.currentTarget.value)}
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

        <Dynamic
          component={expanded() ? HiOutlineChevronDown : HiOutlineChevronUp}
          size={18}
        />
      </div>

    </div>
  );
}