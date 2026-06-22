import { Show, onMount, onCleanup } from "solid-js";
import { HiOutlineXMark } from "solid-icons/hi";

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
          <button
            class="dialog_close"
            type="button"
            aria-label="Close dialog"
            onClick={() => props.onClose?.()}
          >
            <HiOutlineXMark size={24} />
          </button>

          {props.children}
        </div>
      </div>
    </Show>
  );
}