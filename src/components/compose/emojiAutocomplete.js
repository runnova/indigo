import { createSignal } from "solid-js";
import emojis from "emoji-picker-element-data/en/emojibase/data.json";
import { tempState } from "../../App";

export function createEmojiAutocomplete() {
  const [state, setState] = createSignal({
    active: false,
    query: "",
    triggerPos: 0,
  });
  const [activeIndex, setActiveIndex] = createSignal(0);
  const [items, setItems] = createSignal([]);

  function fuzzySearchBiasTowardsStart(query, searchableStrings) {
    const lowerQuery = query.toLowerCase();

    let bestMatch = null;
    let bestScore = -1;

    for (const str of searchableStrings) {
      const lowerStr = str.toLowerCase();

      let score = -1;

      if (lowerStr.startsWith(lowerQuery)) {
        score = 3; // biased towards start
      } else if (lowerStr.includes(lowerQuery)) {
        score = 1; // match anywhere
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = str;
      }
    }

    return bestMatch;
  }

  function parse(value, cursorPos) {
    const uptoCursor = value.slice(0, cursorPos);
    const match = uptoCursor.match(/(^|:\s*)(:)([a-zA-Z0-9_]+)$/);

    if (!match) {
      if (state().active) close();
      return;
    }

    const query = match[3];
    const triggerPos = cursorPos - query.length - 2;

    if (query.length < 1) {
      setState({ active: false, query: "", triggerPos });
      setItems([]);
      return;
    }

    const q = query.toLowerCase();

    const searchable = emojis.map((emoji) => {
      const parts = [
        emoji.annotation,
        ...(emoji.tags ?? []),
        ...(emoji.shortcodes ?? []),
      ]
        .join(" ")
        .toLowerCase();

      return parts;
    });

    const matched = searchable
      .map((s, i) => ({ string: s, index: i }))
      .filter((x) => {
        const lower = x.string.toLowerCase();
        return lower.startsWith(q) || lower.includes(q);
      })
      .sort((a, b) => {
        const aStarts = a.string.startsWith(q) ? 1 : 0;
        const bStarts = b.string.startsWith(q) ? 1 : 0;
        if (aStarts !== bStarts) return bStarts - aStarts;
        return a.string.localeCompare(b.string);
      })
      .slice(0, 20)
      .map((x) => {
        const emoji = emojis[x.index];
        return {
          emoji: emoji.emoji,
          annotation: emoji.annotation,
          score: aStarts ? 1 : 0,
        };
      });

    // Deduplicate by emoji annotation
    const seen = new Set();
    const unique = matched.filter((m) => {
      if (seen.has(m.annotation)) return false;
      seen.add(m.annotation);
      return true;
    });

    setItems(unique);
    setActiveIndex(0);
    setState({ active: true, query, triggerPos });
  }

  function close() {
    setState({ active: false, query: "", triggerPos: 0 });
    setItems([]);
    setActiveIndex(0);
  }

  function pick(emoji, textarea) {
    const value = textarea.value;
    const cursorPos = textarea.selectionStart;
    const { triggerPos } = state();

    const before = value.slice(0, triggerPos - 1);
    const after = value.slice(cursorPos);
    const insertion = ` ${emoji.emoji}`;

    textarea.value = before + insertion + after;

    const newPos = before.length + insertion.length;
    textarea.focus();
    requestAnimationFrame(() => {
      textarea.setSelectionRange(newPos, newPos);
    });

    close();
  }

  function moveNext() {
    setActiveIndex((i) => (i + 1) % items().length);
  }
  function movePrev() {
    setActiveIndex((i) => (i - 1 + items().length) % items().length);
  }
  function hasSuggestions() {
    return state().active && items().length > 0;
  }

  return {
    emojiState: state,
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