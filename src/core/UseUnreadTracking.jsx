import { createSignal, createEffect, batch, on } from "solid-js";

export function createUnreadTracking() {
  const [readState, setReadState] = createSignal({});

  const getLastReadId = (channel) => {
    return readState()[channel]?.lastReadId ?? null;
  };

  const getLastReadTimestamp = (channel) => {
    return readState()[channel]?.lastReadTimestamp ?? 0;
  };

  const getUnreadCount = (channel) => {
    return readState()[channel]?.unreadCount ?? 0;
  };

  const markAsRead = (channel, messageId, timestamp) => {
    setReadState((prev) => ({
      ...prev,
      [channel]: {
        lastReadId: messageId,
        lastReadTimestamp: timestamp,
        unreadCount: 0,
      },
    }));
  };

  const addUnread = (channel) => {
    setReadState((prev) => ({
      ...prev,
      [channel]: {
        ...(prev[channel] ?? { lastReadId: null, lastReadTimestamp: 0 }),
        unreadCount: (prev[channel]?.unreadCount ?? 0) + 1,
      },
    }));
  };

  const isUnread = (channel, messageId, timestamp) => {
    const state = readState()[channel];
    if (!state?.lastReadId) return true;

    return timestamp > state.lastReadTimestamp;
  };

  const resetChannel = (channel) => {
    setReadState((prev) => {
      const updated = { ...prev };
      delete updated[channel];
      return updated;
    });
  };

  return {
    readState,
    getLastReadId,
    getLastReadTimestamp,
    getUnreadCount,
    markAsRead,
    addUnread,
    isUnread,
    resetChannel,
  };
}
