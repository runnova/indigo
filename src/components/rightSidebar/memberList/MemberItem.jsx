import { Show, createResource, createEffect, createSignal } from "solid-js";
import { openPopout } from "./popout";
import { tempState } from "../../../App";
import {
  HiOutlinePlay,
  HiOutlineComputerDesktop,
  HiOutlineDevicePhoneMobile,
  HiOutlineCommandLine,
} from "solid-icons/hi";

// Global set to track usernames that returned 404
const failedFetchUsernames = new Set();

export default function MemberItem(props) {
  props.user = tempState?.conn
    ?.members()
    ?.find((user) => user.username === props.user.username);

  const [userStatus, setUserStatus] = createSignal(null);
  const [isLoading, setIsLoading] = createSignal(false);
  const [hasFailed, setHasFailed] = createSignal(false);

  const roleId = () =>
    props.getHoistedRole(props.user) ?? props.user.roles?.[0];
  const role = () => props.roles?.[roleId()];

  const fetchStatus = async (username) => {
    if (!username) {
      setUserStatus(null);
      return null;
    }
    try {
      setIsLoading(true);
      const response = await fetch(
        `https://api.rotur.dev/v2/status/live?name=${encodeURIComponent(username)}`
      );
      if (!response.ok) {
        setHasFailed(true);
        failedFetchUsernames.add(username);
        return null;
      }
      const data = await response.json();
      console.log(3333, data)
      setUserStatus(data);
      return data;
    } catch {
      setHasFailed(true);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch status only once on mount (only for first 20 users, skip if 404 before)
  let fetchedOnce = false;
  createEffect(() => {
    if (hasFailed() || fetchedOnce) return;
    if (!props.user?.username) return;

    // Don't fetch if this user previously returned 404
    if (failedFetchUsernames.has(props.user.username)) {
      setHasFailed(true);
      return;
    }

    // Only fetch for first 20 users
    if (props.userIndex >= 20) {
      return;
    }

    fetchedOnce = true;
    fetchStatus(props.user.username);
  });

  // Listen for WebSocket updates (separate from fetch)
  createEffect(() => {
    if (!props.user?.username) return;

    const unsubscribe = tempState?.rotur?.socket?.on(
      "status_update",
      (msg) => {
        // Update status if this message is for our user
        if (msg.user_id === props.user.username || msg.username === props.user.username) {
          setUserStatus((prev) => ({
            ...prev,
            status: msg.presence,
            activities: msg.activities || [],
          }));
        }
      }
    );

    return () => {
      unsubscribe?.();
    };
  });

  // Listen for profile updates (in case nickname, color, etc. changed)
  createEffect(() => {
    if (!props.user?.username) return;

    const unsubscribe = tempState?.rotur?.socket?.on(
      "profile_update",
      (msg) => {
        if (msg.user_id === props.user.username || msg.username === props.user.username) {
          // Refetch user data from tempState.conn.members()
          props.user = tempState?.conn
            ?.members()
            ?.find((user) => user.username === props.user.username);
        }
      }
    );

    return () => {
      unsubscribe?.();
    };
  });

  return (
    <div
      class="member_item x"
      style={{
        opacity: props.online ? 1 : 0.5,
      }}
      onClick={(e) => openPopout(props.user, e.currentTarget, userStatus)}
    >
      <div class="pfpWO">
        <img
          src={(props.user?.pfp) ? props.user.pfp :`https://avatars.rotur.dev/${props.user.username}`}
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
        {userStatus() && (
          <span
            class="status_dot"
            data-tooltip={userStatus().presence}
            classList={{
              online: userStatus().presence === "online",
              idle: userStatus().presence === "idle",
              offline: userStatus().presence === "dnd" || !userStatus().presence,
            }}
          />
        )}
      </div>
      <div class="data y fill">
        <span
          className="username"
          style={
            role()?.gradient
              ? {
                  background: `linear-gradient(90deg, ${role().gradient.join(", ")})`,
                  "-webkit-background-clip": "text",
                  "-webkit-text-fill-color": "transparent",
                  "background-clip": "text",
                  color: "transparent",
                }
              : {
                  color: props.user.color,
                }
          }
        >
          <span style={{ "margin-right": "3pt" }}>
            {props.user?.nickname || props.user.display_name || props.user.username}
          </span>
          {props.owner ? (
            <img
              src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' height='24px' viewBox='0 -960 960 960' width='24px' fill='%23ffc800'%3E%3Cpath d='M240-160q-17 0-28.5-11.5T200-200q0-17 11.5-28.5T240-240h480q17 0 28.5 11.5T760-200q0 17-11.5 28.5T720-160H240Zm28-140q-29 0-51.5-19T189-367l-40-254q-2 0-4.5.5t-4.5.5q-25 0-42.5-17.5T80-680q0-25 17.5-42.5T140-740q25 0 42.5 17.5T200-680q0 7-1.5 13t-3.5 11l125 56 125-171q-11-8-18-21t-7-28q0-25 17.5-42.5T480-880q25 0 42.5 17.5T540-820q0 15-7 28t-18 21l125 171 125-56q-2-5-3.5-11t-1.5-13q0-25 17.5-42.5T820-740q25 0 42.5 17.5T880-680q0-25-17.5-42.5T820-620q-2 0-4.5-.5t-4.5-.5l-40 254q-5 29-27.5 48T692-300H268Zm0-80h424l26-167-46 20q-26 11-53 4t-44-30l-95-131-95 131q-17 23-44 30t-53-4l-46-20 26 167Zm212 0Z'/%3E%3C/svg%3E"
              class="owner_crown"
              data-tooltip="Server Owner"
            />
          ) : null}
          {[
            ...(userStatus()?.clients ?? []),
            ...(userStatus()?.devices ?? []),
          ].map((item) => {
            const icons = {
              computer: HiOutlineComputerDesktop,
              mobile: HiOutlineDevicePhoneMobile,
              console: HiOutlineCommandLine,
              terminal: HiOutlineCommandLine,
            };

            if (item === "indigo") {
              return (
                <img
                  class="client_icon"
                  src="https://runnova.github.io/indigo/icon_small.svg"
                  data-tooltip={"Indigo: The coolest OC client"}
                  data-tooltip-icon="https://runnova.github.io/indigo/icon_small.svg"
                />
              );
            }

            if (item === "originchats.com") {
              return (
                <img
                  class="client_icon"
                  src="https://originchats.com/dms.png"
                  data-tooltip={item}
                />
              );
            }

            if (item === "bot") {
              return (
                <svg
                  data-tooltip="Bot"
                  class="client_icon"
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M12 8V4H8" />
                  <rect width="16" height="12" x="4" y="8" rx="2" />
                  <path d="M2 14h2" />
                  <path d="M20 14h2" />
                  <path d="M15 13v2" />
                  <path d="M9 13v2" />
                </svg>
              );
            }

            const Icon = icons[item];

            return Icon ? (
              <Icon class="client_icon" data-tooltip={item} />
            ) : null;
          })}
        </span>
        <Show when={props.online}>
          <small class="activity_display">
            {userStatus()?.activities?.length ? (
              userStatus().activities[0].image ? (
                <img src={userStatus().activities[0].image} />
              ) : (
                <HiOutlinePlay />
              )
            ) : (
              ""
            )}
            {isLoading()
              ? "Loading..."
              : userStatus()?.activities?.length
                ? `${userStatus().activities[0].title} ${
                    userStatus()?.status ? `\u2022 ${userStatus()?.status}` : ""
                  }`
                : userStatus()?.status ?? props.user?.status?.text ?? ""}
          </small>
        </Show>
      </div>
    </div>
  );
}
