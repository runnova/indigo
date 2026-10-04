import { createStore } from "solid-js/store";
import { sendMessage } from "./useMessageSigning";

const [pending, setPending] = createStore([]);
export const pendingMessages = pending;

const ACK_TIMEOUT_MS = 20000;
let counter = 0;
let flushing = false;

export function enqueue(data) {
  const id = `pending-${++counter}`;
  setPending((list) => [
    ...list,
    {
      id,
      status: "queued",
      timestamp: Math.floor(Date.now() / 1000),
      reactions: [],
      attachments: [],
      embeds: [],
      ...data,
    },
  ]);
  return id;
}

export function removePending(id) {
  setPending((list) => list.filter((m) => m.id !== id));
}

export function retryPending(id) {
  setPending((m) => m.id === id, "status", "queued");
}

export function resolvePending(message, channel) {
  if (!message) return;
  const match = pending.find(
    (p) =>
      p.status !== "queued" &&
      p.channel === channel &&
      p.user === message.user &&
      p.content === message.content,
  );
  if (match) removePending(match.id);
}

function armTimeout(id) {
  setTimeout(() => {
    const item = pending.find((m) => m.id === id);
    if (item?.status === "sending") {
      setPending((m) => m.id === id, "status", "failed");
    }
  }, ACK_TIMEOUT_MS);
}

export async function flushQueue(canSend) {
  if (flushing) return;
  flushing = true;
  try {
    for (;;) {
      const next = pending.find((m) => m.status === "queued");
      if (!next || !canSend(next)) break;

      setPending((m) => m.id === next.id, "status", "sending");
      try {
        await sendMessage(next.content, next.attachments);
        armTimeout(next.id);
      } catch (err) {
        console.error("send failed", err);
        setPending((m) => m.id === next.id, "status", "failed");
      }
    }
  } finally {
    flushing = false;
  }
}
