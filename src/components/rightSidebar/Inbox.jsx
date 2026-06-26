import { createSignal, createEffect, For } from "solid-js";
import { Message } from "../messages/message";

export default function Inbox(props) {
  const [messages, setMessages] = createSignal([]);

  createEffect(() => {
    if (props.state.thirdBarContext !== "inbox") return;

    props.conn.send({
      cmd: "pings_get",
      limit: 20
    });
  });

  createEffect(() => {
    const event = props.conn.lastEvent();

    if (!event) return;

    if (event.cmd === "pings_get") {
      setMessages(event.messages ?? []);
    }
  });

  return (
    <div class="search_results_list y">
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