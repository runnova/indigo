import { createSignal, Show } from "solid-js";

export function MessageActions(props) {
  return (
    <div
      class="message_actions"
      onMouseEnter={() => clearTimeout(hideTimer)}>
      <button onClick={() => props.onReply?.()}>
        Reply
      </button>

      <button onClick={() => props.onReact?.()}>
        React
      </button>

      <button
        onClick={() => {
          navigator.clipboard.writeText(props.content);
        }}
      >
        Copy
      </button>

      {props.canEdit && (
        <button onClick={() => props.onEdit?.()}>
          Edit
        </button>
      )}

      {props.canDelete && (
        <button onClick={() => props.onDelete?.()}>
          Delete
        </button>
      )}
    </div>
  );
}