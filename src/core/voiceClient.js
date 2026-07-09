
import { createStore, produce } from "solid-js/store";
import { createSignal, createEffect, on } from "solid-js";
import Peer from "peerjs";

const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

const AUDIO_RETRY_MAX = 5;
const SCREEN_RETRY_MAX = 6;
const RETRY_BASE_MS = 2000;
const RETRY_CAP_MS = 20_000;
const JOIN_FALLBACK_MS = 1_500;
const PEER_TIMEOUT_MS = 30_000;
const MONITOR_INTERVAL_MS = 5_000;
const SPEAKING_THRESHOLD = 6;

const STORAGE_VOLUMES = "voice_userVolumes";
const STORAGE_MUTES = "voice_userMutes";

export const [voice, setVoice] = createStore({
  channel: null,
  server: null, 
  joining: false,
  error: null,
  muted: false,
  deafened: false,
  speaking: false,
  myPeerId: null,
  isScreenSharing: false,
  participants: {},
  screenStreams: {},
});

const [localScreenStream, setLocalScreenStreamSignal] = createSignal(null);
export { localScreenStream };

let peer = null;
let peerReady = null;
let activeConn = null;
let localAudioStream = null;
let localScreenStreamRaw = null;
let audioCtx = null;

/** @type {Map<string, HTMLAudioElement>} */
const audioEls = new Map();

/** @type {Map<string, object>} */
const peerEntries = new Map();

let localDetector = null;
const remoteDetectors = new Map(); 
let monitorTimer = null;

let userVolumes = loadMap(STORAGE_VOLUMES);
let userMutes = loadMap(STORAGE_MUTES);

function loadMap(key) {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "{}");
  } catch {
    return {};
  }
}
function saveMap(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
  }
}

function makePeerEntry() {
  return {
    outAudioCall: null,
    inAudioCall: null,
    outScreenCall: null,
    inScreenCall: null,
    audioStream: null,
    audioRetry: { timer: null, count: 0 },
    screenRetry: { timer: null, count: 0 },
    joinFallbackTimer: null,
    lastSeen: Date.now(),
    state: "new",
  };
}

function getPeerEntry(id) {
  let e = peerEntries.get(id);
  if (!e) {
    e = makePeerEntry();
    peerEntries.set(id, e);
  }
  return e;
}

function getAudioCtx() {
  if (!audioCtx || audioCtx.state === "closed") audioCtx = new AudioContext();
  return audioCtx;
}

function setParticipant(peerId, patch) {
  setVoice(
    produce((s) => {
      if (s.participants[peerId]) Object.assign(s.participants[peerId], patch);
    })
  );
}


function playRemoteAudio(peerId, stream) {
  let el = audioEls.get(peerId);
  if (!el) {
    el = new Audio();
    el.autoplay = true;
    audioEls.set(peerId, el);
  }
  el.srcObject = stream;
  el.muted = voice.deafened || !!userMutes[peerId];
  el.volume = Math.min(1, userVolumes[peerId] ?? 1);
}
function stopRemoteAudio(peerId) {
  const el = audioEls.get(peerId);
  if (el) {
    el.srcObject = null;
    el.remove();
    audioEls.delete(peerId);
  }
}

export function setUserVolume(peerId, volume) {
  const clamped = Math.max(0, Math.min(2, volume));
  userVolumes[peerId] = clamped;
  saveMap(STORAGE_VOLUMES, userVolumes);
  const el = audioEls.get(peerId);
  if (el) el.volume = Math.min(1, clamped);
  setParticipant(peerId, { localVolume: clamped });
}
export function getUserVolume(peerId) {
  return userVolumes[peerId] ?? 1;
}
export function setUserMuted(peerId, muted) {
  userMutes[peerId] = muted;
  saveMap(STORAGE_MUTES, userMutes);
  const el = audioEls.get(peerId);
  if (el) el.muted = voice.deafened || muted;
  setParticipant(peerId, { locallyMuted: muted });
}
export function getUserMuted(peerId) {
  return userMutes[peerId] ?? false;
}


