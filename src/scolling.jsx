import {
  createSignal,
  createEffect,
  createMemo,
  on,
  For,
  Show,
} from "solid-js";
import { Message } from "./components/message";
import { MessageActions } from "./components/MessageActions.jsx";
import { createChannelMessages } from "./useChannelMessages";
import { tempState, state, setState} from "./App.jsx";
import { SelfRoles } from "./components/SelfRoles";

const SCROLL_NEAR_TOP = 100;
const SCROLL_NEAR_BOTTOM = 80;

export function VirtualMessageList(props) {
  console.log("channel", props.channel);
  if (props.channel === "indigo-self-roles") {
    return (
      <div class="vml-scroll">
        <SelfRoles
          channel={props.channel}
          sendRequest={props.sendRequest}
        />
      </div>
    );
  }
  let scrollEl;

  function scrollToMessage(messageId, behavior = "smooth") {
    const el = scrollEl?.querySelector(
      `[data-id="${messageId}"]`
    );

    if (!el) return false;

    el.scrollIntoView({
      block: "center",
      behavior,
    });

    return true;
  }

  props.onReady?.({
    scrollToMessage,
    scrollToBottom,
  });

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
  const SECTION_SIZE = 30;
  const WINDOW_RADIUS = 2;

  const [visibleStart, setVisibleStart] = createSignal(0);
  const [visibleEnd, setVisibleEnd] = createSignal(4);

  const sectionHeights = new Map();

  let anchorId = null;
  let anchorOffset = 0;

  const sections = createMemo(() => {
    const result = [];
    const msgs = messages();

    for (let i = 0; i < msgs.length; i += SECTION_SIZE) {
      const chunk = msgs.slice(i, i + SECTION_SIZE);

      result.push({
        id: chunk[0]?.id,
        messages: chunk,
      });
    }

    return result;
  });

  function estimateSectionHeight(sectionId) {
    return sectionHeights.get(sectionId) ?? 1800;
  }
  const topSpacerHeight = createMemo(() => {
    let total = 0;

    const s = sections();

    for (let i = 0; i < visibleStart(); i++) {
      total += estimateSectionHeight(
        s[i]?.id
      );
    }

    return total;
  });
  const bottomSpacerHeight = createMemo(() => {
    let total = 0;
    const s = sections();

    for (
      let i = visibleEnd() + 1;
      i < s.length;
      i++
    ) {
      total += estimateSectionHeight(
        s[i]?.id
      );
    }

    return total;
  });
  function captureAnchor() {
    if (!scrollEl) return;

    const containerRect =
      scrollEl.getBoundingClientRect();

    const centerY =
      containerRect.top +
      scrollEl.clientHeight / 2;

    let best = null;
    let bestDist = Infinity;

    scrollEl
      .querySelectorAll(".vml-item")
      .forEach((el) => {
        const rect = el.getBoundingClientRect();

        const itemCenter =
          rect.top + rect.height / 2;

        const dist = Math.abs(
          itemCenter - centerY
        );

        if (dist < bestDist) {
          best = el;
          bestDist = dist;
        }
      });

    if (!best) return;

    anchorId = best.dataset.id;

    anchorOffset =
      best.getBoundingClientRect().top -
      containerRect.top;
  }
  function restoreAnchor() {
    if (!anchorId || !scrollEl) return;

    requestAnimationFrame(() => {
      const anchor =
        scrollEl.querySelector(
          `[data-id="${anchorId}"]`
        );

      if (!anchor) return;

      const containerRect =
        scrollEl.getBoundingClientRect();

      const newOffset =
        anchor.getBoundingClientRect().top -
        containerRect.top;

      scrollEl.scrollTop +=
        newOffset - anchorOffset;
    });
  }
  function updateVirtualWindow() {
    if (!scrollEl) return;

    const centerY =
      scrollEl.scrollTop +
      scrollEl.clientHeight / 2;

    let accumulated = 0;
    let centerSection = 0;
    const s = sections();

    for (let i = 0; i < s.length; i++) {
      accumulated += estimateSectionHeight(
        s[i].id
      );

      if (accumulated >= centerY) {
        centerSection = i;
        break;
      }
    }

    const start = Math.max(
      0,
      centerSection - WINDOW_RADIUS
    );

    const end = Math.min(
      sections().length - 1,
      centerSection + WINDOW_RADIUS
    );

    if (
      start === visibleStart() &&
      end === visibleEnd()
    ) {
      return;
    }

    captureAnchor();

    setVisibleStart(start);
    setVisibleEnd(end);

    queueMicrotask(restoreAnchor);
  }
  const [showNewIndicator, setShowNewIndicator] = createSignal(false);
  const [hoveredMessage, setHoveredMessage] = createSignal(null);
  const [hoverRect, setHoverRect] = createSignal(null);
  let hideTimer;

function scrollToBottom(instant = false) {
  if (!scrollEl) return;

  scrollEl.scrollTo({
    top: scrollEl.scrollHeight,
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
    updateVirtualWindow();
  }
  createEffect(
    on(
      sections,
      () => {
        queueMicrotask(updateVirtualWindow);
      },
      { defer: true }
    )
  );
  createEffect(
    on(lastUpdate, (update) => {
      if (!update) return;

      if (update.type === "initial") {
        setShowNewIndicator(false);
        const total = sections().length;

        setVisibleStart(
          Math.max(0, total - 5)
        );

        setVisibleEnd(total - 1);
        requestAnimationFrame(() => {
          scrollToBottom(true);
          updateVirtualWindow();
        });
        return;
      }

      const wasNearBottom = isNearBottom();

      if (update.type === "append") {
        if (wasNearBottom) {
          requestAnimationFrame(() => scrollToBottom());
        } else {
          setShowNewIndicator(true);
        }
      }

      if (update.type === "jump") {
        requestAnimationFrame(() => {
          const el = scrollEl?.querySelector(
            `[data-id="${update.targetId}"]`
          );

          if (el) {
            el.scrollIntoView({
              block: "center",
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

      <div class="vml-inner">
 <div
  style={{
    height: `${topSpacerHeight()}px`,
  }}
/>

<For
  each={sections().slice(
    visibleStart(),
    visibleEnd() + 1
  )}
>
  {(section) => (
    <div
      ref={(el) => {
       sectionHeights.set(
  section.id,
  el.offsetHeight
);
      }}
    >
      <For each={section.messages}>
        {(message, index) => {
          const msg = () => message;
  const previous =
  index() > 0
    ? section.messages[index() - 1]
    : null;

const grouped =
  previous &&
  previous.user === message.user;
const replyMessage = msg()?.reply_to
  ? section.messages.find(
      m => m.id === msg().reply_to.id
    )
  : null;
          return (
            <div
              attr:data-index={index()}
              attr:data-id={msg()?.id}
              
  classList={{
  "vml-item": true,
  "is-reply-target":
    state.replying?.id === msg()?.id,
}}
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
                    typeof msg()?.timestamp ===
                      "number"
                      ? msg().timestamp * 1000
                      : Number(
                          msg()?.timestamp
                        ) * 1000
                  ).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                }
                content={msg()?.content}
                id={msg().id}
                reactions={msg().reactions}
                attachments={
                  msg()?.attachments
                }
  grouped={grouped && !replyMessage}
  reply={replyMessage}
              />
            </div>
          );
        }}
      </For>
    </div>
  )}
</For>

<div
  style={{
    height: `${bottomSpacerHeight()}px`,
  }}
/>

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
            canEdit={hoveredMessage().user === tempState?.conn?.me()?.username}
            canDelete={hoveredMessage().user === tempState?.conn?.me()?.username}
            onReply={() =>{
              tempState.virtMsgList.scrollToMessage(hoveredMessage().id);
              setState("replying", {
                id: hoveredMessage().id,
                user: hoveredMessage().user,
                content: hoveredMessage().content
              })}
            }
            onEdit={() => console.log("edit", hoveredMessage())}
            onDelete={() => console.log("delete", hoveredMessage())}
            onReact={() => console.log("react", hoveredMessage())}
          />
        </div>
    </Show>
    </>
  );
}