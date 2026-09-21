import { createSignal, Show } from "solid-js";
import { HiOutlineChatBubbleOvalLeft, HiOutlineFaceSmile, HiOutlinePencil, HiOutlineDocumentDuplicate, HiOutlineTrash } from "solid-icons/hi";

export function MessageActions(props) {
  return (
    <div
      class="message_actions">
      <button onClick={() => props.onReply?.()} data-tooltip="Reply">
        <HiOutlineChatBubbleOvalLeft />
      </button>

      <button onClick={() => props.onReact?.()} data-tooltip="React">
        <HiOutlineFaceSmile />
      </button>

      <button data-tooltip="Copy Text"
        onClick={() => {
          navigator.clipboard.writeText(props.content);
        }}
      >
        <HiOutlineDocumentDuplicate />
      </button>

      {props.canEdit && (
        <button data-tooltip="Edit" onClick={() => props.onEdit?.()}>
          <HiOutlinePencil />
        </button>
      )}

      {props.canDelete && (
        <button data-tooltip="Delete" onClick={() => props.onDelete?.()}>
          <HiOutlineTrash />
        </button>
      )}
    </div>
  );
}
