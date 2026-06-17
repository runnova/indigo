import { createSignal, createEffect, on, batch } from "solid-js";

const PAGE_SIZE = 20;
const LOAD_OLDER_COOLDOWN_MS = 500;

const MAX_MESSAGES = 200;
const TRIM_TO = 150;

function sortMessages(msgs) {
  return [...msgs].sort((a, b) => {
    const ta = Number(a.timestamp);
    const tb = Number(b.timestamp);

    if (ta !== tb) return ta - tb;

    return a.id.localeCompare(b.id);
  });
}

function mergeMessages(existing, incoming) {
  const map = new Map(existing.map((m) => [m.id, m]));
  for (const m of incoming) map.set(m.id, m);
  return sortMessages([...map.values()]);
}

export function createChannelMessages({
  channel,
  wsEvent,
  sendRequest,
  getScrollElement,
  isNearBottom,
}) {
  const [messages, setMessages] = createSignal([]);
  const [loadingOlder, setLoadingOlder] = createSignal(false);
  const [hasOlderMessages, setHasOlderMessages] = createSignal(true);
  const [lastUpdate, setLastUpdate] = createSignal(null);

  let loadingOlderLock = false;
  let lastLoadTime = 0;
  let pendingDirection = null;
  let pendingAnchorId = null;

  function request(payload) {
    sendRequest({ ...payload, channel: channel() });
  }

  function oldestId() {
    const msgs = messages();
    return msgs.length ? msgs[0].id : null;
  }

  function fetchInitial() {
    request({ cmd: "messages_get", limit: PAGE_SIZE });
  }

  function loadOlder() {
    const now = Date.now();
    if (now - lastLoadTime < LOAD_OLDER_COOLDOWN_MS) return;
    if (loadingOlderLock || loadingOlder() || !hasOlderMessages()) return;

    const anchor = oldestId();
    if (!anchor) return;

    lastLoadTime = now;
    loadingOlderLock = true;
    pendingDirection = "older";
    pendingAnchorId = anchor;
    setLoadingOlder(true);

    request({
      cmd: "messages_around",
      around: anchor,
      direction: "older",
      limit: PAGE_SIZE,
    });
  }

  function jumpToMessage(id) {
    pendingDirection = "jump";
    pendingAnchorId = id;

    request({
      cmd: "messages_around",
      around: id,
      bounds: { above: 50, below: 50 },
    });
  }

  function handleMessagesGet(event) {
    const sorted = sortMessages(event.messages);
    setMessages(sorted);
    setHasOlderMessages(event.messages.length >= PAGE_SIZE);
    setLastUpdate({ type: "initial" });
  }

  function handleMessagesAround(event) {
    const incoming = sortMessages(event.messages);
    const direction = pendingDirection;
    const targetId = pendingAnchorId;

    pendingDirection = null;
    pendingAnchorId = null;
    const scrollEl = direction === "older" ? getScrollElement?.() : null;
    const heightBefore = scrollEl ? scrollEl.scrollHeight : null;

    batch(() => {
      setMessages((prev) => mergeMessages(prev, incoming));
      if (direction === "older") {
        setHasOlderMessages(incoming.length >= PAGE_SIZE);
      }
      setLoadingOlder(false);
    });
    loadingOlderLock = false;

    if (direction === "older" && scrollEl && heightBefore != null) {
      requestAnimationFrame(() => {
        const delta = scrollEl.scrollHeight - heightBefore;
        scrollEl.scrollTop += delta;
      });
      setLastUpdate({ type: "prepend" });
    } else if (direction === "jump") {
      setLastUpdate({ type: "jump", targetId });
    }
  }

  function handleMessageNew(event) {
    const merged = mergeMessages(messages(), [event.message]);
    const overflowing = merged.length > MAX_MESSAGES && isNearBottom?.();
    const next = overflowing ? merged.slice(merged.length - TRIM_TO) : merged;

    batch(() => {
      setMessages(next);
      if (overflowing) setHasOlderMessages(true);
    });

    setLastUpdate({ type: "append", message: event.message });
  }

  function handleEvent(event) {
    if (!event || event.channel !== channel()) return;

    if (event.cmd === "messages_get") return handleMessagesGet(event);
    if (event.cmd === "messages_around") return handleMessagesAround(event);
    if (event.cmd === "message_new") return handleMessageNew(event);
  }

  createEffect(
    on(channel, () => {
      setMessages([]);
      setHasOlderMessages(true);
      setLastUpdate(null);
      pendingDirection = null;
      pendingAnchorId = null;
      loadingOlderLock = false;
      fetchInitial();
    })
  );

  createEffect(() => {
    handleEvent(wsEvent());
  });

  return {
    messages,
    loadingOlder,
    hasOlderMessages,
    lastUpdate,
    loadOlder,
    jumpToMessage,
  };
}