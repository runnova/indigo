import { Show, For, createEffect, on } from "solid-js";
import {
  HiOutlineMicrophone,
  HiOutlineSpeakerWave,
  HiOutlineSpeakerXMark,
  HiOutlineComputerDesktop,
} from "solid-icons/hi";
import {
  voice,
  localScreenStream,
  joinVoiceChannel,
  leaveVoiceChannel,
  toggleVoiceMute,
  toggleVoiceDeafen,
  toggleScreenShare,
  getUserVolume,
  getUserMuted,
} from "../../core/voiceClient.js";
import "./voicechannel.css"
import { Participant } from "./Participant.jsx";

function ScreenTile(props) {
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
  const inThisChannel = () =>
    voice.channel === props.channel && voice.server === props.server?.src;
  const inOtherChannel = () => voice.channel && !inThisChannel();

  async function handleJoinLeave() {
    if (inThisChannel()) {
      leaveVoiceChannel();
    } else {
      await joinVoiceChannel(props.conn, props.channel, props.server?.src);
    }
  }

  const participantList = () => Object.values(voice.participants);
  const screenShareEntries = () => Object.entries(voice.screenStreams);

  return (
    <div class="voice_channel_view y fill">
      <img className="immersive_background" src="icon_small.svg" />
      <div class="voice_channel_view_body y fill">
        <Show when={voice.error}>
          <div class="voice_channel_error">{voice.error}</div>
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
                <p>You're in another voice call ({voice.channel}).</p>
              </Show>
            </div>
          }
        >
          <Show when={screenShareEntries().length > 0 || voice.isScreenSharing}>
            <div class="voice_channel_screenshares x">
              <Show when={voice.isScreenSharing}>
                <ScreenTile
                  stream={localScreenStream()}
                  label="You (sharing)"
                  muted={true}
                />
              </Show>
              <For each={screenShareEntries()}>
                {([peerId, stream]) => (
                  <ScreenTile
                    stream={stream}
                    label={voice.participants[peerId]?.username ?? "Someone"}
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
              muted={voice.muted}
              speaking={voice.speaking}
              renderOverlay={props.renderOverlay}
            />

            <For each={participantList()}>
              {(p) => (
                <Participant
                  peerId={p.peerId}
                  username={p.username}
                  state={p.callState}
                  muted={p.muted}
                  speaking={p.speaking}
                  locallyMuted={p.locallyMuted}
                  localVolume={p.localVolume}
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
          disabled={voice.joining}
          onClick={handleJoinLeave}
        >
          {inThisChannel()
            ? "Leave"
            : voice.joining
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
            aria-pressed={voice.muted}
            title={voice.muted ? "Unmute" : "Mute"}
          >
            {voice.muted ? <HiOutlineSpeakerXMark /> : <HiOutlineMicrophone />}
          </button>
          <button
            type="button"
            class="voice_channel_btn voice_channel_btn_icon"
            onClick={toggleVoiceDeafen}
            aria-pressed={voice.deafened}
            title={voice.deafened ? "Undeafen" : "Deafen"}
          >
            {voice.deafened ? <HiOutlineSpeakerXMark /> : <HiOutlineSpeakerWave />}
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
    failed: "#e05a3e",
    closed: "#9aa1ac",
  }[props.state] ?? "#9aa1ac");
  return (
    <span
      class="voice_channel_status_dot"
      style={{ background: color() }}
      aria-hidden="true"
    />
  );
}

export default VoiceChannelView;
