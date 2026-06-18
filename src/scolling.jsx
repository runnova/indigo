import { createSignal, createEffect, on, For, Show, untrack, onCleanup } from "solid-js";
import { createVirtualizer } from "@tanstack/solid-virtual";
import { Message } from "./message";
import { MessageActions } from "./MessageActions.jsx";
import { createChannelMessages } from "./useChannelMessages";
import { tempState } from "./App.jsx";

const ESTIMATED_ROW_HEIGHT = 60;
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
  const [hoveredMessage, setHoveredMessage] = createSignal(null);
  const [hoverRect, setHoverRect] = createSignal(null);
  let hideTimer;

  const rowVirtualizer = createVirtualizer(() => ({
    count: messages().length,
    getScrollElement: () => scrollEl,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: OVERSCAN,
    getItemKey: (index) => messages()[index]?.id,
    measureElement: (el) => el.getBoundingClientRect().height,
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
      if (update.type === "reset") {
        requestAnimationFrame(() => {
          scrollToBottom(true);
        });
      }
    })
  );
  return (
    <>
    <div ref={(el) => (scrollEl = el)} class="vml-scroll" onScroll={onScroll}>
      <Show when={!hasOlderMessages() && messages().length}>
        <div class="vml-beginning">You've reached the beginning.</div>
      </Show>

      <div class="vml-inner" style={{
        height: `${rowVirtualizer.getTotalSize()}px`,
        position: "relative",
      }}>

        <For each={rowVirtualizer.getVirtualItems()}>
          {(virtualRow) => {
            const msg = () => messages()[virtualRow.index];
            const previousMsg = () => messages()[virtualRow.index - 1];
            const grouped = () =>
              virtualRow.index > 0 &&
              messages()[virtualRow.index - 1]?.user === msg()?.user;
            return (
              <div
                attr:data-index={virtualRow.index}
                attr:data-id={msg()?.id}
                ref={(el) => {
                  rowVirtualizer.measureElement(el);

                  const observer = new ResizeObserver(() => {
                    rowVirtualizer.measureElement(el);
                  });

                  observer.observe(el);

                  onCleanup(() => observer.disconnect());
                }}
                class="vml-item"
                onMouseEnter={(e) => {
                  clearTimeout(hideTimer);

                  const message = msg();
                  if (!message) return;

                  const rect = e.currentTarget.getBoundingClientRect();

                  setHoveredMessage(message);
                  setHoverRect(rect);
                }}
                onMouseLeave={() => {
                  hideTimer = setTimeout(() => {
                    setHoveredMessage(null);
                    setHoverRect(null);
                  }, 200);
                }}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <Show when={msg()}>
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
                    id={msg().id}
                    attachments={msg()?.attachments}
                    reply={msg()?.replyTo?.content ?? msg()?.replyTo}
                    grouped={grouped()}
                  />
                </Show>
              </div>
            );
          }}
        </For>

      </div>
    
    </div>
    <Show when={hoveredMessage() && hoverRect()}>
       <div
          class="message-actions"
          onMouseEnter={() => clearTimeout(hideTimer)}
          onMouseLeave={() => {
            hideTimer = setTimeout(() => {
              setHoveredMessage(null);
              setHoverRect(null);
            }, 200);
          }}
          style={{
            position: "fixed",
            top: `${hoverRect().top}px`,
            right: `280px`,
            "z-index": 100,
          }}
        >

          <MessageActions
            content={hoveredMessage().content}
            canEdit={hoveredMessage().user === tempState.conn.me().username}
            canDelete={hoveredMessage().user === tempState.conn.me().username}
            onReply={() => console.log("reply", hoveredMessage())}
            onEdit={() => console.log("edit", hoveredMessage())}
            onDelete={() => console.log("delete", hoveredMessage())}
            onReact={() => console.log("react", hoveredMessage())}
          />
        </div>
    </Show>
    </>
  );
}