import {
    createSignal,
    createEffect,
    createMemo,
    on,
    For,
    Show,
    onCleanup,
} from "solid-js";
import {
    HiOutlineChevronLeft,
    HiOutlineChevronDown
} from "solid-icons/hi"
import {
    Message
} from "./components/messages/message.jsx";
import {
    MessageActions
} from "./components/messages/MessageActions.jsx";
import {
    createChannelMessages
} from "./core/useChannelMessages";
import {
    tempState,
    state,
    setState
} from "./App.jsx";

const [fakeMessages, setFakeMessages] = createSignal([]);
let fakeId = 0;

export function addFakeMessage(data) {
    const now = Math.floor(Date.now() / 1000);

    setFakeMessages(messages => [
        ...messages,
        {
            id: `fake-${++fakeId}`,
            user: "Debug",
            content: "",
            timestamp: now,
            avatar: null,
            reactions: [],
            attachments: [],
            embeds: [],
            ...data,
            __fake: true,
        },
    ]);
}

export function clearFakeMessages() {
    setFakeMessages([]);
}

let getMessage = () => undefined;

export function getMessageById(id) {
    return getMessage(id);
}

export function createMessageLookup(messages) {
    const messageMap = createMemo(() => {
        const map = new Map();

        for (const message of messages()) {
            map.set(message.id, message);
        }

        return map;
    });

    getMessage = id => messageMap().get(id);

    return messageMap;
}

const SCROLL_NEAR_TOP = 100;
const SCROLL_NEAR_BOTTOM = 80;