function startLocalSpeakingDetection() {
  if (!localAudioStream) return;
  stopLocalSpeakingDetection();
  try {
    const ctx = getAudioCtx();
    const source = ctx.createMediaStreamSource(localAudioStream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const detector = { source, analyser, frameId: 0 };
    const tick = () => {
      if (localDetector !== detector) return;
      analyser.getByteFrequencyData(data);
      const avg = (data.reduce((a, b) => a + b, 0) / data.length) * (100 / 255);
      const speaking = avg > SPEAKING_THRESHOLD && !voice.muted;
      if (speaking !== voice.speaking) setVoice({ speaking });
      detector.frameId = requestAnimationFrame(tick);
    };
    detector.frameId = requestAnimationFrame(tick);
    localDetector = detector;
  } catch (err) {
    console.error("[voice] local speaking detection failed", err);
  }
}
function stopLocalSpeakingDetection() {
  if (localDetector) {
    cancelAnimationFrame(localDetector.frameId);
    try { localDetector.source.disconnect(); } catch {}
    try { localDetector.analyser.disconnect(); } catch {}
    localDetector = null;
  }
  setVoice({ speaking: false });
}

function startRemoteSpeakingDetection(peerId, stream) {
  stopRemoteSpeakingDetection(peerId);
  try {
    const ctx = getAudioCtx();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const detector = { source, analyser, frameId: 0 };
    const tick = () => {
      if (remoteDetectors.get(peerId) !== detector) return;
      analyser.getByteFrequencyData(data);
      const avg = (data.reduce((a, b) => a + b, 0) / data.length) * (100 / 255);
      const speaking = avg > SPEAKING_THRESHOLD;
      if (voice.participants[peerId]?.speaking !== speaking) {
        setParticipant(peerId, { speaking });
      }
      detector.frameId = requestAnimationFrame(tick);
    };
    detector.frameId = requestAnimationFrame(tick);
    remoteDetectors.set(peerId, detector);
  } catch (err) {
    console.error("[voice] remote speaking detection failed", err);
  }
}
function stopRemoteSpeakingDetection(peerId) {
  const detector = remoteDetectors.get(peerId);
  if (detector) {
    cancelAnimationFrame(detector.frameId);
    try { detector.source.disconnect(); } catch {}
    try { detector.analyser.disconnect(); } catch {}
    remoteDetectors.delete(peerId);
  }
}


function scheduleRetry(retry, fn, max = AUDIO_RETRY_MAX) {
  if (retry.count >= max) {
    console.warn(`[voice] giving up after ${retry.count} retries`);
    retry.count = 0;
    return;
  }
  clearRetry(retry);
  const delay = Math.min(RETRY_BASE_MS * 2 ** retry.count, RETRY_CAP_MS);
  retry.count++;
  retry.timer = setTimeout(() => {
    retry.timer = null;
    if (voice.channel) fn();
    else retry.count = 0;
  }, delay);
}
function clearRetry(retry) {
  if (retry.timer !== null) {
    clearTimeout(retry.timer);
    retry.timer = null;
  }
}

function isAudioInitiator(remotePeerId) {
  return !!peer?.id && peer.id < remotePeerId;
}

function ensureAudio(remotePeerId) {
  const entry = getPeerEntry(remotePeerId);
  if (entry.audioStream || entry.inAudioCall || entry.outAudioCall) return;

  if (isAudioInitiator(remotePeerId)) {
    callPeerAudio(remotePeerId);
    return;
  }
  if (entry.joinFallbackTimer !== null) clearTimeout(entry.joinFallbackTimer);
  entry.joinFallbackTimer = setTimeout(() => {
    entry.joinFallbackTimer = null;
    if (!entry.audioStream && !entry.inAudioCall && !entry.outAudioCall && voice.channel) {
      callPeerAudio(remotePeerId);
    }
  }, JOIN_FALLBACK_MS);
}

function callPeerAudio(remotePeerId) {
  if (!peer || !localAudioStream) return;
  const entry = getPeerEntry(remotePeerId);
  if (entry.outAudioCall) return;
  clearRetry(entry.audioRetry);

  const call = peer.call(remotePeerId, localAudioStream, { metadata: { kind: "audio" } });
  if (!call) {
    scheduleRetry(entry.audioRetry, () => callPeerAudio(remotePeerId));
    return;
  }
  entry.outAudioCall = call;
  entry.state = "connecting";
  setParticipant(remotePeerId, { callState: "connecting" });
  watchConnectionState(call, remotePeerId, entry);

  call.on("stream", (stream) => {
    entry.audioRetry.count = 0;
    entry.audioStream = stream;
    entry.state = "connected";
    entry.lastSeen = Date.now();
    playRemoteAudio(remotePeerId, stream);
    startRemoteSpeakingDetection(remotePeerId, stream);
    setParticipant(remotePeerId, { callState: "connected" });
  });
  call.on("close", () => {
    if (entry.outAudioCall !== call) return;
    entry.outAudioCall = null;
    entry.audioStream = null;
    stopRemoteAudio(remotePeerId);
    stopRemoteSpeakingDetection(remotePeerId);
    if (voice.channel) scheduleRetry(entry.audioRetry, () => callPeerAudio(remotePeerId));
  });
  call.on("error", (err) => {
    console.error(`[voice] outbound audio error for ${remotePeerId}`, err);
    if (entry.outAudioCall !== call) return;
    entry.outAudioCall = null;
    if (voice.channel) scheduleRetry(entry.audioRetry, () => callPeerAudio(remotePeerId));
  });
}

function callPeerScreen(remotePeerId, stream) {
  if (!peer || peer.destroyed) return;
  const tracks = stream.getVideoTracks();
  if (tracks.length === 0 || tracks[0].readyState === "ended") return;

  const entry = getPeerEntry(remotePeerId);
  clearRetry(entry.screenRetry);
  if (entry.outScreenCall) {
    try { entry.outScreenCall.close(); } catch {}
    entry.outScreenCall = null;
  }

  const call = peer.call(remotePeerId, stream, { metadata: { kind: "screen" } });
  if (!call) {
    scheduleRetry(entry.screenRetry, () => callPeerScreen(remotePeerId, stream), SCREEN_RETRY_MAX);
    return;
  }
  entry.outScreenCall = call;
  watchConnectionState(call, remotePeerId, entry);

  call.on("stream", () => { entry.screenRetry.count = 0; });
  call.on("close", () => {
    if (entry.outScreenCall !== call) return;
    entry.outScreenCall = null;
    if (localScreenStreamRaw && !peer?.destroyed) {
      scheduleRetry(entry.screenRetry, () => callPeerScreen(remotePeerId, localScreenStreamRaw), SCREEN_RETRY_MAX);
    }
  });
  call.on("error", (err) => {
    console.error(`[voice] outbound screen error for ${remotePeerId}`, err);
    if (entry.outScreenCall !== call) return;
    entry.outScreenCall = null;
    if (localScreenStreamRaw && !peer?.destroyed) {
      scheduleRetry(entry.screenRetry, () => callPeerScreen(remotePeerId, localScreenStreamRaw), SCREEN_RETRY_MAX);
    }
  });
}

function broadcastScreenShare(stream) {
  const myId = peer?.id;
  for (const peerId of Object.keys(voice.participants)) {
    if (peerId === myId) continue;
    callPeerScreen(peerId, stream);
  }
}

function closeScreenCalls() {
  for (const entry of peerEntries.values()) {
    clearRetry(entry.screenRetry);
    if (entry.outScreenCall) {
      try { entry.outScreenCall.close(); } catch {}
      entry.outScreenCall = null;
    }
    if (entry.inScreenCall) {
      try { entry.inScreenCall.close(); } catch {}
      entry.inScreenCall = null;
    }
  }
}

export async function toggleScreenShare() {
  if (localScreenStreamRaw) {
    stopScreenShare();
    return;
  }
  try {
    localScreenStreamRaw = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    });
  } catch {
    return;
  }
  const track = localScreenStreamRaw.getVideoTracks()[0];
  track?.addEventListener("ended", () => stopScreenShare(), { once: true });
  setLocalScreenStreamSignal(localScreenStreamRaw);
  setVoice({ isScreenSharing: true });
  broadcastScreenShare(localScreenStreamRaw);
}

