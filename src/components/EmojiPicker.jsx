import {
  createSignal,
  createMemo,
  For,
  Show
} from "solid-js";

import emojis from "emoji-picker-element-data/en/emojibase/data.json";
import { tempState } from "../App.jsx";

const GROUP_ICONS = {
  0: "😎",
  1: "👌",
  2: "?",
  3: "🐈",
  4: "🍓",
  5: "✈️",
  6: "💡",
  7: "👓",
  8: "⚠️",
  9: "🏴"
};

const CUSTOM_GROUP = "custom";

const GROUPS = [...new Set(emojis.map(e => e.group))]
  .sort((a, b) => a - b);

export default function EmojiPicker(props) {
  const [query, setQuery] = createSignal("");
  const [group, setGroup] = createSignal(0);

  const customEmojis = createMemo(() => {
  const list = tempState.conn?.emojis?.();

  if (!list) return [];

  return Object.entries(list).map(([id, emoji]) => ({
    id,
    ...emoji
  }));
});

  const grouped = createMemo(() => {
    const map = new Map();

    for (const emoji of emojis) {
      if (!map.has(emoji.group)) {
        map.set(emoji.group, []);
      }

      map.get(emoji.group).push(emoji);
    }

    return map;
  });

  const results = createMemo(() => {
    const q = query().trim().toLowerCase();

    if (!q) {
      if (group() === CUSTOM_GROUP) {
  return customEmojis().map(e => ({
    custom: true,
    id: e.id,
    name: e.name
  }));
}

      return grouped().get(group()) ?? [];
    }

    return emojis.filter((emoji) => {
      const searchable = [
        emoji.annotation,
        ...(emoji.tags ?? []),
        ...(emoji.shortcodes ?? [])
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(q);
    });
  });

  return (
    <div class="emoji_picker">
      <input
        type="text"
        placeholder="Search emojis..."
        value={query()}
        onInput={(e) => setQuery(e.currentTarget.value)}
      />

      <div class="x fill">
        <Show when={!query().trim()}>
          <div class="emoji_categories y">
            <button
              type="button"
              class="emoji_category"
              classList={{
                active: group() === CUSTOM_GROUP
              }}
              title="Custom emojis"
              onClick={() => setGroup(CUSTOM_GROUP)}
            >
              ⭐
            </button>

            <For each={GROUPS}>
              {(id) => (
                <button
                  type="button"
                  class="emoji_category"
                  classList={{
                    active: group() === id
                  }}
                  title={`Group ${id}`}
                  onClick={() => setGroup(id)}
                >
                  {GROUP_ICONS[id] ?? "❓"}
                </button>
              )}
            </For>
          </div>
        </Show>

        <div class="emoji_grid">
          <For each={results()}>
            {(emoji) => (
              <button
                type="button"
                class={emoji.custom ? "custom_emoji" : "unicode_emoji"}
                title={emoji.custom ? emoji.name : emoji.annotation}
                onClick={() =>
                  props.onSelect(
                    emoji.custom
                      ? `<:${emoji.name}>`
                      : emoji.emoji
                  )
                }
              >
                <Show
                  when={emoji.custom}
                  fallback={emoji.emoji}
                >
                  <img
                    src={`https://${props.src}/emojis/${emoji.id}`}
                    alt={emoji.name}
                  />
                </Show>
              </button>
            )}
          </For>
        </div>
      </div>
    </div>
  );
}