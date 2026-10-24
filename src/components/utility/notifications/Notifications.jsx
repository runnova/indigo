import { createSignal, For, Show } from "solid-js";
import "./notifications.css";
import {
  HiOutlineXMark,
  HiOutlineInformationCircle,
  HiOutlineCheckCircle,
  HiOutlineExclamationTriangle,
  HiOutlineXCircle
} from "solid-icons/hi";

const [notifications, setNotifications] = createSignal([]);
const timers = new Map();
let nextId = 0;

const icons = {
  info: HiOutlineInformationCircle,
  success: HiOutlineCheckCircle,
  warning: HiOutlineExclamationTriangle,
  error: HiOutlineXCircle
};

function dismiss(id) {
  clearTimeout(timers.get(id));
  timers.delete(id);
  setNotifications(items => items.filter(item => item.id !== id));
}

export function notify({
  icon = "info",
  text = "",
  duration = 5000
}) {
  const id = ++nextId;

  setNotifications(items => [
    ...items,
    { id, icon, text, duration }
  ]);

  if (duration > 0) {
    timers.set(id, setTimeout(() => dismiss(id), duration));
  }

  return id;
}

export function NotificationContainer() {
  return (
    <div class="notifications-container">
      <For each={notifications()}>
        {item => {
          const Icon = icons[item.icon] || icons.info;

          return (
            <div class="notification" role="status">
              <span class="notification-icon">
                <Icon />
              </span>

              <span class="notification-text">
                {item.text}
              </span>

              <button
                class="notification-close"
                type="button"
                aria-label="Dismiss notification"
                onClick={() => dismiss(item.id)}
              >
                <HiOutlineXMark />
              </button>

              <Show when={item.duration > 0}>
                <div class="notification-progress">
                  <div
                    class="notification-progress-bar"
                    style={{
                      "--notification-duration": `${item.duration}ms`
                    }}
                  />
                </div>
              </Show>
            </div>
          );
        }}
      </For>
    </div>
  );
}