function stopScreenShare() {
  if (!localScreenStreamRaw) return;
  localScreenStreamRaw.getTracks().forEach((t) => t.stop());
  localScreenStreamRaw = null;
  setLocalScreenStreamSignal(null);
  setVoice({ isScreenSharing: false });
  closeScreenCalls();
}

function handleInboundCall(call) {
  if (!voice.channel) return;
  const kind = call.metadata?.kind === "screen" ? "screen" : "audio";

  call.answer(kind === "screen" ? undefined : localAudioStream ?? new MediaStream());

  call.on("stream", (stream) => {
    const entry = getPeerEntry(call.peer);
    if (kind === "audio") {
      entry.inAudioCall = call;
      entry.audioStream = stream;
      entry.state = "connected";
      entry.lastSeen = Date.now();
      playRemoteAudio(call.peer, stream);
      startRemoteSpeakingDetection(call.peer, stream);
      setParticipant(call.peer, { callState: "connected" });
    } else {
      entry.inScreenCall = call;
      setVoice("screenStreams", call.peer, stream);
    }
    watchConnectionState(call, call.peer, entry);
  });

  call.on("close", () => {
    const entry = peerEntries.get(call.peer);
    if (!entry) return;
    if (entry.inAudioCall === call) {
      entry.inAudioCall = null;
      entry.audioStream = null;
      stopRemoteAudio(call.peer);
      stopRemoteSpeakingDetection(call.peer);
    } else if (entry.inScreenCall === call) {
      entry.inScreenCall = null;
      setVoice(
        produce((s) => {
          delete s.screenStreams[call.peer];
        })
      );
    }
  });

  call.on("error", (err) => {
    console.error(`[voice] inbound call error from ${call.peer}`, err);
  });
}

