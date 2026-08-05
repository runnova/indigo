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
  HiOutlineCog6Tooth
} from "solid-icons/hi";

import { preloadChannel, markActive, markBackground } from "../channelCache";
import { createHoverPreloadHandlers } from "../useHoverPreload";
import { state, conn, unreads, setUnreads } from "../../App"

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

  const [pings, setPings] = createSignal({});

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
    setUnreads(
      "servers",
      serverSrc,
      channelName,
      count => (count ?? 0) + 1
    );

    const me = conn.me()?.username;
    const pingedUsers = packet.message?.pings?.users ?? [];

    console.log({
      me: conn.me()?.username,
      channelName,
      currentChannel: props.currentChannel,
      pingedUsers,
      includes: pingedUsers.includes(conn.me()?.username),
    });
    if (me && pingedUsers.includes(me)) {
      setPings(prev => ({ ...prev, [channelName]: true }));
    }
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

    if (pings()[channelName]) {
      setPings(prev => {
        const next = { ...prev };
        delete next[channelName];
        return next;
      });
    }

    props.onSelect(channelName);
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

          const unreadCount = () => {
            const serverSrc = props.serverSrc ?? state.current.server?.src;
            return serverSrc ? unreads.servers?.[serverSrc]?.[ch.name] : undefined;
          };

          return (
            <div
              class={`x channel_item${props.currentChannel === ch.name
                ? " channel_item--active"
                : ""
                }`}
              channelType={ch.type}
              data-context={ch.type === "chat" ? "type_chat" : undefined}
              data-name={ch.name}
              onClick={() => handleSelect(ch.name)}
              onMouseEnter={hover.onMouseEnter}
              onMouseLeave={hover.onMouseLeave}
            >
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

              <div class="y">
                {(ch.display_name && state.settings.displayChannelName && ch.display_name != ch.name) ? (<small style={{ "opacity": ".5" }}>{ch.name}</small>) : (<></>)}
                {ch.display_name || ch.name}

              </div>

              <Show when={pings()[ch.name]}>
                <span class="channel_ping_dot" />
              </Show>

              <Show when={unreadCount() > 0}>
                <span class="channel_badge">
                  {unreadCount()}
                </span>
              </Show>
            </div>
          );
        }}
      </For>
    </div>
  );
}