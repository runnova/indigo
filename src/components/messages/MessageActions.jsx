import {
  HiOutlineChatBubbleOvalLeft,
  HiOutlineFaceSmile,
  HiOutlinePencil,
  HiOutlineDocumentDuplicate,
  HiOutlineTrash,
} from "solid-icons/hi";

export function MessageActions(props) {
  const { channel, messageId, onQuickReact, quickReactions, ...rest } = props;
  const reactions = (quickReactions ?? "👍, ❤️, 😂, 🎉, 👎")
    .split(",")
    .map((emoji) => emoji.trim())
    .filter((e) => e);

  return (
    <div class="message_actions x">
      {reactions.length > 0 && (
        <div class="quick_reactions x">
          {reactions.map((emoji, index) => (
            <button
              key={index}
              data-tooltip={emoji}
              onClick={() => onQuickReact?.(emoji, messageId, channel)}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
      <vr></vr>

      <button
        data-tooltip="Copy Text"
        onClick={() => {
          navigator.clipboard.writeText(rest.content);
        }}
      >
        <HiOutlineDocumentDuplicate />
      </button>

      {rest.canEdit && (
        <button data-tooltip="Edit" onClick={() => props.onEdit?.()}>
          <HiOutlinePencil />
        </button>
      )}

      {rest.canDelete && (
        <button data-tooltip="Delete" onClick={() => props.onDelete?.()}>
          <HiOutlineTrash />
        </button>
      )}

      <button onClick={() => props.onReact?.()} data-tooltip="React">
        <HiOutlineFaceSmile />
      </button>
      <button onClick={() => props.onReply?.()} data-tooltip="Reply">
        <HiOutlineChatBubbleOvalLeft />
      </button>
    </div>
  );
}
