/**
 * originChats encrypted messages, version 5: a complete reader and writer.
 *
 * Needs WebCrypto (browsers, Node 20+, Deno, Bun) and @noble/curves for X25519.
 */
import { x25519 } from "@noble/curves/ed25519.js";

export const NOTICE = "🔒 Encrypted message\n";
export const PREFIX = "oce5.";
const VERSION = 5;
const MAX_FILES = 32;
const subtle = globalThis.crypto.subtle;
const utf8 = new TextEncoder();

// --- bytes and base64url ----------------------------------------------------------------------

export const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) out.set(part, (at += part.length) - part.length);
  return out;
};

const same = (a: Uint8Array, b: Uint8Array) =>
  a.length === b.length && a.reduce((diff, byte, i) => diff | (byte ^ b[i]!), 0) === 0;

const xor = (a: Uint8Array, b: Uint8Array) => a.map((byte, i) => byte ^ b[i]!);

export function b64encode(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Only A-Z a-z 0-9 - _, no padding, and no stray bits: anything else is refused. */
export function b64decode(text: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(text) || text.length % 4 === 1) throw new Error("not base64url");
  const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  const data = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  if (b64encode(data) !== text) throw new Error("not base64url in its one written form");
  return data;
}

const sha256 = async (data: Uint8Array) => new Uint8Array(await subtle.digest("SHA-256", data));

async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await subtle.sign("HMAC", k, data));
}

// --- keys -------------------------------------------------------------------------------------

/** Rotur's id for an encryption key: rotur_ek_ and the first 12 bytes of its SHA-256. */
export const keyId = async (publicKey: Uint8Array) =>
  "rotur_ek_" + b64encode((await sha256(publicKey)).subarray(0, 12));

const keyRef = (id: string) => b64decode(id.slice("rotur_ek_".length));

export async function fingerprint(publicKey: Uint8Array): Promise<string> {
  const hex = [...(await sha256(publicKey)).subarray(0, 20)].map((b) =>
    b.toString(16).padStart(2, "0"),
  );
  return hex.join("").toUpperCase().match(/.{4}/g)!.join(" ");
}

/** Below 2^255 - 19 with the top bit clear: any other spelling names the same point as another key. */
export function isCanonical(publicKey: Uint8Array): boolean {
  if (publicKey.length !== 32 || publicKey[31]! & 0x80) return false;
  const value = publicKey.reduceRight((n, byte) => (n << 8n) | BigInt(byte), 0n);
  return value < 2n ** 255n - 19n;
}

/** Whether a listed key can be sealed for: canonical, and not a low-order point. */
export function usable(publicKey: Uint8Array): boolean {
  try {
    return isCanonical(publicKey) && !!sharedSecret(x25519.utils.randomSecretKey(), publicKey);
  } catch {
    return false;
  }
}

function sharedSecret(privateKey: Uint8Array, publicKey: Uint8Array): Uint8Array {
  if (!isCanonical(publicKey)) throw new Error("unusable key");
  const shared = x25519.getSharedSecret(privateKey, publicKey);
  if (shared.every((b) => b === 0)) throw new Error("unusable key");
  return shared;
}

// --- the pieces every message is made of ------------------------------------------------------

/** A field with its length before it: u32 big-endian, then the bytes. */
export function lp(data: Uint8Array): Uint8Array {
  const out = new Uint8Array(4 + data.length);
  new DataView(out.buffer).setUint32(0, data.length);
  out.set(data, 4);
  return out;
}

export interface Context {
  sender: string;
  server: string;
  channel: string;
  thread?: string;
  replyTo?: string;
}

export const contextBytes = (c: Context) =>
  concat(
    ...["oce5", c.sender, c.server, c.channel, c.thread ?? "", c.replyTo ?? ""].map((f) =>
      lp(utf8.encode(f)),
    ),
  );

/** The 32-byte mask for the content key, and the 32-byte tag key. */
async function readerKeys(
  privateKey: Uint8Array,
  publicKey: Uint8Array,
  nonce: Uint8Array,
  senderRef: Uint8Array,
  readerRef: Uint8Array,
) {
  const ikm = await subtle.importKey("raw", sharedSecret(privateKey, publicKey), "HKDF", false, [
    "deriveBits",
  ]);
  const info = concat(utf8.encode("oce5 reader"), senderRef, readerRef);
  const okm = new Uint8Array(
    await subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: nonce, info }, ikm, 512),
  );
  return { mask: okm.subarray(0, 32), tagKey: okm.subarray(32) };
}

const tag = async (
  tagKey: Uint8Array,
  context: Uint8Array,
  core: Uint8Array,
  ciphertext: Uint8Array,
) =>
  (
    await hmac(
      tagKey,
      concat(utf8.encode("oce5 tag"), await sha256(concat(context, core, ciphertext))),
    )
  ).subarray(0, 16);

