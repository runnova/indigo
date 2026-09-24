import { createStore } from "solid-js/store";
import { createSignal, createEffect, on } from "solid-js";
import { VoiceClient } from "@originchats/voice";

const STORAGE_PREFIX = "voice_";

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
  };
}

let storage;
try {
  // touch localStorage to make sure it's actually usable (private mode, etc.)
  window.localStorage.setItem("voice_probe", "1");
  window.localStorage.removeItem("voice_probe");
  storage = window.localStorage;
} catch {
  storage = memoryStorage();
}

function readSetting(key, fallback) {
  try {
    const raw = storage.getItem(STORAGE_PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}
function writeSetting(key, value) {
  try {
    storage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

// The active connection this call is bound to. Set on join, cleared on leave.
let activeConn = null;

export const client = new VoiceClient({
  signaling: {
    join: (channel, peerId) => {
      if (!activeConn) return false;
      return activeConn.send({ cmd: "voice_join", channel, peer_id: peerId });
    },
    leave: () => {
      activeConn?.send({ cmd: "voice_leave" });
    },
    setMuted: (muted) => {
      activeConn?.send({ cmd: muted ? "voice_mute" : "voice_unmute" });
    },
  },
  settings: {
    getMicThreshold: () => readSetting("micThreshold", 5),
    getVideoHeight: () => readSetting("videoHeight", 1080),
    getVideoFps: () => readSetting("videoFps", 30),
    getNoiseSuppression: () => readSetting("noiseSuppression", true),
    getStartMuted: () => readSetting("startMuted", false),
    getStartDeafened: () => readSetting("startDeafened", false),
    getDefaultMicId: () => readSetting("defaultMicId", undefined),
    getDefaultCamId: () => readSetting("defaultCamId", undefined),
  },
  hooks: {
    shouldBlockJoin: () => false,
    onMutedChange: (muted) => writeSetting("startMuted", muted),
    onDeafenedChange: (deafened) => writeSetting("startDeafened", deafened),
    onSelectedMicChange: (deviceId) => writeSetting("defaultMicId", deviceId),
    onSelectedCamChange: (deviceId) => writeSetting("defaultCamId", deviceId),
  },
  storage,
  // For real deployments, replace the public defaults with your own broker/TURN:
  // peerBroker: { host: "peer.example.com", port: 443, path: "/", secure: true },
  // iceServers: [
  //   { urls: "stun:stun.example.com:3478" },
  //   { urls: "turn:turn.example.com:3478", username: "user", credential: "pass" },
  // ],
});

// Solid store mirroring the client's immutable snapshots.
export const [voice, setVoice] = createStore(client.getState());

const [localScreenStream, setLocalScreenStreamSignal] = createSignal(null);
const [localCameraStream, setLocalCameraStreamSignal] = createSignal(null);
export { localScreenStream, localCameraStream };

client.subscribe((state) => {
  setVoice(state);
  setLocalScreenStreamSignal(state.localScreenStream ?? null);
  setLocalCameraStreamSignal(state.localCameraStream ?? null);
});

/**
 * Feed voice_* frames from a connection into the client. Call once per
 * connection, inside a component (it registers a Solid effect).
 */
export function bindVoiceEvents(conn) {
  createEffect(
    on(conn.lastEvent, (frame) => {
      if (!frame?.cmd?.startsWith("voice_")) return;
      // Ignore frames from connections other than the one driving the current call.
      if (voice.currentChannel && activeConn && conn !== activeConn) return;

      switch (frame.cmd) {
        case "voice_join":
          if (frame.peer_id === client.getMyPeerId()) {
            // Only accept a self-join we initiated (status joining/connecting).
            // Prevents the server auto-joining us just from viewing a channel.
            if (voice.status === "joining" || voice.status === "connecting") {
              client.onJoined(frame.channel, frame.participants);
            }
          }
          break;
        case "voice_user_joined":
          client.onUserJoined(frame.channel, frame.user);
          break;
        case "voice_user_updated":
          client.onUserUpdated(frame.channel, frame.user);
          break;
        case "voice_user_left":
          client.onUserLeft(frame.channel, frame.username);
          break;
        default:
          break;
      }
    })
  );
}

export async function joinVoiceChannel(conn, channel, serverSrc) {
  activeConn = conn;
  const username = conn?.me?.()?.username ?? "Unknown";
  const ok = await client.join(channel, { username, serverId: serverSrc });
  if (!ok) activeConn = null;
  return ok;
}

export function leaveVoiceChannel() {
  client.leave();
  activeConn = null;
}

export function toggleVoiceMute() {
  client.toggleMute();
}
export function setVoiceMuted(muted) {
  client.setMuted(muted);
}
export function toggleVoiceDeafen() {
  client.toggleDeafen();
}
export function setVoiceDeafened(deafened) {
  client.setDeafened(deafened);
}

export async function toggleScreenShare() {
  await client.toggleScreenShare();
}
export async function toggleCamera() {
  await client.toggleCamera();
}
export function switchCamera(deviceId) {
  return client.switchCamera(deviceId);
}
export function flipCamera() {
  return client.flipCamera();
}
export function switchMicrophone(deviceId) {
  return client.switchMicrophone(deviceId);
}

export function watchStream(peerId) {
  client.watchStream(peerId);
}
export function stopWatching(peerId) {
  client.stopWatching(peerId);
}
export function focusStream(peerId) {
  client.focusStream(peerId);
}

export function setUserVolume(peerId, volume) {
  client.setUserVolume(peerId, volume);
}
export function getUserVolume(peerId) {
  return voice.userVolumes?.[peerId] ?? 1;
}
export function setUserMuted(peerId, muted) {
  client.setUserMuted(peerId, muted);
}
export function getUserMuted(peerId) {
  return voice.userMutes?.[peerId] ?? false;
}
export function setStreamVolume(peerId, volume) {
  client.setStreamVolume(peerId, volume);
}
export function setStreamMuted(peerId, muted) {
  client.setStreamMuted(peerId, muted);
}

export function retryPeer(peerId) {
  client.retryPeer(peerId);
}
export function resumeAudio() {
  return client.resumeAudio();
}
export function dismissError() {
  client.dismissError();
}

export function applyMicThreshold() {
  client.applyMicThreshold();
}
export async function applyAudioSettings() {
  await client.applyAudioSettings();
}
export async function applyVideoSettings() {
  await client.applyVideoSettings();
}
export function getAudioInputDevices() {
  return client.getAudioInputDevices();
}
export function getVideoInputDevices() {
  return client.getVideoInputDevices();
}
