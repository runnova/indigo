import { createSignal, createEffect, on, For, Show } from "solid-js";
import { createVirtualizer } from "@tanstack/solid-virtual";
import { Message } from "./App";
import { createChannelMessages } from "./useChannelMessages";

const ESTIMATED_ROW_HEIGHT = 72;
const OVERSCAN = 10;
const SCROLL_NEAR_TOP = 100;
const SCROLL_NEAR_BOTTOM = 80;

export function VirtualMessageList(props) {
  let scrollEl;

  function isNearBottom() {
    if (!scrollEl) return true;
    return (
      scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight <
      SCROLL_NEAR_BOTTOM
    );
  }

  const { messages, loadingOlder, hasOlderMessages, lastUpdate, loadOlder } =
    createChannelMessages({
      channel: () => props.channel,
      wsEvent: () => props.wsMessages?.(),
      sendRequest: props.sendRequest,
      getScrollElement: () => scrollEl,
      isNearBottom,
    });

  const [showNewIndicator, setShowNewIndicator] = createSignal(false);

  const rowVirtualizer = createVirtualizer(() => ({
    count: messages().length,
    getScrollElement: () => scrollEl,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: OVERSCAN,
    getItemKey: (index) => messages()[index]?.id ?? index,
  }));

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

    if (scrollEl.scrollTop < SCROLL_NEAR_TOP) {
      loadOlder();
    }
    if (showNewIndicator() && isNearBottom()) {
      setShowNewIndicator(false);
    }
  }

  createEffect(
    on(lastUpdate, (update) => {
      if (!update) return;

      if (update.type === "initial") {
        setShowNewIndicator(false);
        requestAnimationFrame(() => scrollToBottom(true));
        return;
      }

      if (update.type === "append") {
        if (isNearBottom()) {
          requestAnimationFrame(() => scrollToBottom());
        } else {
          setShowNewIndicator(true);
        }
        return;
      }

      if (update.type === "jump") {
        requestAnimationFrame(() => {
          const index = messages().findIndex((m) => m.id === update.targetId);
          if (index >= 0) {
            rowVirtualizer.scrollToIndex(index, {
              align: "center",
              behavior: "auto",
            });
          }
        });
      }
    })
  );

  return (
    <div ref={(el) => (scrollEl = el)} class="vml-scroll" onScroll={onScroll}>
      <Show when={loadingOlder()}>
        <div class="vml-loader">Loading older messages...</div>
      </Show>

      <Show when={!hasOlderMessages() && messages().length}>
        <div class="vml-beginning">You've reached the beginning.</div>
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
                ref={(el) => rowVirtualizer.measureElement(el)}
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
}