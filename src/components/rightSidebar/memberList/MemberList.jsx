
import { For, createMemo, createSignal, createEffect } from "solid-js";
import MemberItem from "./MemberItem";

const MEMBER_EVENT_TYPES = new Set([
  "user_join",
  "user_leave",
  "user_connect",
  "user_disconnect",
  "user_clients",
  "status_get",
  "user_update",
  "nickname_update",
  "nickname_remove",
  "user_kick",
  "user_roles_get",
]);

export default function MemberList(props) {
  const [collapsedSections, setCollapsedSections] = createSignal(new Set());
  const [memberVersion, setMemberVersion] = createSignal(0);
  const [onlineDirection, setOnlineDirection] = createSignal(null);

  createEffect(() => {
    const event = tempState.conn.lastEvent();

    if (event && MEMBER_EVENT_TYPES.has(event.cmd)) {
      setMemberVersion(v => v + 1);
    }
  });

  const members = createMemo(() => {
    memberVersion();
    return props.conn.members();
  });

  const roles = createMemo(() => {
    memberVersion();
    return props.conn.roles?.() ?? {};
  });

  const onlineUsers = createMemo(() => {
    memberVersion();

    return new Map(
      Array.from(props.conn.membersOnline(), user => [user.username, user])
    );
  });

  const onlineCount = createMemo(() => onlineUsers().size);
  const totalMembers = createMemo(() => members().length);

  const onlinePercentage = createMemo(() => {
    const total = totalMembers();
    return total ? Math.round((onlineCount() / total) * 100) : 0;
  });

  let previousOnlineUsers = null;

  createEffect(() => {
    const current = onlineUsers();

    if (previousOnlineUsers !== null) {
      let joined = false;
      let left = false;

      for (const username of current.keys()) {
        if (!previousOnlineUsers.has(username)) {
          joined = true;
          break;
        }
      }

      for (const username of previousOnlineUsers.keys()) {
        if (!current.has(username)) {
          left = true;
          break;
        }
      }

      if (joined !== left) {
        setOnlineDirection(joined ? "up" : "down");
      } else if (joined && left) {
        setOnlineDirection(null);
      }
    }

    previousOnlineUsers = new Map(current);
  });

  const toggleSection = label => {
    setCollapsedSections(prev => {
      const next = new Set(prev);

      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }

      return next;
    });
  };

  const getHoistedRole = user => {
    const currentRoles = roles();
    return user.roles?.find(id => currentRoles[id]?.hoisted);
  };

  const getRoleById = roleId => roles()[roleId];

  const memberSections = createMemo((previousSections = []) => {
    const online = onlineUsers();
    const currentMembers = members();
    const currentRoles = roles();

    const previousByLabel = new Map(
      previousSections.map(section => [section.label, section])
    );

    const assigned = new Set();
    const hoistedSections = new Map();

    for (const user of currentMembers) {
      if (!online.has(user.username)) continue;

      const roleId = user.roles?.find(id => currentRoles[id]?.hoisted);

      if (!roleId) continue;

      if (!hoistedSections.has(roleId)) {
        hoistedSections.set(roleId, []);
      }

      hoistedSections.get(roleId).push(user);
      assigned.add(user.username);
    }

    const buildSection = (label, users, roleId = null) => {
      const sorted = [...users].sort((a, b) =>
        a.username.localeCompare(b.username)
      );

      const previous = previousByLabel.get(label);

      if (
        previous &&
        previous.roleId === roleId &&
        previous.users.length === sorted.length &&
        previous.users.every((user, index) => user === sorted[index])
      ) {
        return previous;
      }

      return { label, users: sorted, roleId };
    };

    const sections = [];

    const sortedRoles = [...hoistedSections.entries()].sort(
      ([a], [b]) =>
        (currentRoles[a]?.position ?? 0) -
        (currentRoles[b]?.position ?? 0)
    );

    for (const [roleId, users] of sortedRoles) {
      sections.push(
        buildSection(currentRoles[roleId]?.name ?? roleId, users, roleId)
      );
    }

    const ungroupedOnline = [];
    const offline = [];

    for (const user of currentMembers) {
      if (online.has(user.username)) {
        if (!assigned.has(user.username)) {
          ungroupedOnline.push(user);
        }
      } else {
        offline.push(user);
      }
    }

    if (ungroupedOnline.length) {
      sections.push(buildSection("Online", ungroupedOnline));
    }

    if (offline.length) {
      sections.push(buildSection("Offline", offline));
    }

    return sections;
  });

  const owner = createMemo(() => {
    memberVersion();

    return state.settings.ownerCrown
      ? props.conn.serverInfo()?.owner?.name
      : null;
  });

  const renderOverlay = state.settings.profileOverlays;

  return (
    <div class="members_list y">
      <div class="members_list_header x">
        <div className="online_ball"></div>
        <span class="online_count fill">
          {onlineCount()}/{totalMembers()} Online ({onlinePercentage()}%)
        </span>
        <span class="online_direction">
          {onlineDirection() === "up" && (
            <svg viewBox="0 0 16 16" width="14" height="14">
              <path
                d="M8 13V3 M3 8L8 3L13 8"
                stroke="currentColor"
                stroke-width="1.8"
                fill="none"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          )}

          {onlineDirection() === "down" && (
            <svg viewBox="0 0 16 16" width="14" height="14">
              <path
                d="M8 3V13 M3 8L8 13L13 8"
                stroke="currentColor"
                stroke-width="1.8"
                fill="none"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          )}
        </span>
      </div>

      <For each={memberSections()}>
        {section => {
          const isCollapsed = () => collapsedSections().has(section.label);
          const role = () =>
            section.roleId ? getRoleById(section.roleId) : null;

          return (
            <>
              <div
                class="member_section_label x"
                classList={{ collapsed: isCollapsed() }}
                onClick={() => toggleSection(section.label)}
                role="button"
                tabIndex="0"
              >
                <span class="fill x">
                  {role()?.icon && (
                    <img
                      src={role().icon}
                      alt=""
                      class="inline_emoji"
                      loading="lazy"
                    />
                  )}

                  {section.label} ({section.users.length})
                </span>

                <svg
                  class="member_section_chevron"
                  classList={{ rotated: !isCollapsed() }}
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                >
                  <path
                    d="M2 3.5 L5 6.5 L8 3.5"
                    stroke="currentColor"
                    stroke-width="1.5"
                    fill="none"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </div>

              <For
                each={isCollapsed() ? [] : section.users}
                keyed={user => user.username}
              >
                {(user, index) => (
                  <MemberItem
                    user={user}
                    userIndex={index()}
                    online={onlineUsers().has(user.username)}
                    onlineData={onlineUsers().get(user.username)}
                    status={user.status}
                    roles={roles()}
                    getHoistedRole={getHoistedRole}
                    owner={owner() === user.username}
                    renderOverlay={renderOverlay}
                  />
                )}
              </For>
            </>
          );
        }}
      </For>
    </div>
  );
}
