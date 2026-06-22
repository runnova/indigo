import { createSignal, createEffect, onMount, For } from "solid-js";
import { Message } from "./message";

export default function PinnedList(props) {
  const [messages, setMessages] = createSignal([]);

  createEffect(() => {
    const channel = props.state.current.channel;

    if (!channel) return;

    setMessages([]);

    props.conn.send({
      cmd: "messages_pinned",
      channel,
    });
  });

  createEffect(() => {
    const event = props.conn.lastEvent();

    if (!event) return;

    if (event.cmd === "messages_pinned") {
      setMessages(event.messages ?? []);
    }
  });

  return (
    <div class="pinned_messages_list y">
      <For each={messages()}>
        {(msg, i) => (
          <Message
            username={msg.user}
            content={msg.content}
            attachments={msg.attachments}
            reactions={msg.reactions}
            reply={msg.reply}
            time={new Date(msg.timestamp).toLocaleTimeString()}
            grouped={
              i() > 0 &&
              messages()[i() - 1]?.user === msg.user
            }
          />
        )}
      </For>
    </div>
  );
}