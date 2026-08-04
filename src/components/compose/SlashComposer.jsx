import { For, Show, createSignal, createEffect, onMount, on } from "solid-js";
import { createStore } from "solid-js/store";
import { tempState } from "../../App";
import { HiOutlineXMark, HiOutlinePaperAirplane } from "solid-icons/hi";

export function createSlashCommands() {
  const [slashCommands, setSlashCommands] = createSignal([]);
  const [slashState, setSlashState] = createStore({
    active: false,
    command: null,
    optionIndex: 0,
    values: {},
    suggestions: [],
    selected: 0
  });
  const [providerFilter, setProviderFilter] = createSignal(null);

  onMount(() => {
    tempState?.conn?.send({
      cmd: "slash_list"
    });
  });

  createEffect(() => {
    const event = tempState?.conn.lastEvent();
    if (!event) return;

    if (event.cmd === "slash_list") {
      setSlashCommands(event.commands);
    }
  });

  function parseSlash(value) {
    if (!value.startsWith("/")) {
      setSlashState("active", false);
      return;
    }

    const name = value.slice(1).trim();

    const command = slashCommands().find(c => c.name === name);

    if (!command) {
      const filter = providerFilter();
      const filtered = slashCommands().filter(c =>
        c.name.startsWith(name) &&
        (!filter || c.registeredBy === filter)
      );

      setSlashState({
        active: true,
        command: null,
        suggestions: filtered,
        selected: 0
      });
      return;
    }

    const values = {};

    command.options.forEach(option => {
      values[option.name] = "";
    });

    setSlashState({
      active: true,
      command,
      values
    });
  }

  function closeSlash(textarea) {
    setSlashState({
      active: false,
      command: null,
      values: {},
      suggestions: [],
      optionIndex: 0,
      selected: 0
    });

    if (textarea) {
      textarea.value = "";
      requestAnimationFrame(() => textarea.focus());
    }
  }

  function buildContent(rawValue) {
    let content = rawValue.trim();

    if (slashState.command) {
      content =
        "/" +
        slashState.command.name +
        " " +
        slashState.command.options
          .map(option => slashState.values[option.name] || "")
          .join(" ");
    }

    return content;
  }

  function sendSlash(channel, textarea) {
    if (!slashState.command) return;

    const args = {};

    slashState.command.options.forEach(option => {
      args[option.name] = slashState.values[option.name] || "";
    });

    tempState?.conn?.send({
      cmd: "slash_call",
      command: slashState.command.name,
      channel,
      args
    });

    closeSlash(textarea);
  }

  return {
    slashCommands,
    slashState,
    setSlashState,
    providerFilter,
    setProviderFilter,
    parseSlash,
    closeSlash,
    buildContent,
    sendSlash
  };
}

