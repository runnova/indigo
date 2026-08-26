import { createSignal } from "solid-js";
import { tempState } from "../../App";

export function createMentionAutocomplete() {
  const [state, setState] = createSignal({
    active: false,
    query: "",
    triggerPos: 0,
  });
  const [activeIndex, setActiveIndex] = createSignal(0);
  const [items, setItems] = createSignal([]);

  function parse(value, cursorPos) {
    const uptoCursor = value.slice(0, cursorPos);
    const match = uptoCursor.match(/(?:^|\s)@([a-zA-Z0-9_]*)$/);

    if (!match) {
      if (state().active) close();
      return;
    }

    const query = match[1];
    const triggerPos = cursorPos - query.length - 1;

    if (query.length < 1) {
      setState({ active: false, query: "", triggerPos });
      setItems([]);
      return;
    }

    const members = tempState?.conn?.members?.() || [];
    const q = query.toLowerCase();

    const filtered = members
      .map((member) => {
        const name = member.username.toLowerCase();

        let score = -1;
        if (name === q) score = 3;
        else if (name.startsWith(q)) score = 2;
        else if (name.includes(q)) score = 1;

        return { member, score };
      })
      .filter((x) => x.score >= 0)
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.member.username.localeCompare(b.member.username),
      )
      .map((x) => x.member)
      .slice(0, 5);
    setItems(filtered);
    setActiveIndex(0);
    setState({ active: true, query, triggerPos });
  }

  function close() {
    setState({ active: false, query: "", triggerPos: 0 });
    setItems([]);
    setActiveIndex(0);
  }

  function pick(member, textarea) {
    const value = textarea.value;
    const cursorPos = textarea.selectionStart;
    const { triggerPos } = state();

    const before = value.slice(0, triggerPos);
    const after = value.slice(cursorPos);
    const insertion = `@${member.username} `;

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
    mentionState: state,
    mentionItems: items,
    activeIndex,
    setActiveIndex,
    parseMention: parse,
    closeMention: close,
    pickMention: pick,
    moveNext,
    movePrev,
    hasSuggestions,
  };
}
