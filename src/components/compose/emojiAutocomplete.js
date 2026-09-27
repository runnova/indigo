import { createSignal } from "solid-js";
import emojis from "emoji-picker-element-data/en/emojibase/data.json";
import { tempState, state } from "../../App";

export function createEmojiAutocomplete() {
  const [autoState, setState] = createSignal({
    active: false,
    query: "",
    triggerPos: 0,
  });
  const [activeIndex, setActiveIndex] = createSignal(0);
  const [items, setItems] = createSignal([]);

  function customEmojisFor(src) {
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
  }

  function search(query) {
    const q = query.toLowerCase();

    const customMatches = [];
    for (const server of state.servers) {
      for (const emoji of customEmojisFor(server.src)) {
        const name = (emoji.name ?? "").toLowerCase();
        if (name.startsWith(q)) {
          customMatches.push({ ...emoji, score: 3 });
        } else if (name.includes(q)) {
          customMatches.push({ ...emoji, score: 1 });
        }
      }
    }

    const unicodeMatches = [];
    for (const emoji of emojis) {
      const searchable = [
        emoji.annotation,
        ...(emoji.tags ?? []),
        ...(emoji.shortcodes ?? []),
      ]
        .join(" ")
        .toLowerCase();

      if (searchable.startsWith(q)) {
        unicodeMatches.push({
          custom: false,
          emoji: emoji.emoji,
          annotation: emoji.annotation,
          score: 3,
        });
      } else if (searchable.includes(q)) {
        unicodeMatches.push({
          custom: false,
          emoji: emoji.emoji,
          annotation: emoji.annotation,
          score: 1,
        });
      }
    }

    const combined = [...customMatches, ...unicodeMatches].sort(
      (a, b) => b.score - a.score,
    );

    const seen = new Set();
    return combined
      .filter((m) => {
        const key = m.custom ? `c:${m.src}:${m.id}` : `u:${m.annotation}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 10);
  }

  function parse(value, cursorPos) {
    const uptoCursor = value.slice(0, cursorPos);
    const match = uptoCursor.match(/(^|\s)(:)([a-zA-Z0-9_+-]*)$/);

    if (!match) {
      if (autoState().active) close();
      return;
    }

    const query = match[3];
    const triggerPos = match.index + match[1].length;

    if (query.length < 1) {
      setState({ active: false, query: "", triggerPos });
      setItems([]);
      return;
    }

    setItems(search(query));
    setActiveIndex(0);
    setState({ active: true, query, triggerPos });
  }

  function pick(emoji, textarea) {
    const value = textarea.value;
    const cursorPos = textarea.selectionStart;
    const { triggerPos } = autoState();

    const before = value.slice(0, triggerPos);
    const after = value.slice(cursorPos);
    const text = emoji.custom
      ? `originChats:<emoji>//${emoji.src}/${emoji.id}`
      : emoji.emoji;
    const insertion = `${text} `;

    textarea.value = before + insertion + after;

    const newPos = before.length + insertion.length;
    textarea.focus();
    requestAnimationFrame(() => {
      textarea.setSelectionRange(newPos, newPos);
    });

    close();
  }

  function close() {
    setState({ active: false, query: "", triggerPos: 0 });
    setItems([]);
    setActiveIndex(0);
  }


  function moveNext() {
    setActiveIndex((i) => (i + 1) % items().length);
  }
  function movePrev() {
    setActiveIndex((i) => (i - 1 + items().length) % items().length);
  }
  function hasSuggestions() {
    return autoState().active && items().length > 0;
  }

  return {
    emojiState: autoState,
    emojiItems: items,
    activeIndex,
    setActiveIndex,
    parseEmoji: parse,
    closeEmoji: close,
    pickEmoji: pick,
    moveNext,
    movePrev,
    hasSuggestions,
  };
}