export function SlashSuggestions(props) {
  const providers = () => {
    const seen = new Set();
    const list = [];

    for (const c of props.slashCommands()) {
      if (c.registeredBy && !seen.has(c.registeredBy)) {
        seen.add(c.registeredBy);
        list.push(c.registeredBy);
      }
    }

    return list;
  };

  const filteredSuggestions = () => {
    const filter = props.providerFilter();
    if (!filter) return props.slashState.suggestions;

    return props.slashState.suggestions.filter(
      c => c.registeredBy === filter
    );
  };

  const groupedSuggestions = () => {
    const groups = [];
    const indexByProvider = new Map();

    for (const c of filteredSuggestions()) {
      const key = c.registeredBy || "";

      if (!indexByProvider.has(key)) {
        indexByProvider.set(key, groups.length);
        groups.push({ registeredBy: key, commands: [] });
      }

      groups[indexByProvider.get(key)].commands.push(c);
    }

    return groups;
  };

  const flatSuggestions = () => {
    const flat = [];
    for (const group of groupedSuggestions()) {
      for (const c of group.commands) flat.push(c);
    }
    return flat;
  };

  createEffect(
    on(flatSuggestions, (list) => {
      if (list.length === 0) {
        if (props.slashState.selected !== 0) {
          props.setSlashState("selected", 0);
        }
        return;
      }

      if (
        props.slashState.selected < 0 ||
        props.slashState.selected >= list.length
      ) {
        props.setSlashState("selected", 0);
      }
    })
  );

  createEffect(
    on(
      () => props.slashState.selected,
      (idx) => {
        const el = document.querySelector(
          `.slash_suggestions_list button[data-index="${idx}"]`
        );
        el?.scrollIntoView({ block: "nearest" });
      }
    )
  );

  function moveSelection(delta) {
    const list = flatSuggestions();
    if (list.length === 0) return;

    const next =
      (props.slashState.selected + delta + list.length) % list.length;

    props.setSlashState("selected", next);
  }

  function pickSelected() {
    const list = flatSuggestions();
    if (list.length === 0) return;

    const idx = Math.min(
      Math.max(props.slashState.selected, 0),
      list.length - 1
    );

    props.onPick(list[idx]);
  }

  createEffect(() => {
    props.onNavRef?.({
      moveNext: () => moveSelection(1),
      movePrev: () => moveSelection(-1),
      selectCurrent: pickSelected,
      hasSuggestions: () => flatSuggestions().length > 0
    });
  });

  return (
    <Show when={props.slashState.active && !props.slashState.command}>
      <div class="slash_popup x">
        <div class="slash_provider_filters y">
          <button
            class={`provider_filter_button default${
              !props.providerFilter() ? " active" : ""
            }`}
            title="All providers"
            onClick={() => props.setProviderFilter(null)}
          >
            /
          </button>

          <For each={providers()}>
            {(provider) => (
              <button
                class={`provider_filter_button${
                  props.providerFilter() === provider ? " active" : ""
                }`}
                title={provider}
                onClick={() =>
                  props.setProviderFilter(
                    props.providerFilter() === provider ? null : provider
                  )
                }
              >
                <img
                  src={`https://avatars.rotur.dev/${provider}`}
                  alt={provider}
                  class="provider_filter_avatar"
                />
              </button>
            )}
          </For>
        </div>

        <div class="slash_suggestions_list y">
          <For each={groupedSuggestions()}>
            {(group) => (
              <>
                <Show when={!props.providerFilter() && group.registeredBy}>
                  <div class="label">{group.registeredBy}</div>
                </Show>

                <For each={group.commands}>
                  {command => {
                    const index = () => flatSuggestions().indexOf(command);
                    const isSelected = () =>
                      index() === props.slashState.selected;

                    return (
                      <button
                        class={`x${isSelected() ? " selected" : ""}`}
                        data-index={index()}
                        aria-selected={isSelected()}
                        onMouseEnter={() =>
                          props.setSlashState("selected", index())
                        }
                        onClick={() => props.onPick(command)}
                      >
                        <strong>/{command.name}</strong>
                        <span>{command.description}</span>
                      </button>
                    );
                  }}
                </For>
              </>
            )}
          </For>
        </div>
      </div>
    </Show>
  );
}

export function SlashForm(props) {
  return (
    <Show when={props.slashState.active && props.slashState.command}>
      <div
        class="slash-form"
        tabindex="0"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            props.onClose();
          }
        }}
      >
        <div class="command">
          /{props.slashState.command.name}
        </div>

        <For each={props.slashState.command.options}>
          {(option) => (
            <label class="slash-option">
              <span>{option.name}</span>

              <input
                type="text"
                placeholder={option.type}
                value={props.slashState.values[option.name] || ""}
                autoFocus
                onInput={(e) =>
                  props.setSlashState(
                    "values",
                    option.name,
                    e.currentTarget.value
                  )
                }
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    props.onClose();
                  } else if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    props.onSend();
                  }
                }}
              />
            </label>
          )}
        </For>
      </div>
    </Show>
  );
}

export function SlashCloseButton(props) {
  return (
    <Show when={props.slashState.command}>
      <button
        class="icon_button"
        onClick={props.onClose}
      >
        <HiOutlineXMark />
      </button>
    </Show>
  );
}

export function SlashSendButton(props) {
  return (
    <Show when={props.slashState.command}>
      <button
        class="icon_button"
        onClick={props.onSend}
      >
        <HiOutlinePaperAirplane />
      </button>
    </Show>
  );
}