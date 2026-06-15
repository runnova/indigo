import {
  createSignal,
  createEffect,
  onMount,
  For,
  Show,
  batch,
} from "solid-js";

import { createVirtualizer } from "@tanstack/solid-virtual";
import { Message } from "./App";

const ITEM_ESTIMATE = 72;
const OVERSCAN = 5;
const SCROLL_NEAR_TOP = 120;
const SCROLL_NEAR_BOTTOM = 80;
const PAGE_SIZE = 100;

function dedupe(existing, incoming) {
  const seen = new Set(existing.map((m) => m.id));
  return incoming.filter((m) => !seen.has(m.id));
}

function sortById(msgs) {
  return [...msgs].sort((a, b) => (a.id > b.id ? 1 : a.id < b.id ? -1 : 0));
}

export function VirtualMessageList(props) {
  const [messages, setMessages] = createSignal([]);

  const [loadingOlder, setLoadingOlder] = createSignal(false);
  const [loadingNewer, setLoadingNewer] = createSignal(false);
  const [hasOlderMessages, setHasOlderMessages] = createSignal(true);
  const [showNewIndicator, setShowNewIndicator] = createSignal(false);
  const [jumpTarget, setJumpTarget] = createSignal(null); 

  let scrollEl; 

  const rowVirtualizer = createVirtualizer(() => ({
    count: messages().length,
    getScrollElement: () => scrollEl,
    estimateSize: () => 72,
    overscan: 10,
    getItemKey: (index) => messages()[index]?.id ?? index,
  }));

  function request(payload) {
    props.sendRequest({ ...payload, channel: props.channel });
  }

  function oldestId() {
    const msgs = messages();
    return msgs.length ? msgs[0].id : null;
  }

  function newestId() {
    const msgs = messages();
    return msgs.length ? msgs[msgs.length - 1].id : null;
  }

  async function initialLoad() {
    request({ cmd: "messages_get", limit: PAGE_SIZE });
  }

  function loadOlder() {
    const anchor = oldestId();
    if (!anchor || loadingOlder() || !hasOlderMessages()) return;

    setLoadingOlder(true);

    request({
      cmd: "messages_around",
      around: anchor,
      direction: "older",
      limit: PAGE_SIZE,
    });
  }

  function jumpToMessage(id) {
    request({
      cmd: "messages_around",
      around: id,
      bounds: { above: 50, below: 50 },
    });
    setJumpTarget(id);
  }

  function handleServerEvent(event) {
    if (!event) return;

    if (
      event.cmd === "messages_get" &&
      event.channel === props.channel
    ) {
      const sorted = sortById(event.messages);

      setMessages(event.messages);
      setHasOlderMessages(event.messages.length === PAGE_SIZE);
      requestAnimationFrame(() => scrollToBottom(true));

      return;
    }

    if (event.cmd === "messages_around") {
      const incoming = sortById(event.messages);

      batch(() => {
        setMessages((prev) => {
          const deduped = dedupe(prev, incoming);

          if (event.direction === "older") {
            return [...deduped, ...prev];
          }

          return [...prev, ...deduped];
        });

        setLoadingOlder(false);

        setHasOlderMessages(incoming.length === PAGE_SIZE);
      });

      return;
    }

    if (event.cmd === "message_new") {
      const nearBottom = isNearBottom();

      setMessages((prev) =>
        sortById([...prev, event.message])
      );

      if (nearBottom) {
        requestAnimationFrame(() => scrollToBottom());
      } else {
        setShowNewIndicator(true);
      }

      return;
    }
  }

  function isNearBottom() {
    if (!scrollEl) return true;
    return (
      scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight <
      SCROLL_NEAR_BOTTOM
    );
  }

  function scrollToBottom(instant = false) {
    const count = messages().length;

    if (!count) return;

    rowVirtualizer.scrollToIndex(count - 1, {
      align: "end",
      behavior: instant ? "auto" : "smooth",
    });
  }

  function onScroll() {
    if (!scrollEl) return;
    const st = scrollEl.scrollTop;

    if (st < SCROLL_NEAR_TOP) {
      loadOlder();
    }

    if (showNewIndicator() && isNearBottom()) {
      setShowNewIndicator(false);
    }
  }

  onMount(() => {
    initialLoad();
  });
  createEffect(() => {
    const _ = props.channel;

    setMessages([]);
    setHasOlderMessages(true);
    setShowNewIndicator(false);

    initialLoad();
  });

  createEffect(() => {
    const event = props.wsMessages?.();
    handleServerEvent(event);
  });

  createEffect(() => {
    rowVirtualizer.measure();
  });

  return (
    <div
      ref={el => scrollEl = el}
      class="vml-scroll"
      onScroll={onScroll}
    >
      <Show when={loadingOlder()}>
        <div class="vml-loader">
          Loading older messages...
        </div>
      </Show>

      <Show when={!hasOlderMessages() && messages().length}>
        <div class="vml-beginning">
          You've reached the beginning.
        </div>
      </Show>

      <div
        class="vml-inner"
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          position: "relative",
        }}
      >
        <For each={rowVirtualizer.getVirtualItems()}>
          {(virtualRow) => {
            const msg = messages()[virtualRow.index];

            if (!msg) return null;

            return (
              <div
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <Message
                  username={msg.user}
                  avatar={
                    msg.avatar ??
                    `https://avatars.rotur.dev/${msg.user}`
                  }
                  time={
                    msg.time ??
                    new Date(
                      typeof msg.timestamp === "number"
                        ? msg.timestamp * 1000
                        : Number(msg.timestamp) * 1000
                    ).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  }
                  content={msg.content}
                  attachment={msg.attachment}
                  reply={msg.replyTo?.content ?? msg.replyTo}
                />
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
};