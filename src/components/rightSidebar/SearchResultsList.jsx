import { createSignal, createEffect, For } from "solid-js";
import { Message } from "../messages/message";
import {
  HiOutlineMagnifyingGlass,
} from "solid-icons/hi";
import { setState, setThirdBarCollapsed } from "../../state";

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
      query,
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
    <>
      <div class="searchbox">
        <input
          type="text"
          class="message_search_input"
          placeholder="Search messages..."
          onFocus={() => {
            setState("thirdBarContext", "search");
            setThirdBarCollapsed(false);
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            setState("searchQuery", e.currentTarget.value);
            setState("thirdBarContext", "search");
            setThirdBarCollapsed(false);
          }}
        />
        <HiOutlineMagnifyingGlass />
      </div>

      <div class="search_results_list pane_message_list y">
        <For each={messages()}>
          {(msg, i) => (
            <Message
              onClick={() => {
                console.log(32, msg);
                tempState.virtMsgList.jumpToMessage(msg.id);
              }}
              username={msg.user}
              avatar={`https://avatars.rotur.dev/${msg.user}`}
              content={msg.content}
              attachments={msg.attachments}
              reactions={msg.reactions}
              reply={msg.reply}
              time={new Date(msg.timestamp).toLocaleTimeString()}
              grouped={i() > 0 && messages()[i() - 1]?.user === msg.user}
            />
          )}
        </For>
      </div>
    </>
  );
}