const commitment = (contentKey: Uint8Array) =>
  sha256(concat(utf8.encode("oce5 commit"), contentKey));

const frankingTag = (frankingKey: Uint8Array, context: Uint8Array, body: Uint8Array) =>
  hmac(frankingKey, concat(utf8.encode("oce5 frank"), context, body));

// --- the body ---------------------------------------------------------------------------------

export interface File {
  url: string;
  key: Uint8Array; // 32 bytes
  iv: Uint8Array; // 12 bytes
  hash: Uint8Array; // 32 bytes: SHA-256 of the uploaded bytes
  name: string;
  type: string;
  size: number;
  width: number; // 0: not given
  height: number;
}

export interface Body {
  text: string;
  sentAt: number;
  files: File[];
}

function uint(value: number, bytes: 1 | 4 | 8): Uint8Array {
  const out = new Uint8Array(bytes);
  const view = new DataView(out.buffer);
  if (bytes === 1) view.setUint8(0, value);
  else if (bytes === 4) view.setUint32(0, value);
  else view.setBigUint64(0, BigInt(value));
  return out;
}

export function encodeBody(body: Body): Uint8Array {
  const parts = [lp(utf8.encode(body.text)), uint(body.sentAt, 8), uint(body.files.length, 1)];
  for (const f of body.files) {
    parts.push(
      lp(utf8.encode(f.url)),
      f.key,
      f.iv,
      f.hash,
      lp(utf8.encode(f.name)),
      lp(utf8.encode(f.type)),
      uint(f.size, 8),
      uint(f.width, 4),
      uint(f.height, 4),
    );
  }
  return concat(...parts);
}

class Reader {
  at = 0;
  private view: DataView;
  constructor(private data: Uint8Array) {
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  }
  take(n: number): Uint8Array {
    if (n > this.data.length - this.at) throw new Error("damaged");
    return this.data.subarray(this.at, (this.at += n));
  }
  u32(): number {
    this.take(4);
    return this.view.getUint32(this.at - 4);
  }
  u64(): number {
    this.take(8);
    const value = this.view.getBigUint64(this.at - 8);
    if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("damaged");
    return Number(value);
  }
  /** Strict UTF-8 that keeps a leading BOM. */
  text(): string {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(this.take(this.u32()));
  }
}

/** The body at the front of data, and how many bytes it took. */
export function readBody(data: Uint8Array): { body: Body; length: number } {
  const r = new Reader(data);
  const body: Body = { text: r.text(), sentAt: r.u64(), files: [] };
  const count = r.take(1)[0]!;
  if (count > MAX_FILES) throw new Error("damaged");
  for (let i = 0; i < count; i++) {
    const f: File = {
      url: r.text(),
      key: r.take(32),
      iv: r.take(12),
      hash: r.take(32),
      name: r.text(),
      type: r.text(),
      size: r.u64(),
      width: r.u32(),
      height: r.u32(),
    };
    if (body.files.some((other) => other.url === f.url)) throw new Error("damaged");
    body.files.push(f);
  }
  return { body, length: r.at };
}

export function decodeBody(data: Uint8Array): Body {
  const { body, length } = readBody(data);
  if (length !== data.length) throw new Error("damaged");
  return body;
}

// --- padding ----------------------------------------------------------------------------------

export function padme(length: number, floor = 128): number {
  if (length <= floor) return floor;
  const e = Math.floor(Math.log2(length));
  const step = 2 ** (e - (Math.floor(Math.log2(e)) + 1));
  return Math.ceil(length / step) * step;
}

/** Code points in the content, as the DM server counts them. */
export function sealedLength(readers: number, bodyBytes: number): number {
  const total = 1 + 12 + 12 + 32 + 32 + 1 + readers * (12 + 32 + 16) + 32 + bodyBytes + 16;
  return [...(NOTICE + PREFIX)].length + Math.ceil((total * 4) / 3);
}

// --- sealing and opening ----------------------------------------------------------------------

const random = (n: number) => globalThis.crypto.getRandomValues(new Uint8Array(n));

