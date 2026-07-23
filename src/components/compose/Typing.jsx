import { createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import { Show } from "solid-js";
import { tempState, state } from "../../App";

export default function Typing() {
  const [typingUsers, setTypingUsers] = createSignal([]);
  const timers = new Map();

  createEffect(() => {
    const event = tempState?.conn.lastEvent();

    if (!event || event.cmd !== "typing") return;
    if (event.channel != state.current.channel) return;

    const { user, duration } = event;

    setTypingUsers(users =>
      users.includes(user) ? users : [...users, user]
    );

    clearTimeout(timers.get(user));

    timers.set(
      user,
      setTimeout(() => {
        setTypingUsers(users => users.filter(u => u !== user));
        timers.delete(user);
      }, duration)
    );
  });

  onCleanup(() => {
    for (const timer of timers.values()) clearTimeout(timer);
  });

  const text = createMemo(() => {
    const me = tempState?.conn.me()?.username;
    const users = typingUsers().filter(user => user !== me);

    if (users.length === 0) return "";

    if (users.length === 1) {
      return `${users[0]} is typing`;
    }

    if (users.length === 2) {
      return `${users[0]} and ${users[1]} are typing`;
    }

    return `${users[0]}, ${users[1]} and ${users.length - 2} others are typing`;
  });

  return (<div className="typing_text x">
    <Show when={typingUsers().length}>
      <span class="loader"></span> {text()}...
    </Show></div>
  );
}