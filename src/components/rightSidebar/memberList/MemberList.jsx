import { For, createMemo } from "solid-js";
import MemberItem from "./MemberItem";

export default function MemberList(props) {
  const getHoistedRole = (user) => {
  const roles = props.conn.roles?.() ?? {};

  return user.roles?.find(id => roles[id]?.hoisted);
};

  const onlineUsers = createMemo(
    () => new Set(props.conn.membersOnline().map(u => u.username))
  );

  const memberSections = createMemo(() => {
    const online = onlineUsers();
    const roles = props.conn.roles?.() ?? {};
    const members = props.conn.members();

    const sections = [];
    const assigned = new Set();
    const hoistedSections = new Map();

    for (const user of members) {
      if (!online.has(user.username)) continue;

      const roleId = user.roles?.find(id => roles[id]?.hoisted);

      if (!roleId) continue;

      if (!hoistedSections.has(roleId)) {
        hoistedSections.set(roleId, []);
      }

      hoistedSections.get(roleId).push(user);
      assigned.add(user.username);
    }

    for (const [roleId, users] of [...hoistedSections.entries()].sort(
      ([a], [b]) => (roles[a]?.position ?? 0) - (roles[b]?.position ?? 0)
    )) {
      users.sort((a, b) => a.username.localeCompare(b.username));

      sections.push({
        label: roles[roleId]?.name ?? roleId,
        users,
      });
    }

    const ungroupedOnline = members.filter(
      user => online.has(user.username) && !assigned.has(user.username)
    );

    if (ungroupedOnline.length) {
      sections.push({
        label: "Online",
        users: ungroupedOnline,
      });
    }

    const offline = members.filter(
      user => !online.has(user.username)
    );

    if (offline.length) {
      sections.push({
        label: "Offline",
        users: offline,
      });
    }

    return sections;
  });
  const owner = createMemo(() => {
    if (state.settings.ownerCrown) {
      return props.conn.serverInfo()?.owner?.name;
    }
    return null;
  });
  const renderOverlay = state.settings.profileOverlays;
  return (
    <div class="members_list y">
      <For each={memberSections()}>
        {(section) => (
          <>
            <div class="member_section_label">
              {section.label} ({section.users.length})
            </div>

            <For
              each={[...section.users].sort((a, b) =>
                a.username.localeCompare(b.username)
              )}
            >
              {(user) => (
                <MemberItem
                  user={user}
                  online={onlineUsers().has(user.username)}
                  roles={props.conn.roles?.()}
                  getHoistedRole={getHoistedRole}
                  owner={owner() == user.username}
                  renderOverlay={renderOverlay}
                />
              )}
            </For>
          </>
        )}
      </For>
    </div>
  );
}