import { Show, For, createEffect, on } from "solid-js";
import {
  HiOutlineMicrophone,
  HiOutlineSpeakerWave,
  HiOutlineSpeakerXMark,
  HiOutlineComputerDesktop,
  HiOutlineVideoCamera,
} from "solid-icons/hi";
import {
  voice,
  localScreenStream,
  localCameraStream,
  joinVoiceChannel,
  leaveVoiceChannel,
  toggleVoiceMute,
  toggleVoiceDeafen,
  toggleScreenShare,
  toggleCamera,
  watchStream,
  stopWatching,
  resumeAudio,
  dismissError,
} from "../../core/voiceClient.js";
import "./voicechannel.css";
import { Participant } from "./Participant.jsx";

function VideoTile(props) {
  let videoEl;
  createEffect(
    on(
      () => props.stream,
      (stream) => {
        if (videoEl) videoEl.srcObject = stream ?? null;
      }
    )
  );
  return (
    <div class="voice_channel_screen_tile y">
      <video ref={videoEl} autoplay playsinline muted={props.muted} />
      <span>{props.label}</span>
    </div>
  );
}

export function VoiceChannelView(props) {
  const norm = (v) => (v == null ? "" : String(v).trim().toLowerCase());

  const channelMatches = () =>
    norm(voice.currentChannel) === norm(props.channel);

  const serverMatches = () =>
    norm(voice.serverId ?? "") === norm(props.server?.src ?? "");

  const inThisChannel = () =>
    channelMatches() && serverMatches();

  const inOtherChannel = () =>
    norm(voice.currentChannel) !== "" && !inThisChannel();

  async function handleJoinLeave() {
    if (inThisChannel()) {
      leaveVoiceChannel();
    } else {
      if (voice.status === "connecting" || voice.status === "joining") return;
      await joinVoiceChannel(props.conn, props.channel, props.server?.src);
    }
  }

  const participantList = () => voice.participants ?? [];


  createEffect(() => console.log("[voice]", {
    currentChannel: voice.currentChannel,
    serverId: voice.serverId,
    propsChannel: props.channel,
    propsServerSrc: props.server?.src,
    status: voice.status,
  }));
  createEffect(
    on(
      () => participantList().map((p) => `${p.peer_id}:${p.videoAvailable ?? ""}`),
      () => {
        for (const p of participantList()) {
          if (p.videoAvailable && !p.watching) watchStream(p.peer_id);
          else if (!p.videoAvailable && p.watching) stopWatching(p.peer_id);
        }
      }
    )
  );

  return (
    <div class="voice_channel_view y fill">
      <img className="immersive_background" src="icon_small.svg" />
      <div class="voice_channel_view_body y fill">
        <Show when={voice.error}>
          <div class="voice_channel_error">
            {voice.error?.message}
            <Show when={voice.error?.code === "playback"}>
              <button type="button" onClick={resumeAudio}>
                Resume audio
              </button>
            </Show>
            <button type="button" onClick={dismissError}>
              Dismiss
            </button>
          </div>
        </Show>

        <Show
          when={inThisChannel()}
          fallback={
            <div class="vml-empty y fill">
              <Show
                when={inOtherChannel()}
                fallback={
                  <>
                    <h1 class="vc_big_title">{props.channel}</h1>
                    <p>Nobody's here yet.</p>
                  </>
                }
              >
                <p>You're in another voice call ({voice.currentChannel}).</p>
              </Show>
            </div>
          }
        >
          <Show
            when={
              voice.isScreenSharing ||
              voice.isCameraOn ||
              participantList().some((p) => p.watching)
            }
          >
            <div class="voice_channel_screenshares x">
              <Show when={voice.isScreenSharing}>
                <VideoTile stream={localScreenStream()} label="You (sharing)" muted={true} />
              </Show>
              <Show when={voice.isCameraOn}>
                <VideoTile stream={localCameraStream()} label="You (camera)" muted={true} />
              </Show>
              <For each={participantList().filter((p) => p.watching)}>
                {(p) => (
                  <VideoTile
                    stream={voice.screenStreams?.[p.peer_id] ?? voice.cameraStreams?.[p.peer_id]}
                    label={p.username}
                    muted={false}
                  />
                )}
              </For>
            </div>
          </Show>

          <div class="voice_channel_participants">
            <Participant
              isSelf
              username={props.conn?.me?.()?.username ?? "You"}
              state="connected"
              muted={voice.isMuted}
              speaking={voice.isSpeaking}
              renderOverlay={props.renderOverlay}
            />

            <For each={participantList()}>
              {(p) => (
                <Participant
                  peerId={p.peer_id}
                  username={p.username}
                  state={p.connection}
                  muted={p.muted}
                  speaking={p.speaking}
                  locallyMuted={p.locallyMuted}
                  localVolume={p.localVolume}
                  audioIssue={p.audioIssue}
                  renderOverlay={props.renderOverlay}
                />
              )}
            </For>
          </div>
        </Show>
      </div>

      <div class="voice_channel_controls x">
        <button
          type="button"
          class="voice_channel_btn"
          disabled={voice.status === "connecting" || voice.status === "joining" || voice.status === "requesting-microphone"}
          onClick={handleJoinLeave}
        >
          {inThisChannel()
            ? "Leave"
            : ["joining", "connecting", "requesting-microphone"].includes(voice.status)
              ? "Joining…"
              : inOtherChannel()
                ? "Switch to this channel"
                : "Join voice"}
        </button>
        <Show when={inThisChannel()}>
          <button
            type="button"
            class="voice_channel_btn voice_channel_btn_icon"
            onClick={toggleVoiceMute}
            aria-pressed={voice.isMuted}
            title={voice.isMuted ? "Unmute" : "Mute"}
          >
            {voice.isMuted ? <HiOutlineSpeakerXMark /> : <HiOutlineMicrophone />}
          </button>
          <button
            type="button"
            class="voice_channel_btn voice_channel_btn_icon"
            onClick={toggleVoiceDeafen}
            aria-pressed={voice.isDeafened}
            title={voice.isDeafened ? "Undeafen" : "Deafen"}
          >
            {voice.isDeafened ? <HiOutlineSpeakerXMark /> : <HiOutlineSpeakerWave />}
          </button>
          <button
            type="button"
            class="voice_channel_btn voice_channel_btn_icon"
            onClick={toggleScreenShare}
            aria-pressed={voice.isScreenSharing}
            title={voice.isScreenSharing ? "Stop sharing screen" : "Share screen"}
          >
            <HiOutlineComputerDesktop />
          </button>
          <button
            type="button"
            class="voice_channel_btn voice_channel_btn_icon"
            onClick={toggleCamera}
            aria-pressed={voice.isCameraOn}
            title={voice.isCameraOn ? "Turn camera off" : "Turn camera on"}
          >
            <HiOutlineVideoCamera />
          </button>
        </Show>
      </div>
    </div>
  );
}

export function StatusDot(props) {
  const color = () =>
    ({
      new: "#9aa1ac",
      connecting: "#e0a63e",
      connected: "#3ecf6e",
      reconnecting: "#e0a63e",
      disconnected: "#9aa1ac",
      failed: "#e05a3e",
      closed: "#9aa1ac",
    }[props.state] ?? "#9aa1ac");
  return <span class="voice_channel_status_dot" style={{ background: color() }} aria-hidden="true" />;
}

export default VoiceChannelView;
