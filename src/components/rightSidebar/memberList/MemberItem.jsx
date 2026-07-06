import { Show, createResource } from "solid-js";
import { openPopout } from "./popout";

export default function MemberItem(props) {
  const roleId = () =>
    props.getHoistedRole(props.user) ?? props.user.roles?.[0];

  const role = () =>
    props.roles?.[roleId()];

  const [status] = createResource(
    () => props.online && props.user.username,
    async username => {
      if (!username) return null;

      try {
        return await tempState.rotur.status.get(username);
      } catch {
        return null;
      }
    }
  );
  return (
    <div
      class="member_item x"
      style={{
        opacity: props.online ? 1 : 0.5
      }}
      onClick={(e) => openPopout(props.user, e.currentTarget, status)}
    >
      <div class="pfpWO">
        <img
          src={`https://avatars.rotur.dev/${props.user.username}`}
          alt=""
          class={"pfp " + (!props.renderOverlay ? "overlayless" : "")}
          loading="lazy"
        />

        {props.renderOverlay && (
          <img
            src={`https://avatars.rotur.dev/.overlay/${props.user.username}`}
            alt=""
            class="overlay"
            loading="lazy"
          />
        )}
      </div>

      <div className="data y">
        <span
          style={
            role()?.gradient
              ? {
                background: `linear-gradient(90deg, ${role().gradient.join(", ")})`,
                "-webkit-background-clip": "text",
                "-webkit-text-fill-color": "transparent",
                "background-clip": "text",
                color: "transparent"
              }
              : {
                color: role()?.color
              }
          }
        >
          {props.user.username}
          {(props?.owner) ?
            <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' height='24px' viewBox='0 -960 960 960' width='24px' fill='%23ffc800'%3E%3Cpath d='M240-160q-17 0-28.5-11.5T200-200q0-17 11.5-28.5T240-240h480q17 0 28.5 11.5T760-200q0 17-11.5 28.5T720-160H240Zm28-140q-29 0-51.5-19T189-367l-40-254q-2 0-4.5.5t-4.5.5q-25 0-42.5-17.5T80-680q0-25 17.5-42.5T140-740q25 0 42.5 17.5T200-680q0 7-1.5 13t-3.5 11l125 56 125-171q-11-8-18-21t-7-28q0-25 17.5-42.5T480-880q25 0 42.5 17.5T540-820q0 15-7 28t-18 21l125 171 125-56q-2-5-3.5-11t-1.5-13q0-25 17.5-42.5T820-740q25 0 42.5 17.5T880-680q0 25-17.5 42.5T820-620q-2 0-4.5-.5t-4.5-.5l-40 254q-5 29-27.5 48T692-300H268Zm0-80h424l26-167-46 20q-26 11-53 4t-44-30l-95-131-95 131q-17 23-44 30t-53-4l-46-20 26 167Zm212 0Z'/%3E%3C/svg%3E" className="owner_crown"></img>
            : ""}
        </span>

        <Show when={props.online && status}>
          <small>{status.loading ? "Loading..." : status()?.status}</small>
        </Show>
      </div>
    </div>
  );
}