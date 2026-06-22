import { For, Show } from "solid-js";
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
  HiOutlineCodeBracketSquare
} from "solid-icons/hi";
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

  const text =
    `${channel.name} ${channel.display_name ?? ""}`;

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
  return (
    <div class="channel_list y">
      <For each={props.channels}>
        {(ch) => {
          if (ch.type === "separator") {
            return <hr class="channel_separator" />;
          }

          const unread = props.unreads[ch.name];
          const Icon = getChannelIcon(ch)

          return (
            <div
              class={`x channel_item${props.currentChannel === ch.name
                ? " channel_item--active"
                : ""
                }`}
              onClick={() => props.onSelect(ch.name)}
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

              {ch.display_name || ch.name}

              <Show when={unread?.unread_count > 0}>
                <span class="channel_badge">
                  {unread.unread_count}
                </span>
              </Show>
            </div>
          );
        }}
      </For>
    </div>
  );
}