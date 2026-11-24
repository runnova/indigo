import { x25519 } from "@noble/curves/ed25519.js";
import * as oce5 from "./oce5";
import { tempState } from "../App";

const API = "https://api.rotur.dev";
const ENCRYPTED_HOSTS = ["dms.mistium.com", "dms.originchats.com"];
const ME_KEY = "oce5.me";
const TRUST_KEY = "oce5.trust";
const SEEN_KEY = "oce5.seen";
const MAX_SEEN = 5000;
const MAX_SKEW_MS = 10 * 60 * 1000;

const read = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
};

const hostOf = (url) => {
  if (!url) return "";
  try {
    const str = String(url);
    if (!str.includes("://")) {
      return str.split("/")[0].split(":")[0].toLowerCase();
    }
    return new URL(str.replace(/^ws/, "http")).hostname.toLowerCase();
  } catch {
    return "";
  }
};

const serverUrl = () =>
  tempState?.conn?.serverInfo()?.signing_url ??
  tempState?.conn?.serverInfo()?.src ??
  "";

export const isEncryptedServer = (src) => {
  const target = src || serverUrl();
  return ENCRYPTED_HOSTS.includes(hostOf(target));
};

export const isSealedMessage = (message) =>
  typeof message?.content === "string" && oce5.isSealed(message.content);

const getToken = async () => {
  const token =
    (typeof tempState?.rotur?.token === "function"
      ? await tempState.rotur.token()
      : tempState?.rotur?.token) ||
    JSON.parse(localStorage.getItem("settings") || "{}")?.token;
  if (!token) throw new Error("No Rotur token with encryption:keys");
  return token;
};

const roturError = async (res, what) =>
  new Error((await res.json().catch(() => null))?.error ?? what);

async function publishKey() {
  const token = await getToken();
  const username = tempState?.conn?.me?.()?.username;

  if (!username) throw new Error("Unable to determine username");

  const privateKey = x25519.utils.randomSecretKey();
  const publicKey = x25519.getPublicKey(privateKey);

  const res = await fetch(
    `${API}/v2/users/${encodeURIComponent(username)}/encryption-keys`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        public_key: oce5.b64encode(publicKey),
        algorithm: "X25519",
        name: "originChats web",
      }),
    }
  );

  if (!res.ok) throw await roturError(res, "Rotur didn't take the key");

  const { user_id, created_at } = await res.json();

  write(ME_KEY, {
    userId: user_id,
    privateKey: oce5.b64encode(privateKey),
    publicKey: oce5.b64encode(publicKey),
    createdAt: created_at,
    acceptedKeys: [],
  });
}

async function loadMe() {
  if (!read(ME_KEY, null)) await publishKey();
  const stored = read(ME_KEY, null);
  return {
    userId: stored.userId,
    privateKey: oce5.b64decode(stored.privateKey),
    publicKey: oce5.b64decode(stored.publicKey),
    createdAt: stored.createdAt,
    acceptedKeys: (stored.acceptedKeys ?? []).map((key) => oce5.b64decode(key)),
  };
}

let mePromise = null;

export function getMe() {
  mePromise ??= loadMe().catch((error) => {
    mePromise = null;
    throw error;
  });
  return mePromise;
}

async function keysOf(username) {
  const res = await fetch(`${API}/v2/users/${encodeURIComponent(username)}/encryption-keys`);
  if (!res.ok) throw new Error(`Rotur couldn't list ${username}'s keys`);

  const list = await res.json();
  if (list.username.toLowerCase() !== username.toLowerCase()) throw new Error("Not who we asked for");

  const keys = [];
  for (const key of list.keys) {
    try {
      const publicKey = oce5.b64decode(key.public_key);
      if (oce5.usable(publicKey) && (await oce5.keyId(publicKey)) === key.key_id) keys.push(publicKey);
    } catch {}
  }
  return { userId: list.user_id, keys };
}

async function senderOf(content, user) {
  const id = oce5.senderKeyId(content);

  const res = await fetch(
    `${API}/v2/users/${encodeURIComponent(user)}/encryption-keys/${encodeURIComponent(id)}`
  );

  if (res.status === 410) {
    throw new Error("The key it was sent with was revoked");
  }

  if (!res.ok) {
    throw new Error("Rotur doesn't know the key it was sent with");
  }

  const key = await res.json();
  const publicKey = oce5.b64decode(key.public_key);

  if (
    (await oce5.keyId(publicKey)) !== id ||
    !key.user_id ||
    key.revoked_at ||
    !oce5.usable(publicKey)
  ) {
    throw new Error("Rotur's answer isn't the key it was sent with");
  }

  return {
    userId: key.user_id,
    username: key.username,
    publicKey
  };
}