function watchConnectionState(call, remotePeerId, entry, attempt = 0) {
  const pc = call.peerConnection;
  if (!pc) {
    if (attempt < 30 && voice.channel) {
      setTimeout(() => watchConnectionState(call, remotePeerId, entry, attempt + 1), 200);
    }
    return;
  }
  let restarted = false;
  const onChange = () => {
    const state = pc.connectionState || pc.iceConnectionState;
    if (state === "connected" || state === "completed") {
      entry.state = "connected";
      entry.lastSeen = Date.now();
      restarted = false;
      setParticipant(remotePeerId, { callState: "connected" });
    } else if (state === "failed") {
      entry.state = "failed";
      setParticipant(remotePeerId, { callState: "failed" });
    } else if (state === "disconnected") {
      entry.state = "reconnecting";
      setParticipant(remotePeerId, { callState: "reconnecting" });
      if (!restarted && typeof pc.restartIce === "function") {
        restarted = true;
        try { pc.restartIce(); } catch {}
      }
    }
  };
  pc.addEventListener("connectionstatechange", onChange);
  pc.addEventListener("iceconnectionstatechange", onChange);
  onChange();
}

function startConnectionMonitor() {
  stopConnectionMonitor();
  monitorTimer = setInterval(() => {
    if (!peer || peer.destroyed || !voice.channel) return;
    const now = Date.now();
    for (const peerId of Object.keys(voice.participants)) {
      const entry = peerEntries.get(peerId);
      if (!entry || (!entry.outAudioCall && !entry.inAudioCall && !entry.audioRetry.timer && !entry.joinFallbackTimer)) {
        ensureAudio(peerId);
        if (localScreenStreamRaw) callPeerScreen(peerId, localScreenStreamRaw);
        continue;
      }
      if (
        ["failed", "disconnected", "reconnecting"].includes(entry.state) &&
        entry.lastSeen < now - PEER_TIMEOUT_MS
      ) {
        detachPeer(peerId);
        ensureAudio(peerId);
        if (localScreenStreamRaw) callPeerScreen(peerId, localScreenStreamRaw);
      }
    }
  }, MONITOR_INTERVAL_MS);
}
function stopConnectionMonitor() {
  if (monitorTimer) {
    clearInterval(monitorTimer);
    monitorTimer = null;
  }
}

function detachPeer(peerId) {
  const entry = peerEntries.get(peerId);
  if (entry) {
    clearRetry(entry.audioRetry);
    clearRetry(entry.screenRetry);
    if (entry.joinFallbackTimer !== null) clearTimeout(entry.joinFallbackTimer);
    for (const call of [entry.outAudioCall, entry.inAudioCall, entry.outScreenCall, entry.inScreenCall]) {
      if (call) try { call.close(); } catch {}
    }
  }
  stopRemoteAudio(peerId);
  stopRemoteSpeakingDetection(peerId);
  peerEntries.delete(peerId);
  setVoice(
    produce((s) => {
      delete s.screenStreams[peerId];
    })
  );
}

function initPeer() {
  if (peer && !peer.destroyed && peerReady) return peerReady;
  peerReady = new Promise((resolve, reject) => {
    const p = new Peer({
      debug: 0,
      config: { iceServers: ICE_SERVERS, iceCandidatePoolSize: 4 },
    });
    p.on("open", () => { peer = p; resolve(p); });
    p.on("error", (err) => { if (!peer) reject(err); else console.error("[voice] peer error", err); });
    p.on("disconnected", () => {
      if (voice.channel && !p.destroyed) { try { p.reconnect(); } catch {} }
    });
    p.on("call", handleInboundCall);
  });
  return peerReady;
}


