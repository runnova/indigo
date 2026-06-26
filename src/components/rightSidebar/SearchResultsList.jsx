import { createSignal, createEffect, For } from "solid-js";
import { Message } from "../messages/message";

export default function SearchResultsList(props) {
  const [messages, setMessages] = createSignal([]);

  createEffect(() => {
    const query = props.state.searchQuery;
    const channel = props.state.current.channel;

    if (!query?.trim() || !channel) {
      setMessages([]);
      return;
    }

    props.conn.send({
      cmd: "messages_search",
      channel,
      query
    });
  });

  createEffect(() => {
    const event = props.conn.lastEvent();

    if (!event) return;

    if (event.cmd === "messages_search") {
      setMessages(event.results ?? []);
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