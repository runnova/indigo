// channelAutocomplete.js
import { createSignal } from "solid-js";
import { tempState } from "../../App";

export function createChannelAutocomplete() {
  const [state, setState] = createSignal({
    active: false,
    query: "",
    triggerPos: 0
  });
  const [activeIndex, setActiveIndex] = createSignal(0);
  const [items, setItems] = createSignal([]);

  function flattenChannels(query) {
    const channels = tempState?.conn?.channels?.() || [];
    const results = [];

    for (const ch of channels) {
      if (ch.name?.toLowerCase().includes(query.toLowerCase())) {
        results.push({ type: "channel", name: ch.name, channel: ch });
      }
      for (const thread of ch.threads || []) {
        if (thread.name?.toLowerCase().includes(query.toLowerCase())) {
          results.push({
            type: "thread",
            name: thread.name,
            channel: ch,
            thread
          });
        }
      }
    }

    return results.slice(0, 5);
  }

  function parse(value, cursorPos) {
    const uptoCursor = value.slice(0, cursorPos);
    const match = uptoCursor.match(/(?:^|\s)#([a-zA-Z0-9_-]*)$/);

    if (!match) {
      if (state().active) close();
      return;
    }

    const query = match[1];
    const triggerPos = cursorPos - query.length - 1;

    if (query.length < 2) {
      setState({ active: false, query: "", triggerPos });
      setItems([]);
      return;
    }

    setItems(flattenChannels(query));
    setActiveIndex(0);
    setState({ active: true, query, triggerPos });
  }

  function close() {
    setState({ active: false, query: "", triggerPos: 0 });
    setItems([]);
    setActiveIndex(0);
  }

  function pick(item, textarea) {
    const value = textarea.value;
    const cursorPos = textarea.selectionStart;
    const { triggerPos } = state();

    const before = value.slice(0, triggerPos);
    const after = value.slice(cursorPos);
    const insertion = `#${item.name} `;

    textarea.value = before + insertion + after;

    const newPos = before.length + insertion.length;
    textarea.focus();
    requestAnimationFrame(() => {
      textarea.setSelectionRange(newPos, newPos);
    });

    close();
  }

  function moveNext() {
    setActiveIndex(i => (i + 1) % items().length);
  }
  function movePrev() {
    setActiveIndex(i => (i - 1 + items().length) % items().length);
  }
  function hasSuggestions() {
    return state().active && items().length > 0;
  }

  return {
    channelState: state,
    channelItems: items,
    activeIndex,
    setActiveIndex,
    parseChannel: parse,
    closeChannel: close,
    pickChannel: pick,
    moveNext,
    movePrev,
    hasSuggestions
  };
}
