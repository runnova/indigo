import { For } from "solid-js";
import MemberItem from "./MemberItem";

export default function MemberList(props) {
  return (
    <div class="members_list y">
      <For each={props.sections}>
        {(section) => (
          <>
            <div class="member_section_label">
              {section.label} — {section.users.length}
            </div>

            <For each={section.users}>
              {(user) => (
                <MemberItem
                  user={user}
                  online={props.onlineUsers.has(user.username)}
                  roles={props.roles}
                  getHoistedRole={props.getHoistedRole}
                />
              )}
            </For>
          </>
        )}
      </For>
    </div>
  );
}