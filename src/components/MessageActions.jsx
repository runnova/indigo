import { createSignal, Show } from "solid-js";
import { HiSolidChatBubbleOvalLeft, HiSolidFaceSmile, HiSolidPencil, HiSolidDocumentDuplicate, HiSolidTrash } from "solid-icons/hi";

export function MessageActions(props) {
  return (
    <div
      class="message_actions"
      onMouseEnter={() => clearTimeout(hideTimer)}>
      <button onClick={() => props.onReply?.()}>
        <HiSolidChatBubbleOvalLeft/>
      </button>

      <button onClick={() => props.onReact?.()}>
        <HiSolidFaceSmile/>
      </button>

      <button
        onClick={() => {
          navigator.clipboard.writeText(props.content);
        }}
      >
        <HiSolidDocumentDuplicate/>
      </button>

      {props.canEdit && (
        <button onClick={() => props.onEdit?.()}>
          <HiSolidPencil/>
        </button>
      )}

      {props.canDelete && (
        <button onClick={() => props.onDelete?.()}>
          <HiSolidTrash/>
        </button>
      )}
    </div>
  );
}