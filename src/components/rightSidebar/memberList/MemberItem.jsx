import { openPopout } from "./popout";

export default function MemberItem(props) {
  const roleId = () =>
    props.getHoistedRole(props.user) ?? props.user.roles?.[0];

  const role = () =>
    props.roles?.[roleId()];

  return (
    <div
      class="member_item x"
      style={{
        opacity: props.online ? 1 : 0.5
      }}
      onClick={(e) => openPopout(props.user, e.currentTarget)}
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

      <span
        style={{
          color: role()?.color
        }}
      >
        {props.user.username}
      </span>
    </div>
  );
}