export function VirtualMessageList(props) {
    let scrollEl;
    let innerEl;
    let resizeObserver;

    function attachResizeObserver(el) {
        resizeObserver?.disconnect();
        resizeObserver = new ResizeObserver(() => {
            scrollToBottom(false);
        });
        resizeObserver.observe(el);
    }

    onCleanup(() => resizeObserver?.disconnect());

    function scrollToMessage(messageId, behavior = "smooth") {
        const el = scrollEl?.querySelector(`[data-id="${messageId}"]`);
        if (!el) return false;
        el.scrollIntoView({
            block: "center",
            behavior
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

    const {
        messages: realMessages,
        loadingOlder,
        hasOlderMessages,
        lastUpdate,
        loadOlder,
    } = createChannelMessages({
        channel: () => props.channel,
        wsEvent: () => props.wsMessages?.(),
        sendRequest: props.sendRequest,
        getScrollElement: () => scrollEl,
        isNearBottom,
        threadId: () => props.threadId,
    });

    const messages = createMemo(() => [
        ...realMessages(),
        ...fakeMessages(),
    ]);

    createMessageLookup(messages);

    const SECTION_SIZE = 30;
    const WINDOW_RADIUS = 2;

    const [visibleStart, setVisibleStart] = createSignal(0);
    const [visibleEnd, setVisibleEnd] = createSignal(0);
    const [scrollLocked, setScrollLocked] = createSignal(true);

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
                messages: chunk
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
            total += estimateSectionHeight(s[i]?.id);
        }
        return total;
    });

    const bottomSpacerHeight = createMemo(() => {
        let total = 0;
        const s = sections();
        for (let i = visibleEnd() + 1; i < s.length; i++) {
            total += estimateSectionHeight(s[i]?.id);
        }
        return total;
    });

    function captureAnchor() {
        if (!scrollEl) return;
        const containerRect = scrollEl.getBoundingClientRect();
        const centerY = containerRect.top + scrollEl.clientHeight / 2;
        let best = null;
        let bestDist = Infinity;
        scrollEl.querySelectorAll(".vml-item").forEach((el) => {
            const rect = el.getBoundingClientRect();
            const itemCenter = rect.top + rect.height / 2;
            const dist = Math.abs(itemCenter - centerY);
            if (dist < bestDist) {
                best = el;
                bestDist = dist;
            }
        });
        if (!best) return;
        anchorId = best.dataset.id;
        anchorOffset = best.getBoundingClientRect().top - containerRect.top;
    }

    function restoreAnchor() {
        if (!anchorId || !scrollEl) return;
        requestAnimationFrame(() => {
            const anchor = scrollEl.querySelector(`[data-id="${anchorId}"]`);
            if (!anchor) return;
            const containerRect = scrollEl.getBoundingClientRect();
            const newOffset = anchor.getBoundingClientRect().top - containerRect.top;
            scrollEl.scrollTop += newOffset - anchorOffset;
        });
    }

    function updateVirtualWindow() {
        if (!scrollEl) return;
        const centerY = scrollEl.scrollTop + scrollEl.clientHeight / 2;
        let accumulated = 0;
        let centerSection = 0;
        const s = sections();
        for (let i = 0; i < s.length; i++) {
            accumulated += estimateSectionHeight(s[i].id);
            if (accumulated >= centerY) {
                centerSection = i;
                break;
            }
        }
        const start = Math.max(0, centerSection - WINDOW_RADIUS);
        const end = Math.min(sections().length - 1, centerSection + WINDOW_RADIUS);
        if (start === visibleStart() && end === visibleEnd()) return;
        captureAnchor();
        setVisibleStart(start);
        setVisibleEnd(end);
        queueMicrotask(restoreAnchor);
    }

    const [showNewIndicator, setShowNewIndicator] = createSignal(false);
    const [hoveredMessage, setHoveredMessage] = createSignal(null);
    const [hoverRect, setHoverRect] = createSignal(null);
    const [showScrollButton, setShowScrollButton] = createSignal(false);
    const [hasUnreadBelow, setHasUnreadBelow] = createSignal(false);
    const [unreadCount, setUnreadCount] = createSignal(0);

    let hideTimer;

    function scrollToBottom(instant = false) {
        scrollEl.scrollTo({
            top: scrollEl.scrollHeight,
            behavior: instant ? "instant" : "smooth",
        });
    }
    let wasNearBottom = true;

    function onScroll() {
        if (!scrollEl) return;

        const nearBottom = isNearBottom();

        setScrollLocked(nearBottom);
        setShowScrollButton(!nearBottom);

        if (nearBottom) {
            setUnreadCount(0);
        }

        if (scrollEl.scrollTop < SCROLL_NEAR_TOP)
            loadOlder();

        updateVirtualWindow();
    }

    function onVisibilityChange() {
        if (!document.hidden && scrollLocked()) {
            requestAnimationFrame(() => {
                scrollToBottom(true);
            });
        }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);

    onCleanup(() => {
        document.removeEventListener("visibilitychange", onVisibilityChange);
    });
    createEffect(
        on(sections, () => {
            queueMicrotask(updateVirtualWindow);
        }, {
            defer: true
        })
    );

    createEffect(
        on(lastUpdate, (update) => {
            if (!update) return;

            if (update.type === "initial") {
                setShowNewIndicator(false);
                const total = sections().length;
                setVisibleStart(Math.max(0, total - 5));
                setVisibleEnd(total - 1);
                requestAnimationFrame(() => {
                    scrollToBottom(true);
                    updateVirtualWindow();
                });
                return;
            }

            if (update.type === "append") {
                if (scrollLocked()) {
                    scrollToBottom(false);
                } else {
                    setShowScrollButton(true);
                    setUnreadCount(c => c + 1);
                }
            }
            if (update.type === "jump") {
                requestAnimationFrame(() => {
                    const el = scrollEl?.querySelector(`[data-id="${update.targetId}"]`);
                    if (el) el.scrollIntoView({
                        block: "center",
                        behavior: "auto"
                    });
                });
            }

            if (update.type === "reset") {
                requestAnimationFrame(() => scrollToBottom(true));
            }
        })
    );
    const renderOverlay = state.settings.profileOverlays;

    return (
        <>
                <div className="realchannelcontent">
      <Show when={props.onBack}>
        <div class="forum-thread-header">
          <button class="forum-back-btn x" onClick={props.onBack}>
            <HiOutlineChevronLeft/> Back
          </button>
        </div>
      </Show>
       <Show when={showScrollButton()}>
        <button class="scroll-to-bottom-btn" onClick={() => {
            scrollToBottom();
          }}> 
        <HiOutlineChevronDown/>
        <Show when={unreadCount() > 0}>
          <span class="badge">{unreadCount()}</span>
        </Show>
       </button>
      </Show>
      <div ref={(el) => { scrollEl = el; }} class="vml-scroll" onScroll={onScroll}>
     
        <Show when={!hasOlderMessages() && messages().length}>
          <div class="vml-beginning">You've reached the beginning.</div>
        </Show>
        <div class="vml-inner">
          <div style={{ height: `${topSpacerHeight()}px` }} />
          <For each={sections().slice(visibleStart(), visibleEnd() + 1)}>
            {(section) => (
              <div ref={(el) => { new ResizeObserver(() => {
                sectionHeights.set(section.id, el.offsetHeight);
                updateVirtualWindow();
              });}}>
                <For each={section.messages}>
                  {(message, index) => {
                    const msg = () => message;
                    const previous = index() > 0 ? section.messages[index() - 1] : null;
                    const interaction = msg()?.interaction;
                    const grouped = previous && previous.user === message.user;
                    const replyMessage = msg()?.reply_to
                      ? section.messages.find(m => m.id === msg().reply_to.id)
                      : null;
                    return (
                      <div
                        attr:data-index={index()}
                        attr:data-id={msg()?.id}
                        data-context="message" 
                        classList={{
                          "vml-item": true,
                          "is-grouped": grouped,
                          "is-reply-target": state.replying?.id === msg()?.id,
                          "is-edit-target": state.editing?.id === msg()?.id,
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
  avatar={msg()?.avatar ?? `https://avatars.rotur.dev/${msg()?.user}`}
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
  renderOverlay={renderOverlay}
  reactions={msg().reactions}
  attachments={msg()?.attachments}
  embeds={msg().embeds}
  grouped={grouped && !replyMessage && !interaction}
  interaction={interaction}
  reply={replyMessage}
  fake={msg().__fake}
  deleted={msg()?.deleted}
  editing={state.editing?.id === msg()?.id}
  onDismiss={() =>
    setFakeMessages(messages =>
      messages.filter(m => m.id !== msg().id)
    )
  }
/>
                      </div>
                    );
                  }}
                </For>
              </div>
            )}
          </For>
          <div style={{ height: `${bottomSpacerHeight()}px` }} />
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
            position: "absolute",
            top: `${hoverRect().top - 60}px`,
            right: `25px`,
            "z-index": 100,
          }}
        >
          <MessageActions
            content={hoveredMessage().content}
            canEdit={hoveredMessage().user === tempState?.conn?.me()?.username}
            canDelete={hoveredMessage().user === tempState?.conn?.me()?.username}
            onReply={() => {
              tempState.virtMsgList.scrollToMessage(hoveredMessage().id);
              setState("replying", {
                id: hoveredMessage().id,
                user: hoveredMessage().user,
                content: hoveredMessage().content,
              });
            }}
            onEdit={() => {
              tempState.virtMsgList.scrollToMessage(hoveredMessage().id);
              setState("editing", {
                id: hoveredMessage().id,
                user: hoveredMessage().user,
                content: hoveredMessage().content,
              });
            }}
            onDelete={() => tempState.conn.send({
              "cmd": "message_delete",
              "id": hoveredMessage().id,
              "channel": state.current.channel,
            })}
            onReact={() => console.log("react", hoveredMessage())}
          />
        </div>
      </Show>
      </div>
    </>
    );
}