import { onCleanup, createEffect } from "solid-js";

createEffect(() => {
  const handleKeyPress = (e) => {
    const isInputFocused =
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement ||
      e.target.contentEditable === "true";

    if (isInputFocused || state.editing || state.replying) return;

    if (
      e.key.length === 1 &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      e.key !== " "
    ) {
      const messageInput = document.querySelector(
        ".message_composer_input",
      );

      if (messageInput) {
        messageInput.focus();

        document.execCommand("insertText", false, e.key);

        e.preventDefault();
      }
    }
  };

  document.addEventListener("keypress", handleKeyPress);
  onCleanup(() => {
    document.removeEventListener("keypress", handleKeyPress);
  });
});