const knownIds = (userId) => read(TRUST_KEY, {})[userId] ?? [];

function remember(userId, ids) {
  const trust = read(TRUST_KEY, {});
  trust[userId] = [...new Set([...(trust[userId] ?? []), ...ids])];
  write(TRUST_KEY, trust);
}

function otherMembers() {
  const myName = tempState?.conn?.me?.()?.username?.toLowerCase();
  return (tempState?.conn?.members?.() ?? [])
    .map((member) => member.username)
    .filter((name) => name && name.toLowerCase() !== myName);
}

export async function sealOutgoing(text, where) {
  const me = await getMe();
  const readers = [me.publicKey, ...me.acceptedKeys];
  const changed = [];
  const accepted = [];

  for (const name of otherMembers()) {
    const { userId, keys } = await keysOf(name);
    if (keys.length === 0) throw new Error(`${name} hasn't turned on encryption`);

    const ids = await Promise.all(keys.map((key) => oce5.keyId(key)));
    const known = knownIds(userId);
    if (known.length > 0 && ids.some((id) => !known.includes(id))) changed.push(name);

    accepted.push([userId, ids]);
    readers.push(...keys);
  }

  if (changed.length > 0) {
    const proceed = window.confirm(
      `${changed.join(", ")} ${changed.length > 1 ? "have" : "has"} new encryption keys, for example a new device.\n\nSend to the new keys anyway?`,
    );
    if (!proceed) {
      const error = new Error("Cancelled");
      error.cancelled = true;
      throw error;
    }
  }
  for (const [userId, ids] of accepted) remember(userId, ids);

  const body = { text, sentAt: Date.now(), files: [] };
  const context = { sender: me.userId, ...where };
  const content = await oce5.seal(body, me.privateKey, me.publicKey, readers, context);
  if ([...content].length > 2000) throw new Error("too long to encrypt, shorten or split it");
  return content;
}

async function inspect(message, sender, nonce, body) {
  const warnings = [];

  const keyId = await oce5.keyId(sender.publicKey);
  const known = knownIds(sender.userId);
  if (known.length > 0 && !known.includes(keyId)) {
    warnings.push("Sent with a key you haven't seen from this person before");
  }
  remember(sender.userId, [keyId]);

  const nonceText = typeof nonce === "string" ? nonce : oce5.b64encode(nonce);
  const seen = read(SEEN_KEY, {});
  if (seen[nonceText] && seen[nonceText] !== String(message.id)) {
    warnings.push("This is a replay of another message");
  } else {
    seen[nonceText] = String(message.id);
    const names = Object.keys(seen);
    for (const name of names.slice(0, Math.max(0, names.length - MAX_SEEN))) delete seen[name];
    write(SEEN_KEY, seen);
  }

  const raw = Number(message.timestamp);
  const serverMs = raw < 1e12 ? raw * 1000 : raw;
  if (Number.isFinite(serverMs) && Math.abs(body.sentAt - serverMs) > MAX_SKEW_MS) {
    warnings.push("Its sent time is far from the server's time");
  }

  return warnings;
}

export async function openIncoming(message, where, signed) {
  const sealed = message.content;

  try {
    const me = await getMe();
    const sender = await senderOf(sealed, message.author_id ?? message.user.toLowerCase());
    if (message.author_id && message.author_id !== sender.userId) {
      throw new Error("Sent with someone else's key");
    }

    const context = { sender: sender.userId, ...where };
    const { body, nonce } = await oce5.open(sealed, me.privateKey, me.publicKey, sender.publicKey, context);
    const warnings = await inspect(message, sender, nonce, body);
    const theirs = sender.username.toLowerCase() === message.user.toLowerCase();

    if (signed && theirs) {
      return { ...message, sealed, content: body.text, e2ee: { state: "ok", warnings } };
    }
    return {
      ...message,
      sealed,
      content: "🔒 Hidden: this message isn't validly signed",
      e2ee: { state: "untrusted", reveal: body.text, warnings },
    };
  } catch (error) {
    return {
      ...message,
      sealed,
      content: `🔒 Can't decrypt this message: ${error.message}`,
      e2ee: { state: "failed", warnings: [] },
    };
  }
}
