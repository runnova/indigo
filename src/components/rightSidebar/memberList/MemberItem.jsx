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
          class="pfp"
          loading="lazy"
        />
        <img
          src={`https://avatars.rotur.dev/.overlay/${props.user.username}`}
          alt=""
          class="overlay"
          loading="lazy"
        />
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
        </span>

        <Show when={props.online}>
          <small>{status.loading ? "Loading..." : status().status}</small>
        </Show>
      </div>
    </div>
  );
}