export async function joinVoiceChannel(conn, channel, serverSrc) {
  if (voice.channel) leaveVoiceChannel();

  setVoice({ joining: true, error: null });
  try {
    localAudioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const p = await initPeer();
    activeConn = conn;
    setVoice({ myPeerId: p.id });
    conn.send({ cmd: "voice_join", channel, peer_id: p.id });
    setVoice({ server: serverSrc });
    startLocalSpeakingDetection();
    startConnectionMonitor();
  } catch (err) {
    setVoice({ joining: false, error: err.message ?? String(err) });
    resetLocalCallState();
    throw err;
  }
}

export function leaveVoiceChannel() {
  if (voice.channel && activeConn) {
    activeConn.send({ cmd: "voice_leave", channel: voice.channel });
  }
  resetLocalCallState();
}

function resetLocalCallState() {
  stopConnectionMonitor();
  stopLocalSpeakingDetection();
  for (const id of [...peerEntries.keys()]) detachPeer(id);
  stopScreenShare();
  peer?.destroy();
  peer = null;
  peerReady = null;
  localAudioStream?.getTracks().forEach((t) => t.stop());
  localAudioStream = null;
  activeConn = null;
  setVoice({
    channel: null,
    server: null,
    joining: false,
    muted: false,
    deafened: false,
    speaking: false,
    myPeerId: null,
    isScreenSharing: false,
    participants: {},
    screenStreams: {},
  });
}

export function toggleVoiceMute() {
  if (!localAudioStream) return;
  const nextMuted = !voice.muted;
  localAudioStream.getAudioTracks().forEach((t) => (t.enabled = !nextMuted));
  setVoice({ muted: nextMuted, ...(nextMuted ? { speaking: false } : {}) });
  activeConn?.send({ cmd: "voice_mute", channel: voice.channel, muted: nextMuted });
}

export function toggleVoiceDeafen() {
  const nextDeafened = !voice.deafened;
  setVoice({ deafened: nextDeafened });
  for (const [peerId, el] of audioEls) {
    el.muted = nextDeafened || !!userMutes[peerId];
  }
  if (nextDeafened && !voice.muted) toggleVoiceMute();
}


function handleVoiceEvent(event) {
  if (!event?.cmd?.startsWith("voice_")) return;

  switch (event.cmd) {
    case "voice_join": {
      setVoice(
        produce((s) => {
          s.joining = false;
          s.channel = event.channel;
          s.participants = {};
          for (const p of event.participants ?? []) {
            s.participants[p.peer_id] = {
              username: p.username,
              peerId: p.peer_id,
              muted: !!p.muted,
              speaking: false,
              callState: "new",
              locallyMuted: !!userMutes[p.peer_id],
              localVolume: userVolumes[p.peer_id] ?? 1,
            };
          }
        })
      );
      for (const p of event.participants ?? []) ensureAudio(p.peer_id);
      break;
    }
    case "voice_user_joined": {
      if (event.channel !== voice.channel || !event.user?.peer_id) break;
      setVoice(
        produce((s) => {
          s.participants[event.user.peer_id] = {
            username: event.user.username,
            peerId: event.user.peer_id,
            muted: !!event.user.muted,
            speaking: false,
            callState: "new",
            locallyMuted: !!userMutes[event.user.peer_id],
            localVolume: userVolumes[event.user.peer_id] ?? 1,
          };
        })
      );
      ensureAudio(event.user.peer_id);
      if (localScreenStreamRaw) callPeerScreen(event.user.peer_id, localScreenStreamRaw);
      break;
    }
    case "voice_user_left": {
      if (event.channel !== voice.channel) break;
      const leavingId = Object.values(voice.participants).find((p) => p.username === event.username)?.peerId;
      if (leavingId) {
        detachPeer(leavingId);
        setVoice(
          produce((s) => {
            delete s.participants[leavingId];
          })
        );
      }
      break;
    }
    case "voice_mute": {
      if (event.channel !== voice.channel) break;
      setParticipant(event.peer_id, { muted: !!event.muted });
      break;
    }
    default:
      break;
  }
}

export function bindVoiceEvents(conn) {
  createEffect(
    on(conn.lastEvent, (event) => {
      if (voice.channel && activeConn && conn !== activeConn) return;
      handleVoiceEvent(event);
    })
  );
}