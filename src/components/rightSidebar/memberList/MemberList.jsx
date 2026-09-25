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

  createEffect(() => {
    const event = tempState.conn.lastEvent();
    if (event && MEMBER_EVENT_TYPES.has(event.cmd)) {
      setMemberVersion(v => v + 1);
    }
  });

  const toggleSection = (label) => {
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

  const getHoistedRole = (user) => {
    const roles = props.conn.roles?.() ?? {};
    return user.roles?.find(id => roles[id]?.hoisted);
  };

  const getRoleById = (roleId) => {
    const roles = props.conn.roles?.() ?? {};
    return roles[roleId];
  };

  const onlineUsers = createMemo(() => {
    memberVersion();

    const users = props.conn.membersOnline();

    return new Map(
      Array.from(users).map(user => [user.username, user])
    );
  });

  const memberSections = createMemo((prevSections = []) => {
    memberVersion();

    const online = onlineUsers();
    const roles = props.conn.roles?.() ?? {};
    const members = props.conn.members();

    const prevByLabel = new Map(prevSections.map(s => [s.label, s]));
    const assigned = new Set();
    const hoistedSections = new Map();

    for (const user of members) {
      if (!online.has(user.username)) continue;
      const roleId = user.roles?.find(id => roles[id]?.hoisted);
      if (!roleId) continue;
      if (!hoistedSections.has(roleId)) hoistedSections.set(roleId, []);
      hoistedSections.get(roleId).push(user);
      assigned.add(user.username);
    }

    const sections = [];

    const buildSection = (label, users, roleId) => {
      const sorted = [...users].sort((a, b) => a.username.localeCompare(b.username));
      const prev = prevByLabel.get(label);
      const sameContent =
        prev &&
        prev.users.length === sorted.length &&
        prev.users.every((u, i) => u === sorted[i]);
      return sameContent ? prev : { label, users: sorted, roleId };
    };

    for (const [roleId, users] of [...hoistedSections.entries()].sort(
      ([a], [b]) => (roles[a]?.position ?? 0) - (roles[b]?.position ?? 0)
    )) {
      sections.push(buildSection(roles[roleId]?.name ?? roleId, users, roleId));
    }

    const ungroupedOnline = members.filter(
      user => online.has(user.username) && !assigned.has(user.username)
    );
    if (ungroupedOnline.length) sections.push(buildSection("Online", ungroupedOnline, null));

    const offline = members.filter(user => !online.has(user.username));
    if (offline.length) sections.push(buildSection("Offline", offline, null));

    return sections;
  });

  const owner = createMemo(() => {
    memberVersion();

    if (state.settings.ownerCrown) {
      return props.conn.serverInfo()?.owner?.name;
    }
    return null;
  });

  const renderOverlay = state.settings.profileOverlays;

  return (
    <div class="members_list y">
      <For each={memberSections()}>
        {(section) => {
          const isCollapsed = () => collapsedSections().has(section.label);
          const role = () => section.roleId ? getRoleById(section.roleId) : null;
          const roleIcon = () => role()?.icon;

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
                  {roleIcon() && (
                    <img
                      src={roleIcon()}
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

              <For each={isCollapsed() ? [] : section.users}>
                {(user) => (
                  <MemberItem
                    user={user}
                    online={onlineUsers().has(user.username)}
                    onlineData={onlineUsers().get(user.username)}
                    status={user.status}
                    roles={props.conn.roles?.()}
                    getHoistedRole={getHoistedRole}
                    owner={owner() == user.username}
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
