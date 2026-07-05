// channelCache.js
// LRU cache (max 3 entries) for preloaded channel message data.
// Entries not "active" (i.e. not the currently open channel) expire after 1 minute.

const MAX_ENTRIES = 3;
const BACKGROUND_TTL_MS = 60_000;

const cache = new Map(); // key: channelName -> { data, timer, fetchedAt }
const inflight = new Map(); // key: channelName -> Promise (dedupe concurrent preloads)

function touch(name) {
  // refresh recency order for LRU
  const entry = cache.get(name);
  if (!entry) return;
  cache.delete(name);
  cache.set(name, entry);
}

function evictIfNeeded() {
  while (cache.size > MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    clearEntryTimer(oldestKey);
    cache.delete(oldestKey);
  }
}

function clearEntryTimer(name) {
  const entry = cache.get(name);
  if (entry?.timer) {
    clearTimeout(entry.timer);
    entry.timer = null;
  }
}

// Starts (or restarts) the background expiry timer for a channel.
// Call armExpiry(name) whenever a channel becomes "background" (not the active one).
function armExpiry(name) {
  const entry = cache.get(name);
  if (!entry) return;

  clearEntryTimer(name);

  entry.timer = setTimeout(() => {
    cache.delete(name);
  }, BACKGROUND_TTL_MS);
}

// Call disarmExpiry(name) when a channel becomes the active one, so it won't expire
// while in use.
function disarmExpiry(name) {
  clearEntryTimer(name);
}

export function getCached(name) {
  const entry = cache.get(name);
  if (!entry) return null;
  touch(name);
  return entry.data;
}

export function hasCached(name) {
  return cache.has(name);
}

// fetcher: () => Promise<data> — only called if not already cached/inflight
export async function preloadChannel(name, fetcher) {
  if (!name) return null;

  if (cache.has(name)) {
    touch(name);
    return cache.get(name).data;
  }

  if (inflight.has(name)) {
    return inflight.get(name);
  }

  const promise = (async () => {
    try {
      const data = await fetcher();

      cache.set(name, {
        data,
        timer: null,
        fetchedAt: Date.now(),
      });

      evictIfNeeded();
      // newly preloaded channels start as "background" until made active
      armExpiry(name);

      return data;
    } finally {
      inflight.delete(name);
    }
  })();

  inflight.set(name, promise);
  return promise;
}

export function markActive(name) {
  if (!name) return;
  touch(name);
  disarmExpiry(name);
}

export function markBackground(name) {
  if (!name) return;
  if (cache.has(name)) {
    armExpiry(name);
  }
}

export function invalidateChannel(name) {
  clearEntryTimer(name);
  cache.delete(name);
  inflight.delete(name);
}

export function clearCache() {
  for (const name of cache.keys()) {
    clearEntryTimer(name);
  }
  cache.clear();
  inflight.clear();
}