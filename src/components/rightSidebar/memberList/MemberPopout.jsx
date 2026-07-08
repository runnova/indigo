import { Show, createSignal, createEffect, onMount, onCleanup } from "solid-js";
import { popout, closePopout } from "./popout";
import MemberProfile from "./MemberPopoutContent";

export default function MemberPopout() {
  let popupRef;

  const [position, setPosition] = createSignal({
    left: 0,
    top: 0
  });

  createEffect(() => {
    const current = popout();

    if (!current || !popupRef) return;

    queueMicrotask(() => {
      const width = popupRef.offsetWidth;
      const height = popupRef.offsetHeight;

      const padding = 12;
      const minRightGap = 250;

      let left = current.x + padding;
      const maxLeft = window.innerWidth - width - minRightGap;
      left = Math.min(left, maxLeft);
      left = Math.max(left, padding);

      let top = current.y - 20;
      top = Math.max(
        padding,
        Math.min(top, window.innerHeight - height - padding)
      );

      setPosition({ left, top });
    });
  });

  createEffect(() => {
    const current = popout();
    popupRef?.offsetWidth;
    popupRef?.offsetHeight;

    if (!current || !popupRef) return;

    queueMicrotask(() => {
      const width = popupRef.offsetWidth;
      const height = popupRef.offsetHeight;

      const padding = 12;
      const minRightGap = 250;

      let left = current.x + padding;
      const maxLeft = window.innerWidth - width - minRightGap;
      left = Math.min(left, maxLeft);
      left = Math.max(left, padding);

      let top = current.y - 20;
      top = Math.max(
        padding,
        Math.min(top, window.innerHeight - height - padding)
      );

      setPosition({ left, top });
    });
  });

  const handlePointerDown = (e) => {
    if (!popout()) return;

    if (popupRef?.contains(e.target)) return;

    if (e.target.closest(".member_item")) return;

    closePopout();
  };

  onMount(() => {
    document.addEventListener("mousedown", handlePointerDown);
  });

  onCleanup(() => {
    document.removeEventListener("mousedown", handlePointerDown);
  });

  return (
    <Show when={popout()}>
      {(data) => (
        <div
          ref={popupRef}
          style={{
            position: "fixed",
            left: `${position().left}px`,
            top: `${position().top}px`,
            "--accent": data().user.theme?.accent,
            "--background": data().user.theme?.background,
            "--primary": data().user.theme?.primary,
            "--secondary": data().user.theme?.secondary,
            "--tertiary": data().user.theme?.tertiary,
            "--text": data().user.theme?.text,
            "transition": " .3s cubic-bezier(0.34, 1.56, 0.64, 1)"
          }}
        >
          <MemberProfile
            username={data().user.username}
            status={data().status?.()}
            roles={data().user.roles}
          />
        </div>
      )}
    </Show>
  );
}