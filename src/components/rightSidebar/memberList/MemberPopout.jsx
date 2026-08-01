import { Show, createSignal, createEffect, onMount, onCleanup } from "solid-js";
import { popout, closePopout } from "./popout";
import MemberProfile from "./MemberPopoutContent";

export default function MemberPopout() {
  let popupRef;

  const [position, setPosition] = createSignal({ left: 0, top: 0 });

  function recalcPosition() {
    const current = popout();
    if (!current || !popupRef) return;

    const width = popupRef.offsetWidth;
    const height = popupRef.offsetHeight;

    const padding = 12;
    const minRightGap = (state.settings.thirdBarWidth || 0) + 20;

    // clamp horizontally
    let left = current.x + padding;
    const maxLeft = window.innerWidth - width - minRightGap;
    left = Math.min(left, Math.max(maxLeft, padding));
    left = Math.max(left, padding);

    // clamp vertically
    let top = current.y - 20;
    const maxTop = window.innerHeight - height - padding;
    top = Math.min(top, Math.max(maxTop, padding));
    top = Math.max(top, padding);

    setPosition({ left, top });
  }

  // Recalculate whenever popout() changes or the ref's size changes
  createEffect(() => {
    popout();
    popupRef?.offsetWidth;
    popupRef?.offsetHeight;
    queueMicrotask(recalcPosition);
  });

  // Recalculate on scroll/resize too, since the anchor element can move
  onMount(() => {
    window.addEventListener("resize", recalcPosition);
    window.addEventListener("scroll", recalcPosition, true);
  });

  onCleanup(() => {
    window.removeEventListener("resize", recalcPosition);
    window.removeEventListener("scroll", recalcPosition, true);
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
    <Show when={popout()} keyed>
      {(data) => {
        const user =
          typeof data.user === "string"
            ? { username: data.user, roles: [], theme: {} }
            : data.user;

        return (
          <div
            ref={popupRef}
            style={{
              position: "fixed",
              left: `${position().left}px`,
              top: `${position().top}px`,
              "--accent": user.theme?.accent,
              "--background": user.theme?.background,
              "--primary": user.theme?.primary,
              "--secondary": user.theme?.secondary,
              "--tertiary": user.theme?.tertiary,
              "--text": user.theme?.text,
              transition: ".3s cubic-bezier(0.34, 1.56, 0.64, 1)"
            }}
          >
            <MemberProfile
              username={user.username}
              status={data.status?.()}
              roles={user.roles}
            />
          </div>
        );
      }}
    </Show>
  );
}