import { tempState, state, setState } from "../App";

let clockOffset = 0;
let lastRtt = null;
let smoothedRtt = null;

export function updateClockOffset(serverTime, roundTripStart) {
  const roundTripTime = Date.now() - roundTripStart;
  if (roundTripTime < 0 || roundTripTime > 10000) return;

  const estimatedServerNowMs = serverTime + roundTripTime / 2;
  const newOffset = estimatedServerNowMs - Date.now();

  if (smoothedRtt === null) {
    clockOffset = newOffset;
    smoothedRtt = roundTripTime;
  } else {
    const alpha = 0.3;
    smoothedRtt = smoothedRtt * (1 - alpha) + roundTripTime * alpha;

    const quality = Math.max(0.15, Math.min(1, smoothedRtt / Math.max(roundTripTime, 1)));
    clockOffset = clockOffset * (1 - quality) + newOffset * quality;
  }
  lastRtt = roundTripTime;
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

function getEstimatedServerTime() {
  return (Date.now() + clockOffset) / 1000;
}

function hasCapability(name) {
  return !!tempState?.conn?.serverInfo()?.capabilities?.includes(name);
}

function getSigningUrl() {
  return tempState?.conn?.serverInfo()?.signing_url;
}

export async function signMessageNew(payload, timestamp, signingUrl) {
  const content = typeof payload.content === "string" ? payload.content : "";
  const attachments = Array.isArray(payload.attachments) ? payload.attachments : [];
  const proof = await tempState.rotur.signing.sign((authorId) => [
    "originchats.message.v1",
    authorId,
    content,
    attachments,
    timestamp,
    signingUrl,
  ]);
  return { ...payload, timestamp, signed_at: timestamp, ...proof };
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
    const timestamp = getEstimatedServerTime();
    const signingUrl = getSigningUrl();
    try {
      const signed = await signMessageNew(basePayload, timestamp, signingUrl);
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
    const timestamp = getEstimatedServerTime();
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
