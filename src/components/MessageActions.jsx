import { createSignal, Show } from "solid-js";
import { HiOutlineChatBubbleOvalLeft, HiOutlineFaceSmile, HiOutlinePencil, HiOutlineDocumentDuplicate, HiOutlineTrash } from "solid-icons/hi";

export function MessageActions(props) {
  return (
    <div
      class="message_actions">
      <button onClick={() => props.onReply?.()}>
        <HiOutlineChatBubbleOvalLeft />
      </button>

      <button onClick={() => props.onReact?.()}>
        <HiOutlineFaceSmile />
      </button>

      <button
        onClick={() => {
          navigator.clipboard.writeText(props.content);
        }}
      >
        <HiOutlineDocumentDuplicate />
      </button>

      {props.canEdit && (
        <button onClick={() => props.onEdit?.()}>
          <HiOutlinePencil />
        </button>
      )}

      {props.canDelete && (
        <button onClick={() => props.onDelete?.()}>
          <HiOutlineTrash />
        </button>
      )}
    </div>
  );
}