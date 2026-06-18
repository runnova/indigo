import { Show, onMount, onCleanup } from "solid-js";
import { popout, closePopout } from "./popout";

export default function MemberPopout() {
  let popupRef;

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
          class="member_popout"
          style={{
            position: "fixed",
            right: `245px`,
            top: `${data().y}px`
          }}
        >
          <img
            src={`https://avatars.rotur.dev/.banners/${data().user.username}`}
            alt=""
            class="banner"
          />
          <div className="popupMemberHeader x">
            <div className="pfpWO">
              <img
                src={`https://avatars.rotur.dev/${data().user.username}`}
                alt=""
                class="pfp"
              />
              <img
                src={`https://avatars.rotur.dev/.overlay/${data().user.username}`}
                alt=""
                class="overlay"
              />
            </div>
            <div className="data y">
              <div style={{
                "font-size": "1.5em"
              }}>{data().user.username}</div>
              <div className="data_buttons">
                <button className="y">
                  <small></small>
                </button>
              </div>
            </div>
          </div>

        </div>
      )}
    </Show>
  );
}