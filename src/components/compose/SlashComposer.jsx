import { For, Show, createSignal, createEffect, onMount } from "solid-js";
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
      setSlashState({
        active: true,
        command: null,
        suggestions: slashCommands().filter(c =>
          c.name.startsWith(name)
        )
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
    parseSlash,
    closeSlash,
    buildContent,
    sendSlash
  };
}

export function SlashSuggestions(props) {
  return (
    <Show when={props.slashState.active && !props.slashState.command}>
      <div class="slash_popup y">
        <For each={props.slashState.suggestions}>
          {command => (
            <button
              class="x"
              onClick={() => props.onPick(command)}
            >
              <strong>/{command.name}</strong>
              <span>{command.description}</span>
            </button>
          )}
        </For>
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