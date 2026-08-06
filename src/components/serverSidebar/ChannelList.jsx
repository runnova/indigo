import { For, Show, onCleanup, createSignal, createEffect } from "solid-js";
import {
  HiOutlineHashtag,
  HiOutlineSpeakerWave,
  HiOutlineMegaphone,
  HiOutlineChatBubbleLeftRight,
  HiOutlineMusicalNote,
  HiOutlinePuzzlePiece,
  HiOutlinePaintBrush,
  HiOutlinePhoto,
  HiOutlineCodeBracket,
  HiOutlineUserGroup,
  HiOutlineShieldCheck,
  HiOutlineQuestionMarkCircle,
  HiOutlineWrenchScrewdriver,
  HiOutlineCheckCircle,
  HiOutlineScale,
  HiOutlineCpuChip,
  HiOutlineSignal,
  HiOutlineBeaker,
  HiOutlineCalculator,
  HiOutlineHome,
  HiOutlineCodeBracketSquare,
  HiOutlineCog6Tooth,
  HiOutlineArrowDownRight,
  HiOutlineArrowTurnDownRight,
  HiOutlineChevronRight,
  HiOutlineMicrophone,
  HiOutlineSpeakerXMark
} from "solid-icons/hi";

import { preloadChannel, markActive, markBackground } from "../channelCache";
import { createHoverPreloadHandlers } from "../useHoverPreload";
import { state, conn, unreads, setUnreads, setState } from "../../App"

const channelIcons = {
  text: HiOutlineHashtag,
  voice: HiOutlineSpeakerWave,
  announcement: HiOutlineMegaphone,
  forum: HiOutlineChatBubbleLeftRight
};

const iconRules = [
  [/\b(general|lobby|chat)\b/i, HiOutlineHome],
  [/\b(voice|vc|call)\b/i, HiOutlineSpeakerWave],
  [/\b(announce|announcement|news|update)\b/i, HiOutlineMegaphone],
  [/\b(forum|discussion|thread)\b/i, HiOutlineChatBubbleLeftRight],
  [/\b(music|songs|playlist)\b/i, HiOutlineMusicalNote],
  [/\b(game|gaming)\b/i, HiOutlinePuzzlePiece],
  [/\b(art|design)\b/i, HiOutlinePaintBrush],
  [/\b(photo|media|gallery)\b/i, HiOutlinePhoto],
  [/\b(code|dev|development|programming)\b/i, HiOutlineCodeBracket],
  [/\b(commit|commits|git|github|pushes)\b/i, HiOutlineCodeBracketSquare],
  [/\b(help|support|questions)\b/i, HiOutlineQuestionMarkCircle],
  [/\b(staff|admin|admins|moderator|mods)\b/i, HiOutlineShieldCheck],
  [/\b(rule|rules|guidelines)\b/i, HiOutlineScale],
  [/\b(bot|bots|ai|assistant|agents)\b/i, HiOutlineCpuChip],
  [/\b(status|uptime|health)\b/i, HiOutlineSignal],
  [/\b(test|testing|sandbox)\b/i, HiOutlineBeaker],
  [/\b(count|counting)\b/i, HiOutlineCalculator],
  [/\b(team|community|members|people)\b/i, HiOutlineUserGroup],
  [/\b(automation|tools)\b/i, HiOutlineWrenchScrewdriver],
  [/\b(done|completed|verified)\b/i, HiOutlineCheckCircle]
];

function getChannelIcon(channel) {
  const typeIcon = channelIcons[channel.type];

  if (typeIcon && channel.type !== "text") {
    return typeIcon;
  }

  const text = `${channel.name} ${channel.display_name ?? ""}`;

  for (const [pattern, Icon] of iconRules) {
    if (pattern.test(text)) {
      return Icon;
    }
  }

  return HiOutlineHashtag;
}

function isImageSrc(src) {
  return typeof src === "string" && src.trim().length > 0;
}

