function b64urlDecode(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function b64urlEncode(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function prepNumbers(value) {
  if (Array.isArray(value)) return value.map(prepNumbers);
  if (value !== null && typeof value === "object") {
    const out = {};
    for (const k of Object.keys(value)) out[k] = prepNumbers(value[k]);
    return out;
  }
  return value;
}

function canonicalSigningValue(value) {
  if (Array.isArray(value)) return value.map(canonicalSigningValue);
  if (value !== null && typeof value === "object") {
    const sortedKeys = Object.keys(value).sort();
    const out = {};
    for (const k of sortedKeys) {
      const item = value[k];
      if (item !== undefined) out[k] = canonicalSigningValue(item);
    }
    return out;
  }
  return value;
}

function signingBytes(value) {
  const canon = canonicalSigningValue(prepNumbers(value));
  const serialized = JSON.stringify(canon);
  return new TextEncoder().encode(serialized);
}

class RoturSigner {
  constructor(keyJson, serverTimestamp, serverUrl) {
    if (!keyJson || !keyJson.private_key_jwk) {
      throw new Error("JSON must contain a 'private_key_jwk' field");
    }
    if (serverTimestamp === undefined || serverTimestamp === null) {
      throw new Error("serverTimestamp must be provided");
    }
    if (!serverUrl) {
      throw new Error("serverUrl must be provided");
    }

    this.serverAnchor = Number(serverTimestamp);
    this.monotonicAnchor = performance.now() / 1000;

    let url = serverUrl;
    if (url.startsWith("ws://")) url = "http://" + url.slice(5);
    else if (url.startsWith("wss://")) url = "https://" + url.slice(6);
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }
    if (url.endsWith("/")) url = url.slice(0, -1);
    this.serverUrl = url;

    this.userId = keyJson.user_id;
    this.keyId = keyJson.key_id;

    this._rawSeed = b64urlDecode(keyJson.private_key_jwk.d);
    this._cryptoKeyPromise = this._importKey();
  }

  async _importKey() {
    return crypto.subtle.importKey(
      "jwk",
      {
        kty: "OKP",
        crv: "Ed25519",
        d: b64urlEncode(this._rawSeed),
        x: undefined,
      },
      { name: "Ed25519" },
      false,
      ["sign"]
    );
  }

  async sign(msgType, content, attachments = [], timestamp = null) {
    const ts =
      timestamp !== null && timestamp !== undefined
        ? timestamp
        : this.serverAnchor + (performance.now() / 1000 - this.monotonicAnchor);

    const messageStructure = [
      msgType,
      this.userId,
      content,
      attachments || [],
      ts,
      this.serverUrl,
    ];

    const messageJson = JSON.stringify(messageStructure);
    const messageBytes = new TextEncoder().encode(messageJson);

    const key = await this._cryptoKeyPromise;
    const sigBuf = await crypto.subtle.sign("Ed25519", key, messageBytes);
    const b64sig = b64urlEncode(new Uint8Array(sigBuf));

    return {
      author_id: this.userId,
      key_id: this.keyId,
      signature: b64sig,
      timestamp: ts,
      server_url: this.serverUrl,
      payload: messageStructure,
    };
  }

  async signedMessage(channel, content, attachments = [], timestamp = null) {
    const signature = await this.sign(
      "originchats.message.v1",
      content,
      attachments,
      timestamp
    );
    return JSON.stringify({
      cmd: "message_new",
      content,
      channel,
      author_id: this.userId,
      key_id: this.keyId,
      signature: signature.signature,
      timestamp: signature.timestamp,
      signed_at: signature.timestamp,
    });
  }
}

export { RoturSigner, signingBytes, b64urlDecode, b64urlEncode };
