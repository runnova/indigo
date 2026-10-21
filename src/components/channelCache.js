export const PAGE_SIZE = 20;

const MAX_ENTRIES = 8;
const MAX_CACHED_MESSAGES = 150;

const cache = new Map();
const pending = new Map();

export const cacheKey = (src, channel) =>
  src && channel ? `${src}::${channel}` : null;

export function normalizeMessage(m) {
  return { ...m, id: m.id ?? `system-${m.timestamp}-${m.user}` };
}

export function sortMessages(msgs) {
  return [...(msgs ?? [])]
    .filter(Boolean)
    .map(normalizeMessage)
    .sort((a, b) => {
      const ta = Number(a.timestamp);
      const tb = Number(b.timestamp);
      if (ta !== tb) return ta - tb;
      return String(a.id).localeCompare(String(b.id));
    });
}

export function getCached(key) {
  const entry = key && cache.get(key);
  if (!entry) return null;
  cache.delete(key); // LRU touch
  cache.set(key, entry);
  return entry;
}

export function setCached(key, messages, hasOlder) {
  if (!key) return;
  if (messages.length > MAX_CACHED_MESSAGES) {
    messages = messages.slice(-MAX_CACHED_MESSAGES);
    hasOlder = true;
  }
  cache.delete(key);
  cache.set(key, { messages, hasOlder });
  while (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value);
}

export function invalidate(key) {
  if (key) cache.delete(key);
}

export function invalidateServer(src) {
  if (!src) return;
  for (const key of [...cache.keys()]) {
    if (key.startsWith(`${src}::`)) cache.delete(key);
  }
}

export function clearCache() {
  cache.clear();
}

/** Ask the server for a channel's latest page; resolves once the pump stores it. */
export function preload(key, request) {
  if (!key) return Promise.resolve([]);
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit.messages);
  if (pending.has(key)) return pending.get(key).promise;

  let resolve;
  const promise = new Promise((r) => (resolve = r));
  const timer = setTimeout(() => {
    pending.delete(key);
    resolve([]);
  }, 5000);
  pending.set(key, { promise, resolve, timer });

  request();
  return promise;
}

export function applyEventToCache(key, event, { messageLogger = false } = {}) {
  if (!key || !event?.cmd) return;

  if (event.cmd === "messages_get") {
    const list = event.val ?? event.messages ?? [];
    setCached(key, sortMessages(list), list.length >= PAGE_SIZE);
    const p = pending.get(key);
    if (p) {
      clearTimeout(p.timer);
      pending.delete(key);
      p.resolve(cache.get(key).messages);
    }
    return;
  }

  const entry = cache.get(key);
  if (!entry) return;
  let msgs = entry.messages;

  switch (event.cmd) {
    case "message_new": {
      const m = event.message ?? event.val ?? event.data;
      if (!m || m.id == null) return;
      const i = msgs.findIndex((x) => x.id === m.id);
      if (i !== -1) {
        msgs = msgs.slice();
        msgs[i] = m;
      } else {
        msgs = [...msgs, m];
        if (msgs.length > MAX_CACHED_MESSAGES) {
          msgs = msgs.slice(-MAX_CACHED_MESSAGES);
          entry.hasOlder = true;
        }
      }
      break;
    }
    case "message_edit": {
      if (event.id == null) return;
      const inc = event.message ?? event.val ?? event.data ?? {};
      msgs = msgs.map((m) =>
        m.id !== event.id
          ? m
          : {
              ...m,
              content: inc.content ?? m.content,
              attachments: inc.attachments ?? m.attachments ?? [],
              embeds: inc.embeds ?? m.embeds ?? [],
              edited: true,
              edited_by: inc.edited_by ?? null,
              author_id: inc.author_id ?? null,
              key_id: inc.key_id ?? null,
              signature: inc.signature ?? null,
              signed_at: inc.signed_at ?? null,
            },
      );
      break;
    }
    case "message_delete": {
      if (event.id == null) return;
      msgs = messageLogger
        ? msgs.map((m) => (m.id === event.id ? { ...m, deleted: true } : m))
        : msgs.filter((m) => m.id !== event.id);
      break;
    }
    case "reaction_add": {
      if (event.id == null) return;
      msgs = msgs.map((m) =>
        m.id !== event.id
          ? m
          : {
              ...m,
              reactions: {
                ...m.reactions,
                [event.emoji]: [...(m.reactions?.[event.emoji] ?? []), event.from],
              },
            },
      );
      break;
    }
    default:
      return;
  }

  entry.messages = msgs;
}
