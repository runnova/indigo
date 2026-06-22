import { Show, onMount, onCleanup } from "solid-js";

export default function Dialog(props) {
  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      props.onClose?.();
    }
  };

  onMount(() => {
    document.addEventListener("keydown", handleKeyDown);
  });

  onCleanup(() => {
    document.removeEventListener("keydown", handleKeyDown);
  });

  return (
    <Show when={props.open}>
      <div
        class="dialog_overlay"
        onClick={() => props.onClose?.()}
      >
        <div
          class="dialog"
          onClick={(e) => e.stopPropagation()}
        >
          {props.children}
        </div>
      </div>
    </Show>
  );
}