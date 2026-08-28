import { Show, createSignal, createEffect, onMount, createResource, For } from "solid-js";
import "./popout.css"
import { parseMarkdown } from "../../messages/ParseMarkdown"
import { HiOutlineBanknotes, HiOutlineCalendar, HiOutlineUser } from "solid-icons/hi";
import { renderICN } from "./renderICN";
import { ActivityCard } from "./ActivityCard";

export function formatTime(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatMonthYear(utcMs) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(utcMs));
}

export default function MemberProfile(props) {
 const [profile] = createResource(
  () => props.username,
  async (username) => {
    console.log("loading profile:", username);

    if (!username) return null;

    const res = await fetch(
      `https://api.rotur.dev/profile?name=${username}&include_posts=0`
    );

    return await res.json();
  }
);

  const [showAllRoles, setShowAllRoles] = createSignal(false);

  const status = () => profile()?.status;
  console.log(status())
  return (
    <>
      <div
        className="member_popout y"
        style={{
          "--accent": profile()?.theme?.accent || "transparent",
          ...(tempState.settings?.customProfileThemes ? {
            "--fg-one": profile()?.theme?.text || "#ffffff",
            "--hl-one": profile()?.theme?.accent || "rgb(141, 42, 255)",
            "--bg-one": profile()?.theme?.background || "#010101",
            "--bg-two": profile()?.theme?.primary || "#0D0D0D",
            "--bg-three": profile()?.theme?.secondary || "#1d1d1d",
            "--bg-four": profile()?.theme?.tertiary || "#3a3a3a",
          } : {})
        }}
      >
        <Show when={profile.loading}>
          <div class="popup_loader">
            <div class="spinner" />
          </div>
        </Show>
        <div classList={{ "popup_content": true, loading: profile.loading }}>
          <video
            src={`https://avatars.rotur.dev/.backgrounds/${props.username}`}
            autoplay
            loop
            playsinline
            aria-hidden="true"
            class="profile_video_background"
            style="opacity: 0.65; filter: brightness(0.45);"
          />

          <img
            src={`https://avatars.rotur.dev/.banners/${props.username}`}
            alt=""
            class="banner"
          />
          <Show when={status()?.status}>
            <div className="status">
              <div className="status_text">
                {status().status}
              </div>
            </div>
          </Show>

          <div class="popupMemberHeader x">
            <div class="pfpWO">
              <img
                src={`https://avatars.rotur.dev/${props.username}`}
                alt=""
                class="pfp"
              />
              <img
                src={`https://api.rotur.dev/cosmetics/overlays/${profile()?.status?.data?.overlay}.gif`}
                alt=""
                class="overlay"
              />
              {status() && (
                <span
                  class="status_dot"
                  classList={{
                    online: status().presence === "online",
                    idle: status().presence === "idle",
                    offline: status().presence === "offline" || !status().presence
                  }}
                />
              )}
            </div>

            <div class="data y" style={{ "margin": ".5em 0wa" }}>
              <div class="x" style={{
                "font-size": "1.5em",
                "flex-wrap": "wrap",
                "align-items": "center",
                "overflow-wrap": "anywhere"
              }}>
                <span onClick={() => window.open("https://rotur.dev/profile/" + profile()?.username)} class="username_clickable" style={{ "margin-right": ".3em" }}>{profile()?.display_name || profile()?.username}</span>
                <small style={{ "font-size": "14px" }}>
                  {profile()?.pronouns}
                </small>
              </div>
              <span style={{"font-size": "small", "margin-bottom": ".3em"}}>{(profile()?.display_name) ? profile()?.username : ""}</span>

              <div class="data_buttons x" style={{ "font-size": "small" }}>
                {profile()?.group_tag ? (<button onClick={() => { window.open(`https://rotur.dev/groups/${profile()?.group_tag}`) }}>
                  <img
                    src={`https://api.rotur.dev/groups/${profile()?.group_tag}/icon.jpg`}
                    alt=""
                    class="grptgic"
                  />
                  {profile()?.group_tag}
                </button>) : ""}
                <button>
                  {profile()?.system}
                </button>
              </div>
            </div>
          </div>

          <div style={{ "margin": ".3em", "gap": ".3em" }} className="y">
            <Show when={profile()?.badges?.length}>
              <div class="badges x">
                {profile().badges.map((badge) => (
                  <span
                  data-tooltip={badge.name + ": " + badge.description}
                    innerHTML={renderICN(badge.icon)}
                  />
                ))}
              </div>
            </Show>

            <Show when={profile()}>
              {(p) => (
                <>
                  <div>
                    <div class="roles_title">About Me</div>
                    <div
                      style={{
                        "white-space": "pre-wrap",
                        "max-height": "150px",
                        "overflow-y": "auto"
                      }}
                    >
                      {parseMarkdown(p().bio)}
                    </div>
                  </div>
                  <Show when={status()?.activities?.length}>
                    <div class="activities_section">
                      <div class="x activities_list">
                        <For each={status().activities}>
                          {(activity) => <ActivityCard activity={activity} />}
                        </For>
                      </div>
                    </div>
                  </Show>

                  <Show when={props.roles?.length}>
                    <div class="roles_section">
                      <div class="roles_title">Roles</div>

                      <div class="roles_list">
                        {(showAllRoles()
                          ? props.roles
                          : props.roles.slice(0, 5)
                        ).map((role) => (
                          <div class="role_chip">
                            <span
                              class="role_dot"
                              style={{
                                background: tempState.conn?.roles()?.[role]?.color || "#888"
                              }}
                            />
                            {role}
                          </div>
                        ))}
                        <Show when={props.roles.length > 5}>
                          <button
                            class="roles_toggle"
                            onClick={() => setShowAllRoles(v => !v)}
                          >
                            {showAllRoles()
                              ? "Show less"
                              : `+${props.roles.length - 5} more`}
                          </button>
                        </Show>
                      </div>

                    </div>
                  </Show>

                  <small style={{ "margin-top": "1em", "align-items": "center", "gap": ".8em" }} class="x">
                    <div class="x" style={{ "align-items": "center", "gap": ".3em", "opacity": ".8" }}>
                      <HiOutlineCalendar />
                      {formatMonthYear(p().created)}

                    </div>
                    <div class="x" style={{ "align-items": "center", "gap": ".3em", "opacity": ".5" }}>
                      <HiOutlineUser />
                      #{p().index}

                    </div>

                    <div class="x" style={{ "align-items": "center", "gap": ".3em", "opacity": ".5" }}>
                      <HiOutlineBanknotes />
                      {p().currency} RC
                    </div>
                  </small>
                </>
              )}
            </Show>
          </div>
        </div>
      </div>

    </>
  );
}
