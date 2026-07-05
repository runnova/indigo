import { For, createMemo } from "solid-js";
import MemberItem from "./MemberItem";
import { conn } from "../../../App"

export default function MemberList(props) {
  const owner = createMemo(() => {
    if (state.settings.ownerCrown) {
      return conn.serverInfo()?.owner?.name;
    }
    return null;
  });

  return (
    <div class="members_list y">
      <For each={props.sections}>
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
                  online={props.onlineUsers.has(user.username)}
                  roles={props.roles}
                  getHoistedRole={props.getHoistedRole}
                  owner={owner() == user.username}
                />
              )}
            </For>
          </>
        )}
      </For>
    </div>
  );
}