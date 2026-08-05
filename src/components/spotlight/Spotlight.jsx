import {
  createSignal,
  createMemo,
  createEffect,
  onMount,
  onCleanup,
  For,
  Show,
  batch
} from "solid-js";

import {
  HiOutlineMagnifyingGlass,
  HiOutlineHashtag,
  HiOutlineSpeakerWave,
  HiOutlineChatBubbleLeftRight,
  HiOutlineServerStack
} from "solid-icons/hi";

import { state, switchToChannel } from "../../App";
import { connections, ensureConnected } from "../../core/server_connection.jsx";
import "./style.css";
import { buildResults } from "./buildResults.jsx";

export function fuzzyScore(query, target) {
  if (!query) return 0;
  if (typeof target !== "string" || !target) return -1;

  const q = String(query).toLowerCase();
  const t = target.toLowerCase();

  const idx = t.indexOf(q);
  if (idx !== -1) {
    return idx === 0 ? 0 : 10 + idx;
  }

  let ti = 0;
  let gaps = 0;
  let lastMatch = -1;

  for (let qi = 0; qi < q.length; qi++) {
    const found = t.indexOf(q[qi], ti);
    if (found === -1) return -1;
    if (lastMatch !== -1 && found !== lastMatch + 1) gaps++;
    lastMatch = found;
    ti = found + 1;
  }

  return 100 + gaps;
}

function channelIcon(type) {
  if (type === "voice") return HiOutlineSpeakerWave;
  if (type === "forum") return HiOutlineChatBubbleLeftRight;
  return HiOutlineHashtag;
}

export function collectServerEntries() {
  const bySrc = new Map();

  for (const s of state.servers) {
    bySrc.set(s.src, { src: s.src, name: s.name, icon: s.icon, connection: null });
  }

  for (const [src, connection] of connections.entries()) {
    const existing = bySrc.get(src);
    const info = connection.state.serverInfo;

    bySrc.set(src, {
      src,
      name: info?.name ?? existing?.name ?? src,
      icon: info?.icon ?? existing?.icon ?? null,
      connection
    });
  }

  return [...bySrc.values()];
}

export default function Spotlight() {
  const [open, setOpen] = createSignal(false);
  const [query, setQuery] = createSignal("");
  const [activeIndex, setActiveIndex] = createSignal(0);
  let inputRef;
  let listRef;

  function close() {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  }

  function show() {
    setOpen(true);
    setActiveIndex(0);
    queueMicrotask(() => inputRef?.focus());

    for (const server of state.servers) {
      if (connections.has(server.src)) continue;

      const settings = JSON.parse(localStorage.getItem("settings") || "{}");

      ensureConnected(
        server,
        settings.type === "token"
          ? { roturToken: settings.token }
          : { crackedUser: { username: "guest", password: "guest" } }
      );
    }
  }

  onMount(() => {
    const handler = (e) => {
      const isCombo = (e.ctrlKey || e.metaKey) && e.key === "/";

      if (isCombo) {
        e.preventDefault();
        open() ? close() : show();
        return;
      }

      if (e.key === "Escape" && open()) {
        e.preventDefault();
        close();
      }
    };

    window.addEventListener("keydown", handler);
    onCleanup(() => window.removeEventListener("keydown", handler));
  });

  const results = createMemo(() => buildResults(query().trim()));

  const flatResults = createMemo(() => {
    const { serverResults, channelResults } = results();
    return [...channelResults, ...serverResults];
  });

  createEffect(() => {
    flatResults();
    setActiveIndex(0);
  });

  function selectResult(result) {
    if (!result) return;

    if (result.kind === "channel") {
      switchToChannel(result.server, result.channel.name);
    } else {
      switchToChannel(result.server, null);
    }

    close();
  }

  function onKeyDown(e) {
    const items = flatResults();

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(items.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      selectResult(items[activeIndex()]);
    }
  }

  createEffect(() => {
    const idx = activeIndex();
    const el = listRef?.querySelector(`[data-index="${idx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  });

  return (
    <Show when={open()}>
      <div class="spotlight_overlay" onClick={close}>
        <div
          class="spotlight_panel"
          onClick={(e) => e.stopPropagation()}
        >
          <div class="spotlight_inputrow">
            <HiOutlineMagnifyingGlass class="spotlight_searchicon" />
            <input
              ref={inputRef}
              type="text"
              class="spotlight_input"
              placeholder="Search servers and channels…"
              value={query()}
              onInput={(e) => setQuery(e.currentTarget.value)}
              onKeyDown={onKeyDown}
            />
            <kbd class="spotlight_hint">Esc</kbd>
          </div>

          <div class="spotlight_results" ref={listRef}>
            <Show
              when={flatResults().length > 0}
              fallback={
                <div class="spotlight_empty">
                  <Show when={query().trim()} fallback="Start typing to search…">
                    No matches for "{query()}"
                  </Show>
                </div>
              }
            >
              <Show when={results().channelResults.length > 0}>
                <div class="spotlight_sectionlabel">Channels</div>
                <For each={results().channelResults}>
                  {(result) => {
                    const index = () => flatResults().indexOf(result);
                    const Icon = channelIcon(result.channel.type);

                    return (
                      <button
                        class={`spotlight_result ${activeIndex() === index() ? "active" : ""}`}
                        data-index={index()}
                        onMouseEnter={() => setActiveIndex(index())}
                        onClick={() => selectResult(result)}
                      >
                        <Icon class="spotlight_result_icon" />
                        <div class="spotlight_result_text">
                          <span class="spotlight_result_title">
                            {result.channel.display_name || result.channel.name}
                          </span>
                          <span class="spotlight_result_sub">
                            {result.server.name || result.server.src}
                          </span>
                        </div>
                      </button>
                    );
                  }}
                </For>
              </Show>

              <Show when={results().serverResults.length > 0}>
                <div class="spotlight_sectionlabel">Servers</div>
                <For each={results().serverResults}>
                  {(result) => {
                    const index = () => flatResults().indexOf(result);

                    return (
                      <button
                        class={`spotlight_result ${activeIndex() === index() ? "active" : ""}`}
                        data-index={index()}
                        onMouseEnter={() => setActiveIndex(index())}
                        onClick={() => selectResult(result)}
                      >
                        <Show
                          when={result.server.icon}
                          fallback={<HiOutlineServerStack class="spotlight_result_icon" />}
                        >
                          <img
                            src={result.server.icon}
                            alt=""
                            class="spotlight_result_avatar"
                          />
                        </Show>
                        <div class="spotlight_result_text">
                          <span class="spotlight_result_title">
                            {result.server.name || result.server.src}
                          </span>
                          <span class="spotlight_result_sub">{result.server.src}</span>
                        </div>
                      </button>
                    );
                  }}
                </For>
              </Show>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
}
