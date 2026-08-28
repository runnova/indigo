import { tempState, state, setState } from "../App";

let clockOffset = 0;

let serverAnchor = null;
let monotonicAnchor = null;
let lastRtt = null;

let smoothedRtt = null;

export function initializeServerClock(serverTime) {
  serverAnchor = Number(serverTime);
  monotonicAnchor = performance.now();
  clockOffset = 0;
}

export function updateClockOffset(serverTime, roundTripStart) {
  const now = performance.now();
  const roundTripTime = now - roundTripStart;

  if (roundTripTime < 0 || roundTripTime > 10000) return;
  if (serverAnchor === null || monotonicAnchor === null) return;

  const estimatedServerNow =
    Number(serverTime) + roundTripTime / 2000;

  const localEstimatedServerNow =
    serverAnchor +
    (now - monotonicAnchor) / 1000 +
    clockOffset;

  const newOffset =
    estimatedServerNow - localEstimatedServerNow;

  if (smoothedRtt === null) {
    smoothedRtt = roundTripTime;
  } else {
    const alpha = 0.3;
    smoothedRtt =
      smoothedRtt * (1 - alpha) +
      roundTripTime * alpha;
  }

  const alpha = 0.3;
  clockOffset =
    clockOffset * (1 - alpha) +
    newOffset * alpha;

  lastRtt = roundTripTime;
}

export function getServerTime() {
  if (serverAnchor === null || monotonicAnchor === null) {
    return Date.now() / 1000;
  }

  return (
    serverAnchor +
    (performance.now() - monotonicAnchor) / 1000 +
    clockOffset
  );
}

export function getLastRtt() {
  return lastRtt;
}

export function sendPing() {
  if (!hasCapability("ping") && tempState?.conn?.status?.() !== "ready") return;
  const sentAt = Date.now();
  tempState.conn.send({ cmd: "ping", sent_at: sentAt / 1000 });
  return sentAt;
}

function hasCapability(name) {
  return !!tempState?.conn?.serverInfo()?.capabilities?.includes(name);
}

function getSigningUrl() {
  return tempState?.conn?.serverInfo()?.signing_url;
}

export async function signMessageNew(payload, signedAt, signingUrl) {
  const content = typeof payload.content === "string" ? payload.content : "";
  const attachments = Array.isArray(payload.attachments) ? payload.attachments : [];

  const proof = await tempState.rotur.signing.sign((authorId) => [
    "originchats.message.v1",
    authorId,
    content,
    attachments,
    signedAt,
    signingUrl,
  ]);

  return { ...payload, timestamp: signedAt, signed_at: signedAt, ...proof };
}

export async function signSlashCall(payload, timestamp, signingUrl) {
  const nonce = crypto.randomUUID();
  const proof = await tempState.rotur.signing.sign((authorId) => [
    "originchats.slash.v1",
    authorId,
    payload.command,
    payload.args,
    timestamp,
    signingUrl,
    nonce,
  ]);
  return { ...payload, timestamp, nonce, ...proof };
}

export async function sendMessage(content, attachments) {
  const basePayload = {
    cmd: "message_new",
    channel: state.current.channel,
    ...(state.current.thread?.id && { thread_id: state.current.thread.id }),
    content,
    attachments,
    ...(state.replying && { reply_to: state.replying.id }),
  };
  if (hasCapability("message_signatures_v1")) {
    const timestamp = getServerTime();
    const signingUrl = getSigningUrl();
    try {
      const signed = await signMessageNew(basePayload, timestamp, signingUrl);
      console.log("OUTGOING SIGNED", {
        timestamp: signed.timestamp,
        signed_at: signed.signed_at,
      });
      tempState.conn.send(signed);
    } catch (error) {
      console.error("Failed to sign message:", error);
      tempState.conn.send(basePayload);
    }
  } else {
    tempState.conn.send(basePayload);
  }
  if (state.replying) {
    setState("replying", null);
  }
}

export async function sendSlashCall(command, args) {
  const basePayload = {
    cmd: "slash_call",
    command: command.name,
    channel: state.current.channel,
    args,
  };
  if (hasCapability("slash_signatures_v1")) {
    const timestamp = getServerTime();
    const signingUrl = getSigningUrl();
    try {
      const signed = await signSlashCall(basePayload, timestamp, signingUrl);
      tempState.conn.send(signed);
    } catch (error) {
      console.error("Failed to sign slash command:", error);
      tempState.conn.send(basePayload);
    }
  } else {
    tempState.conn.send(basePayload);
  }
}
export async function verifyMessage(message) {
  if (
    !message?.author_id ||
    !message?.key_id ||
    !message?.signature ||
    message.signed_at === undefined
  ) {
    return "unsigned";
  }

  const signingUrl = getSigningUrl();

  if (!signingUrl) {
    return "unavailable";
  }

  try {
    const valid = await tempState.rotur.signing.verify(
      {
        author_id: message.author_id,
        key_id: message.key_id,
        signature: message.signature,
        username: message.user,
      },
      [
        "originchats.message.v1",
        message.author_id,
        typeof message.content === "string" ? message.content : "",
        Array.isArray(message.attachments)
          ? message.attachments
          : [],
        message.signed_at,
        signingUrl,
      ],
    );

    return valid ? "verified" : "invalid";
  } catch (error) {
    console.error("Failed to verify message:", error);
    return "unavailable";
  }
}
export async function signMessageEdit(payload, signedAt, signingUrl) {
  const content = typeof payload.content === "string" ? payload.content : "";
  const attachments = Array.isArray(payload.attachments) ? payload.attachments : [];

  const proof = await tempState.rotur.signing.sign((authorId) => [
    "originchats.message.v1",
    authorId,
    content,
    attachments,
    signedAt,
    signingUrl,
  ]);

  return { ...payload, timestamp: signedAt, signed_at: signedAt, ...proof };
}

export async function sendMessageEdit(id, edit, current) {
  const nextContent = edit.content ?? current.content;
  const nextAttachments = edit.attachments ?? current.attachments ?? [];

  const basePayload = {
    cmd: "message_edit",
    id,
    channel: state.current.channel,
    content: nextContent,
    attachments: nextAttachments,
  };

  if (hasCapability("message_signatures_v1")) {
    const timestamp = getServerTime();
    const signingUrl = getSigningUrl();
    try {
      const signed = await signMessageEdit(basePayload, timestamp, signingUrl);
      tempState.conn.send(signed);
    } catch (error) {
      console.error("Failed to sign message edit:", error);
      tempState.conn.send(basePayload);
    }
  } else {
    tempState.conn.send(basePayload);
  }
}