export default function ChannelList(props) {
  const cleanupFns = [];

  // Tracks which channels (by name) have their thread list collapsed.
  // Local/in-memory only — not persisted to global state or storage.
  const [collapsedChannels, setCollapsedChannels] = createSignal(new Set());

  function isCollapsed(channelName) {
    return collapsedChannels().has(channelName);
  }

  function toggleCollapsed(channelName, evt) {
    // Prevent the click from also selecting the channel.
    evt?.stopPropagation();

    setCollapsedChannels(prev => {
      const next = new Set(prev);
      if (next.has(channelName)) {
        next.delete(channelName);
      } else {
        next.add(channelName);
      }
      return next;
    });
  }

  onCleanup(() => {
    cleanupFns.forEach(fn => fn());
  });

  createEffect(() => {
    const packet = conn.lastEvent();

    if (!packet || packet.cmd !== "message_new") return;

    const channelName = packet.channel;
    if (!channelName) return;

    if (channelName === props.currentChannel) return;

    const serverSrc = props.serverSrc ?? state.current.server?.src;

    if (!serverSrc) {
      console.warn("[ChannelList] no serverSrc, can't bump unread for", channelName);
      return;
    }

    if (!unreads.servers[serverSrc]) {
      setUnreads("servers", serverSrc, {});
    }

    const me = conn.me()?.username;
    const pingedUsers = packet.message?.pings?.users ?? [];
    const wasPinged = !!(me && pingedUsers.includes(me));

    setUnreads(
      "servers",
      serverSrc,
      channelName,
      entry => ({
        count: (entry?.count ?? 0) + 1,
        ping_count: (entry?.ping_count ?? 0) + (wasPinged ? 1 : 0)
      })
    );
  });

  function handleHoverPreload(channelName) {
    if (!channelName) return;
    if (channelName === props.currentChannel) return;

    preloadChannel(channelName, () => props.preloadChannel(channelName));
  }

  function handleSelect(channelName) {
    if (props.currentChannel && props.currentChannel !== channelName) {
      markBackground(props.currentChannel);
    }

    markActive(channelName);

    props.onSelect(channelName);
  }

  function getLiveChannel(channelName) {
    const channels = conn.channels?.() ?? [];
    return channels.find(c => c.name === channelName);
  }

  return (
    <div class="channel_list fill y">
      <For each={props.channels}>
        {(ch) => {
          if (ch.type === "separator") {
            return <hr class="channel_separator" />;
          }

          const Icon = getChannelIcon(ch);

          const hover = createHoverPreloadHandlers(
            () => handleHoverPreload(ch.name),
            300
          );
          cleanupFns.push(hover.cleanup);

          const unreadEntry = () => {
            const serverSrc = props.serverSrc ?? state.current.server?.src;
            return serverSrc ? unreads.servers?.[serverSrc]?.[ch.name] : undefined;
          };

          const unreadCount = () => unreadEntry()?.count ?? 0;
          const pingCount = () => unreadEntry()?.ping_count ?? 0;

          const hasThreads = () => (ch.threads?.length ?? 0) > 0;

          const voiceMembers = () => {
            if (ch.type !== "voice") return [];
            return getLiveChannel(ch.name)?.voice_state ?? [];
          };

          return (
            <>
              <div
                class={`x channel_item${
                  props.currentChannel === ch.name ? " channel_item--active" : ""
                }`}
                channelType={ch.type}
                data-context={ch.type === "chat" ? "type_chat" : undefined}
                data-name={ch.name}
                onClick={() => handleSelect(ch.name)}
                onMouseEnter={hover.onMouseEnter}
                onMouseLeave={hover.onMouseLeave}
              >
                <Show when={hasThreads()}>
                  <span
                    class={`channel_collapse_chevron${
                      isCollapsed(ch.name) ? " channel_collapse_chevron--collapsed" : ""
                    }`}
                    onClick={(e) => toggleCollapsed(ch.name, e)}
                  >
                    <HiOutlineChevronRight />
                  </span>
                </Show>

                <span class="channel_icon">
                  <Show
                    when={isImageSrc(ch.icon)}
                    fallback={<Icon />}
                  >
                    <img
                      src={ch.icon}
                      alt=""
                      class="channel_icon_image"
                    />
                  </Show>
                </span>

                <div class="y channel_name">
                  {(ch.display_name &&
                    state.settings.displayChannelName &&
                    ch.display_name !== ch.name) && (
                    <small style={{ opacity: ".5" }}>{ch.name}</small>
                  )}
                  {ch.display_name || ch.name}
                </div>

                <Show when={pingCount() > 0}>
                  <span class="channel_badge channel_badge--ping">
                    {pingCount()}
                  </span>
                </Show>

                <Show when={pingCount() === 0 && unreadCount() > 0}>
                  <span class="channel_badge">
                    {unreadCount()}
                  </span>
                </Show>
              </div>

              <Show when={ch.type === "voice"}>
                <For each={voiceMembers()}>
                  {(user) => (
                    <div
                      class="x channel_thread_item"
                      data-username={user.username}
                    >
                      <span class="channel_icon">
                        <img className="channel_icon_image" src={"https://avatars.rotur.dev/" + user.username} alt="" />
                      </span>
                      <div class="y channel_name channel_voice_user_name fill">
                        {user.username}
                      </div>
                      <span class="channel_voice_user_mic">
                        <Show when={user.muted} fallback={<HiOutlineMicrophone />}>
                          <HiOutlineSpeakerXMark />
                        </Show>
                      </span>
                    </div>
                  )}
                </For>
              </Show>

              <Show when={!hasThreads() || !isCollapsed(ch.name)}>
                <For each={ch.threads ?? []}>
                  {(thread) => (
                    <div
                      class="x channel_thread_item"
                      data-thread={thread.id}
                      onClick={() => {
                        markActive(ch.name);
                        props.onSelect(ch.name);
                        setState("current", "thread", thread);
                      }}
                    >
                      <span class="channel_icon">
                        <HiOutlineArrowTurnDownRight />
                      </span>
                      <div class="y channel_name">{thread.name}</div>
                    </div>
                  )}
                </For>
              </Show>
            </>
          );
        }}
      </For>
    </div>
  );
}
