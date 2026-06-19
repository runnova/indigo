import { createSignal, createEffect, on, batch } from "solid-js";
import { produce } from "solid-js/store";
import { unreads, setUnreads } from "./App";

const PAGE_SIZE = 20;
const LOAD_OLDER_COOLDOWN_MS = 500;

const MAX_MESSAGES = 200;
const TRIM_TO = 150;

function sortMessages(msgs) {
  return [...(msgs ?? [])]
    .filter((m) => m && m.id != null)
    .sort((a, b) => {
      const ta = Number(a.timestamp);
      const tb = Number(b.timestamp);

      if (ta !== tb) return ta - tb;

      return String(a.id).localeCompare(String(b.id));
    });
}

function handleUnreadEvent(event) {
  if (event.cmd === "unreads_get") {
    setUnreads(event.unreads);
  }

  if (event.cmd === "unreads_update") {
    setUnreads(
      event.channel,
      produce(channel => {
        if (!channel) return;

        channel.last_read = event.last_read;
        channel.unread_count = 0;
      })
    );
  }

  if (event.cmd === "unreads_ack") {
    setUnreads(
      event.channel,
      produce(channel => {
        if (!channel) return;

        channel.last_read = event.message_id;
        channel.unread_count = 0;
      })
    );
  }
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
    setHasOlderMessages((event.messages?.length ?? 0) >= PAGE_SIZE);
    setLastUpdate({ type: "initial" });
  }

  function handleMessagesAround(event) {
    const incoming = sortMessages(event.messages);
    const direction = pendingDirection;
    const targetId = pendingAnchorId;

    pendingDirection = null;
    pendingAnchorId = null;

    const scrollEl = direction === "older" ? getScrollElement?.() : null;
    const heightBefore = scrollEl?.scrollHeight ?? null;

    batch(() => {
      setMessages((prev) => {
        const map = new Map(prev.map((m) => [m.id, m]));

        for (const m of incoming) {
          map.set(m.id, m);
        }

        return [...map.values()].sort((a, b) => {
          const ta = Number(a.timestamp);
          const tb = Number(b.timestamp);

          if (ta !== tb) return ta - tb;
          return String(a.id).localeCompare(String(b.id));
        });
      });

      if (direction === "older") {
        setHasOlderMessages(incoming.length >= PAGE_SIZE);
        setLoadingOlder(false);
      }
    });

    loadingOlderLock = false;

    if (direction === "older" && scrollEl && heightBefore != null) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const delta = scrollEl.scrollHeight - heightBefore;
          scrollEl.scrollTop += delta;
        });
      });

      setLastUpdate({ type: "prepend" });
    }

    if (direction === "jump") {
      setLastUpdate({
        type: "jump",
        targetId,
      });
    }
  }

  function handleMessageNew(event) {
    const incomingMessage = event.message ?? event.val ?? event.data ?? null;

    if (!incomingMessage || incomingMessage.id == null) return;

    batch(() => {
      setMessages((prev) => {
        const existingIndex = prev.findIndex(
          (m) => m.id === incomingMessage.id
        );

        if (existingIndex !== -1) {
          const next = prev.slice();
          next[existingIndex] = incomingMessage;
          return next;
        }

        const next = [...prev, incomingMessage];

        let trimmed = false;

        setMessages((prev) => {
          const next = [...prev, incomingMessage];

          if (next.length > MAX_MESSAGES && isNearBottom?.()) {
            trimmed = true;
            return next.slice(-TRIM_TO);
          }

          return next;
        });

        if (trimmed) {
          setLastUpdate({ type: "reset" });
        }

        return next;
      });
    });

    setLastUpdate({
      type: "append",
      message: incomingMessage,
    });
  }

  function handleEvent(event) {
    if (!event) return;

    if (
      event.cmd === "unreads_get" ||
      event.cmd === "unreads_update" ||
      event.cmd === "unreads_ack"
    ) {
      handleUnreadEvent(event);
      return;
    }

    if (event.channel !== channel()) return;

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