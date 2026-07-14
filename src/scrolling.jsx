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
} from "./core/useChannelMessages.jsx";
import {
    tempState,
    state,
    setState,
    setEmojiPicker,
    emojiPicker
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
    let resizeObserver;

    function attachResizeObserver(el) {
    resizeObserver?.disconnect();
    resizeObserver = new ResizeObserver(() => {
        if (scrollLocked()) scrollToBottom(false);
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
    jumpToMessage,
    reload
} = createChannelMessages({
        channel: () => props.channel,
        wsEvent: () => props.wsMessages?.(),
        sendRequest: props.sendRequest,
        getScrollElement: () => scrollEl,
        isNearBottom,
        threadId: () => props.threadId,
    });
    props.onReady?.({
        scrollToMessage,
        scrollToBottom,
        jumpToMessage,
    });

    const messages = createMemo(() => [
        ...realMessages(),
        ...fakeMessages(),
    ]);

    createMessageLookup(messages);

    function stickToBottomThroughMediaLoad() {
    if (!scrollEl) return;
    const media = scrollEl.querySelectorAll('img, video');
    let pending = 0;

    media.forEach(el => {
        const notReady = el.tagName === "IMG" ? !el.complete : el.readyState < 1;
        if (!notReady) return;
        pending++;
        const onLoad = () => {
            pending--;
            if (scrollLocked()) scrollToBottom(false);
            el.removeEventListener("load", onLoad);
            el.removeEventListener("loadeddata", onLoad);
        };
        el.addEventListener("load", onLoad);
        el.addEventListener("loadeddata", onLoad);
    });
}

    const SECTION_SIZE = 15;
    const MAX_SECTIONS = 4;

    const [scrollLocked, setScrollLocked] = createSignal(true);
const [sectionList, setSectionList] = createSignal([]);
function rebuildSectionsFromMessages() {
    const msgs = messages();
    const totalCap = SECTION_SIZE * MAX_SECTIONS;
    let alignedStart;

    if (msgs.length <= totalCap) {
        alignedStart = 0;
    } else if (scrollLocked()) {
        const overflow = msgs.length - totalCap;
        alignedStart = Math.ceil(overflow / SECTION_SIZE) * SECTION_SIZE;
    } else {
        const anchorId = oldestVisibleId();
        const anchorIdx = anchorId ? msgs.findIndex(m => m.id === anchorId) : -1;

        if (anchorIdx === -1) {
            const overflow = msgs.length - totalCap;
            alignedStart = Math.ceil(overflow / SECTION_SIZE) * SECTION_SIZE;
        } else {
            const raw = anchorIdx - SECTION_SIZE;
            const maxStart = msgs.length - totalCap;
            alignedStart = Math.min(
                Math.max(0, Math.floor(raw / SECTION_SIZE) * SECTION_SIZE),
                Math.ceil(maxStart / SECTION_SIZE) * SECTION_SIZE
            );
        }
    }

    const windowed = msgs.slice(alignedStart);
    const prev = sectionList();
    const result = [];
    let i = 0;

    while (i < windowed.length && result.length < MAX_SECTIONS) {
        const chunk = windowed.slice(i, i + SECTION_SIZE);
        const firstId = chunk[0]?.id;
        const lastId = chunk[chunk.length - 1]?.id;

        const existing = prev[result.length];
        const sameShape =
            existing &&
            existing.id === firstId &&
            existing.messages.length === chunk.length &&
            existing.messages[existing.messages.length - 1]?.id === lastId;

        result.push(sameShape ? existing : { id: firstId, messages: chunk });
        i += SECTION_SIZE;
    }

    setSectionList(result);
}

function appendMessageToSections(msg) {
    setSectionList(prev => {
        const last = prev[prev.length - 1];

        if (last && last.messages.length < SECTION_SIZE) {
            const updatedLast = { ...last, messages: [...last.messages, msg] };
            return [...prev.slice(0, -1), updatedLast];
        }

        const next = [...prev, { id: msg.id, messages: [msg] }];
        return next.length > MAX_SECTIONS
            ? next.slice(next.length - MAX_SECTIONS)
            : next;
    });
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
    const [oldestVisibleId, setOldestVisibleId] = createSignal(null);

function onScroll() {
    if (!scrollEl) return;

    const nearBottom = isNearBottom();
    setScrollLocked(nearBottom);
    setShowScrollButton(!nearBottom);
    if (nearBottom) setUnreadCount(0);

    const firstItem = scrollEl.querySelector('[data-context="message"]');
    if (firstItem) setOldestVisibleId(firstItem.getAttribute("data-id"));

    if (scrollEl.scrollTop < SCROLL_NEAR_TOP) loadOlder();
}

    function onVisibilityChange() {
        if (!document.hidden && scrollLocked()) {
            requestAnimationFrame(() => {
                scrollToBottom(false);
            });
        }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);

    onCleanup(() => {
        document.removeEventListener("visibilitychange", onVisibilityChange);
    });
   createEffect(
    on(lastUpdate, (update) => {
        if (!update) return;

    if (update.type === "initial") {
    setShowNewIndicator(false);
    rebuildSectionsFromMessages();
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            scrollToBottom(false);
        });
    });
    return;
}

      if (update.type === "append") {
    appendMessageToSections(update.message);
    if (scrollLocked()) {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                scrollToBottom(false);
                stickToBottomThroughMediaLoad();
            });
        });
    } else {
        setShowScrollButton(true);
        setUnreadCount(c => c + 1);
    }
    return;
}
        rebuildSectionsFromMessages();

        if (update.type === "jump") {
            requestAnimationFrame(() => {
                const el = scrollEl?.querySelector(`[data-id="${update.targetId}"]`);
                if (el) el.scrollIntoView({ block: "center", behavior: "auto" });
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
            reload()
          }}> 
        <HiOutlineChevronDown/>
        <Show when={unreadCount() > 0}>
          <span class="badge">{unreadCount()}</span>
        </Show>
       </button>
      </Show>
     <div ref={(el) => { scrollEl = el; attachResizeObserver(el); }} class="vml-scroll" onScroll={onScroll}>
     
        <Show when={!hasOlderMessages() && messages().length}>
          <div class="vml-beginning">You've reached the beginning.</div>
        </Show>
        <div class="vml-inner">
        <Show when={messages().length === 0}>
            <div class="vml-empty">
            There's nothing here. Send a message?
            </div>
        </Show>
    <For each={sectionList()}>
    {(section) => (
      <div>
        <For each={section.messages}>
          {(message, index) => {
                    const msg = () => message;
                    console.log(44, msg())
                    const ts = Number(msg()?.timestamp);
                    const timestamp = ts > 1e12 ? ts : ts * 1000;
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
                            new Date(timestamp).toLocaleTimeString([], {
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
           onReact={(e) => {
            console.log("send??", hoveredMessage());
            const rect = hoverRect();

            const messageId = hoveredMessage().id;

           setEmojiPicker({
            open: true,
            onSelect: (emoji) => {
                tempState.conn.send({
                cmd: "message_react_add",
                channel: state.current.channel,
                id: messageId,
                emoji
                });
            }
            });
            }
        }
          />
        </div>
      </Show>
      
      </div>
    </>
    );
}