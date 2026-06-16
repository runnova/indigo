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
const OVERSCAN = 10;
const SCROLL_NEAR_TOP = 100;
const SCROLL_NEAR_BOTTOM = 80;
const PAGE_SIZE = 20;

function sortMessages(msgs) {
  return [...msgs].sort((a, b) => {
    const ta = Number(a.timestamp);
    const tb = Number(b.timestamp);

    if (ta !== tb) return ta - tb;

    return a.id.localeCompare(b.id);
  });
}
function dedupe(existing, incoming) {
  const seen = new Set(existing.map((m) => m.id));
  return incoming.filter((m) => !seen.has(m.id));
}

export function VirtualMessageList(props) {
  const [messages, setMessages] = createSignal([]);

  const [loadingOlder, setLoadingOlder] = createSignal(false);
  const [loadingNewer, setLoadingNewer] = createSignal(false);
  const [hasOlderMessages, setHasOlderMessages] = createSignal(true);
  const [showNewIndicator, setShowNewIndicator] = createSignal(false);
  const [jumpTarget, setJumpTarget] = createSignal(null);
  const [pendingDirection, setPendingDirection] =
    createSignal(null);
  const [anchorId, setAnchorId] =
    createSignal(null);

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

  let loadingOlderLock = false;
  let lastLoadTime = 0;

  function loadOlder() {
    const now = Date.now();

    if (now - lastLoadTime < 500) return;

    lastLoadTime = now;
    if (
      loadingOlderLock ||
      loadingOlder() ||
      !hasOlderMessages()
    ) {
      return;
    }

    const anchor = oldestId();

    if (!anchor) return;

    loadingOlderLock = true;
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
      const sorted = sortMessages(event.messages);
      setMessages(sorted);
      setHasOlderMessages(event.messages.length >= PAGE_SIZE);
      requestAnimationFrame(() => scrollToBottom(true));

      return;
    }
    if (event.cmd === "messages_around") {
      const incoming = sortMessages(event.messages);
      const direction = pendingDirection();

      batch(() => {
        setMessages(prev => {
          const map = new Map();

          for (const m of prev) {
            map.set(m.id, m);
          }

          for (const m of incoming) {
            map.set(m.id, m);
          }

          return sortMessages([...map.values()]);
        });

        setPendingDirection(null);
        setLoadingOlder(false);
        loadingOlderLock = false;

        if (direction === "older") {
          setHasOlderMessages(
            incoming.length >= PAGE_SIZE
          );
        }
      });

      if (direction === "older") {
        requestAnimationFrame(() => {
          const id = anchorId();

          if (!id) return;

          const previousHeight = scrollEl.scrollHeight;

          setMessages(prev => [...incoming, ...prev]);

          requestAnimationFrame(() => {
            const newHeight = scrollEl.scrollHeight;
            scrollEl.scrollTop += newHeight - previousHeight;
          });
        });
      }

      return;
    }

    if (event.cmd === "message_new") {
      const nearBottom = isNearBottom();

      setMessages(prev => {
        const map = new Map(prev.map(m => [m.id, m]));
        map.set(event.message.id, event.message);
        return sortMessages([...map.values()]);
      });

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
    console.log(
      "messages",
      messages().length,
      "scroll",
      !!scrollEl,
      "items",
      rowVirtualizer.getVirtualItems().length
    );
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
            const msg = () => messages()[virtualRow.index];

            return (
              <div
                data-index={virtualRow.index}
                data-id={msg()?.id}
                ref={el => rowVirtualizer.measureElement(el)}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <Message
                  username={msg()?.user}
                  avatar={
                    msg()?.avatar ??
                    `https://avatars.rotur.dev/${msg()?.user}`
                  }
                  time={
                    msg()?.time ??
                    new Date(
                      typeof msg()?.timestamp === "number"
                        ? msg().timestamp * 1000
                        : Number(msg()?.timestamp) * 1000
                    ).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  }
                  content={msg()?.content}
                  attachment={msg()?.attachment}
                  reply={msg()?.replyTo?.content ?? msg()?.replyTo}
                />
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
};