/** Seals body for readers' public keys (include the sender's own). Returns the content. */
export async function seal(
  body: Body,
  senderPrivate: Uint8Array,
  senderPublic: Uint8Array,
  readers: Uint8Array[],
  context: Context,
  maxLength = 2000,
): Promise<string> {
  const ids = await Promise.all(readers.map(keyId));
  readers = readers.filter((_, i) => ids.indexOf(ids[i]!) === i);
  if (readers.length < 1 || readers.length > 255) throw new Error("1 to 255 readers");
  const senderRef = keyRef(await keyId(senderPublic));
  const [nonce, contentKey, frankingKey] = [random(12), random(32), random(32)];
  const encoded = encodeBody(body);
  const ctx = contextBytes(context);

  const entries: Uint8Array[] = [];
  const tagKeys: Uint8Array[] = [];
  for (const publicKey of readers) {
    const readerRef = keyRef(await keyId(publicKey));
    const { mask, tagKey } = await readerKeys(
      senderPrivate,
      publicKey,
      nonce,
      senderRef,
      readerRef,
    );
    entries.push(readerRef, xor(contentKey, mask));
    tagKeys.push(tagKey);
  }

  const core = concat(
    Uint8Array.of(VERSION),
    senderRef,
    nonce,
    await commitment(contentKey),
    await frankingTag(frankingKey, ctx, encoded),
    Uint8Array.of(readers.length),
    ...entries,
  );

  let padded = padme(encoded.length);
  while (padded > encoded.length && sealedLength(readers.length, padded) > maxLength) padded--;
  const plaintext = concat(frankingKey, encoded, new Uint8Array(padded - encoded.length));

  const aes = await subtle.importKey("raw", contentKey, "AES-GCM", false, ["encrypt"]);
  const ciphertext = new Uint8Array(
    await subtle.encrypt(
      { name: "AES-GCM", iv: nonce, additionalData: concat(ctx, core) },
      aes,
      plaintext,
    ),
  );

  const tags = await Promise.all(tagKeys.map((k) => tag(k, ctx, core, ciphertext)));
  return NOTICE + PREFIX + b64encode(concat(core, ...tags, ciphertext));
}

/** Whether content is an encrypted message at all. Anything else is plain text. */
export const isSealed = (content: string) =>
  content.length <= 4096 && /^🔒 Encrypted message\noce5\.[A-Za-z0-9_-]+$/u.test(content);

export function parse(content: string): Uint8Array {
  if (!isSealed(content)) throw new Error("not an encrypted message");
  return b64decode(content.slice((NOTICE + PREFIX).length));
}

/** The ID of the key a message was sent with, to look up on Rotur. */
export const senderKeyId = (content: string) =>
  "rotur_ek_" + b64encode(parse(content).subarray(1, 13));

export interface Opened {
  body: Body;
  /** For the replay check: the same nonce on another message is a replay. */
  nonce: Uint8Array;
  frankingKey: Uint8Array;
  bodyBytes: Uint8Array;
}

export async function open(
  content: string,
  readerPrivate: Uint8Array,
  readerPublic: Uint8Array,
  senderPublic: Uint8Array,
  context: Context,
): Promise<Opened> {
  const data = parse(content);
  const r = new Reader(data);
  if (r.take(1)[0] !== VERSION) throw new Error("another version");
  const [senderRef, nonce, commit, franked] = [r.take(12), r.take(12), r.take(32), r.take(32)];
  const count = r.take(1)[0]!;
  const wraps = Array.from({ length: count }, () => ({ ref: r.take(12), wrap: r.take(32) }));
  const refs = wraps.map(({ ref }) => b64encode(ref));
  if (count === 0 || new Set(refs).size !== count) throw new Error("damaged");
  const core = data.subarray(0, r.at);
  const tags = r.take(16 * count);
  const ciphertext = data.subarray(r.at);

  const mine = keyRef(await keyId(readerPublic));
  const index = refs.indexOf(b64encode(mine));
  if (index < 0) throw new Error("not sealed for this key");

  const ctx = contextBytes(context);
  const { mask, tagKey } = await readerKeys(readerPrivate, senderPublic, nonce, senderRef, mine);
  if (!same(await tag(tagKey, ctx, core, ciphertext), tags.subarray(16 * index, 16 * index + 16))) {
    throw new Error("changed, or not from its sender");
  }
  const contentKey = xor(wraps[index]!.wrap, mask);
  if (!same(await commitment(contentKey), commit))
    throw new Error("changed, or not from its sender");

  const aes = await subtle.importKey("raw", contentKey, "AES-GCM", false, ["decrypt"]);
  const plaintext = new Uint8Array(
    await subtle.decrypt(
      { name: "AES-GCM", iv: nonce, additionalData: concat(ctx, core) },
      aes,
      ciphertext,
    ),
  );
  const frankingKey = plaintext.subarray(0, 32);
  const { body, length } = readBody(plaintext.subarray(32));
  const bodyBytes = plaintext.subarray(32, 32 + length);
  if (plaintext.subarray(32 + length).some((b) => b !== 0)) throw new Error("damaged");
  if (!same(await frankingTag(frankingKey, ctx, bodyBytes), franked))
    throw new Error("changed, or not from its sender");
  return { body, nonce, frankingKey, bodyBytes };
}

/** What a reported message said, if its header commits to it. */
export async function verifyFranking(
  content: string,
  frankingKey: Uint8Array,
  bodyBytes: Uint8Array,
  context: Context,
): Promise<Body | null> {
  const data = parse(content);
  if (data[0] !== VERSION || data.length < 89) return null;
  if (
    !same(await frankingTag(frankingKey, contextBytes(context), bodyBytes), data.subarray(57, 89))
  )
    return null;
  try {
    return decodeBody(bodyBytes);
  } catch {
    return null;
  }
}
