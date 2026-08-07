import { For, Show } from "solid-js";
import "./autocomplete.css"

export default function Autocomplete(props) {
  return (
    <Show when={props.items().length > 0}>
      <div class="autocomplete_popup">
        <For each={props.items()}>
          {(item, i) => (
            <div
              class="autocomplete_item"
              classList={{ active: i() === props.activeIndex() }}
              onMouseDown={(e) => {
                e.preventDefault();
                props.onPick(item);
              }}
              onMouseEnter={() => props.setActiveIndex(i())}
            >
              {props.renderItem(item)}
            </div>
          )}
        </For>
      </div>
    </Show>
  );
}
