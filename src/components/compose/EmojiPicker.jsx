import {
  createSignal,
  createMemo,
  For,
  Show,
  createEffect,
  onMount,
} from "solid-js";
import "./emojiPicker.css";
import { HiOutlineMagnifyingGlass, HiOutlineSparkles } from "solid-icons/hi";

import emojis from "emoji-picker-element-data/en/emojibase/data.json";
import { tempState, state } from "../../App.jsx";
import { twemojiUrl } from "../messages/twemoji.js";

let searchInput;

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
  9: "🏴",
};

const GROUPS = [...new Set(emojis.map((e) => e.group))].sort((a, b) => a - b);

export default function EmojiPicker(props) {
  const [query, setQuery] = createSignal("");
  const [group, setGroup] = createSignal(0);
  const [tab, setTab] = createSignal("emoji");
  const [gifs, setGifs] = createSignal([]);
  const [gifLoading, setGifLoading] = createSignal(false);
  const [sort, setSort] = createSignal("newest");
  const [offset, setOffset] = createSignal(0);
  const [tags, setTags] = createSignal([]);
  const [selectedTag, setSelectedTag] = createSignal("");

  createEffect(async () => {
    if (tab() !== "gif") return;
    if (tags().length) return;

    const res = await fetch(
      "https://gifs.originchats.com/api/gifs/tags?limit=50",
    );

    const data = await res.json();

    setTags(data.tags ?? []);
  });
  onMount(() => {
    searchInput?.focus();
  });

  createEffect(async () => {
    if (tab() !== "gif") return;

    setGifLoading(true);

    const q = query().trim();

    const url = new URL("https://gifs.originchats.com/api/gifs");

    url.searchParams.set("limit", "10");
    url.searchParams.set("offset", offset().toString());
    const tag = selectedTag();

    if (tag) {
      url.searchParams.set("tags", tag);
    }

    if (q) {
      url.searchParams.set("q", q);
    }

    url.searchParams.set("sort", sort());

    const res = await fetch(url);
    const data = await res.json();

    if (offset() === 0) {
      setGifs(data.gifs ?? []);
    } else {
      setGifs((prev) => [...prev, ...(data.gifs ?? [])]);
    }

    setGifLoading(false);
  });
  createEffect(() => {
    query();
    sort();
    selectedTag();

    setOffset(0);
  });

  const emojiServers = createMemo(() => {
      return state.servers.map((server) => ({
        src: server.src,
        name: server.name ?? server.src,
        icon: server.icon ?? null,
      }));
    });

    const [customServer, setCustomServer] = createSignal(null);

    const activeCustomServer = createMemo(() => {
      return (
        customServer() ??
        tempState.conn?.serverInfo?.()?.src ??
        emojiServers()[0]?.src ??
        null
      );
    });

    const customEmojisFor = (src) => {
      const list = tempState.serverEmojis?.[src];

      if (!list) return [];

      if (Array.isArray(list)) {
        return list.map((emoji) => ({
          custom: true,
          src,
          id: emoji.id,
          name: emoji.name,
        }));
      }

      return Object.entries(list).map(([id, emoji]) => ({
        custom: true,
        src,
        id,
        ...emoji,
      }));
    };

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
      if (group() === "custom") {
        return customEmojisFor(activeCustomServer());
      }

      return grouped().get(group()) ?? [];
    }

    const unicodeMatches = emojis.filter((emoji) => {
      const searchable = [
        emoji.annotation,
        ...(emoji.tags ?? []),
        ...(emoji.shortcodes ?? []),
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(q);
    });

    const customMatches = emojiServers().flatMap((server) =>
      customEmojisFor(server.src).filter((e) =>
        (e.name ?? "").toLowerCase().includes(q),
      ),
    );

    return [...customMatches, ...unicodeMatches];
  });

  return (
    <div class="emoji_picker">
      <div class="picker_tabs">
        <button
          classList={{ active: tab() === "emoji" }}
          onClick={() => setTab("emoji")}
        >
          Emoji
        </button>

        <button
          classList={{ active: tab() === "gif" }}
          onClick={() => setTab("gif")}
        >
          GIF
        </button>
        <button
          classList={{ active: tab() === "sticker" }}
          onClick={() => setTab("sticker")}
        >
          Stickers
        </button>
      </div>

      <div className="searchbox">
        <input
          ref={searchInput}
          type="text"
          placeholder={
            tab() === "emoji" ? "Search emojis..." : "Search GIFs..."
          }
          value={query()}
          onInput={(e) => setQuery(e.currentTarget.value)}
        />
        <Show when={tab() === "gif"}>
          <HiOutlineSparkles
            title="I'm feeling lucky"
            onClick={async () => {
              try {
                const res = await fetch(
                  "https://gifs.originchats.com/api/gifs/random",
                );
                const { gif } = await res.json();

                if (gif?.url) {
                  props.onSelect("https://gifs.originchats.com" + gif.url);
                }
              } catch (err) {
                console.error(err);
              }
            }}
          />
        </Show>
        <HiOutlineMagnifyingGlass />
      </div>

      <Show
        when={tab() === "emoji"}
        fallback={
          <>
            <Show when={tab() === "gif"}>
              <div class="gif_toolbar x">
                <div class="gif_tags">
                  <button
                    classList={{ active: selectedTag() === "" }}
                    onClick={() => setSelectedTag("")}
                  >
                    All
                  </button>

                  <For each={tags()}>
                    {(tag) => (
                      <button
                        classList={{
                          active: selectedTag() === tag.tag,
                        }}
                        onClick={() => setSelectedTag(tag.tag)}
                      >
                        {tag.tag}
                      </button>
                    )}
                  </For>
                </div>

                <select
                  value={sort()}
                  onInput={(e) => setSort(e.currentTarget.value)}
                >
                  <option value="newest">Newest</option>
                  <option value="views">Most Viewed</option>
                  <option value="likes">Most Liked</option>
                </select>
              </div>
            </Show>
            <div class="gif_grid">
              <Show when={!gifLoading()} fallback={<div>Loading...</div>}>
                <For each={gifs()}>
                  {(gif) => (
                    <button
                      class="gif_button"
                      onClick={() =>
                        props.onSelect("https://gifs.originchats.com" + gif.url)
                      }
                    >
                      <img
                        src={"https://gifs.originchats.com" + gif.url}
                        alt={gif.title}
                        loading="lazy"
                      />
                    </button>
                  )}
                </For>

                <button
                  class="gif_button load_more"
                  disabled={gifLoading()}
                  onClick={() => setOffset(offset() + 10)}
                >
                  <Show when={!gifLoading()} fallback="Loading...">
                    Load More
                  </Show>
                </button>
              </Show>
            </div>
          </>
        }
      >
        <div class="x fill">
          <Show when={!query().trim()}>
            <div class="emoji_categories y">
              <For each={emojiServers()}>
                {(server) => (
                  <button
                    type="button"
                    class="emoji_category"
                    classList={{
                      active:
                        group() === "custom" &&
                        activeCustomServer() === server.src,
                    }}
                    title={server.name}
                    onClick={() => {
                      setCustomServer(server.src);
                      setGroup("custom");
                    }}
                  >
                    <Show when={server.icon} fallback={server.name?.[0] ?? "?"}>
                      <img src={server.icon} alt="" />
                    </Show>
                  </button>
                )}
              </For>

              <For each={GROUPS}>
                {(id) => (
                  <button
                    type="button"
                    class="emoji_category"
                    classList={{
                      active: group() === id,
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
                  onClick={() => {
                    props.onSelect(
                      emoji.custom
                        ? `originChats:<emoji>//${emoji.src}/${emoji.id}`
                        : emoji.emoji,
                    );
                  }}
                >
                  <Show
                    when={emoji.custom}
                    fallback={
                      state.settings.twemoji ? (
                        <img
                          class="twemoji"
                          src={twemojiUrl(emoji.emoji)}
                          alt={emoji.emoji}
                          draggable={false}
                          loading="lazy"
                        />
                      ) : (
                        emoji.emoji
                      )
                    }
                  >
                    <img
                      src={`https://${emoji.src}/emojis/${emoji.id}`}
                      alt={emoji.name}
                    />
                  </Show>
                </button>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
}
