import { tempState, state, setState } from "../App";

let clockOffset = 0;

/**
 * Update the clock offset based on server response round-trip time
 * This keeps the client's estimated server time in sync
 */
export function updateClockOffset(serverTime, roundTripStart) {
  const roundTripTime = Date.now() - roundTripStart;
  const estimatedServerNow = serverTime + roundTripTime / 2;
  clockOffset = estimatedServerNow - Date.now();
}

function getEstimatedServerTime() {
  return Date.now() + clockOffset;
}

function hasCapability(name) {
  return !!tempState?.conn?.handshake?.val?.capabilities?.includes(name);
}

function getSigningUrl() {
  return tempState?.conn?.handshake?.val?.signing_url;
}

/**
 * Sign a message_new payload using Rotur SDK
 * Creates a cryptographic proof that this message came from the current identity
 */
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

  return { ...payload, timestamp, ...proof };
}

/**
 * Sign a slash_call payload using Rotur SDK
 * Includes a nonce to prevent replay attacks
 */
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

/**
 * Send a message with or without signing based on server capabilities
 * If message_signatures_v1 is available, the message will be cryptographically signed
 */
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
      // Fall back to unsigned send on signing failure
      tempState.conn.send(basePayload);
    }
  } else {
    // No signing capability, send unsigned
    tempState.conn.send(basePayload);
  }

  // Clear reply state after sending
  if (state.replying) {
    setState("replying", null);
  }
}

/**
 * Send a slash command with or without signing based on server capabilities
 * If slash_signatures_v1 is available, the command will be cryptographically signed
 */
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
      // Fall back to unsigned send on signing failure
      tempState.conn.send(basePayload);
    }
  } else {
    // No signing capability, send unsigned
    tempState.conn.send(basePayload);
  }
}
