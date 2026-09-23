import { For, Show, createMemo } from "solid-js";

export default function SelfRoles(props) {
  const roles = () => Object.entries(props.conn.roles() ?? {});

  const assigned = (name) => props.conn.me()?.roles?.includes(name);

  const grouped = createMemo(() => {
    const selfAssignable = roles().filter(([, role]) => role.self_assignable);

    const byCategory = {};
    for (const [name, role] of selfAssignable) {
      const cat = role.category || "Other";
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push([name, role]);
    }

    for (const cat in byCategory) {
      byCategory[cat].sort(
        (a, b) => (a[1].position ?? 0) - (b[1].position ?? 0),
      );
    }

    return Object.entries(byCategory).sort(([a], [b]) => a.localeCompare(b));
  });

  async function toggleRole(name) {
    const wasAssigned = assigned(name);

    await props.conn.send({
      cmd: wasAssigned ? "self_role_remove" : "self_role_add",
      role: name,
    });

    props.conn.setMe((me) => ({
      ...me,
      roles: wasAssigned
        ? me.roles.filter((r) => r !== name)
        : [...me.roles, name],
    }));
  }

  return (
    <div class="self-roles">
      <For each={grouped()}>
        {([category, categoryRoles]) => (
          <div class="self-roles_category">
            <div class="member_section_label">{category}</div>
            <Show when={category == "Paid"}>
              <small class="smallnote">There is no official docs for implementing paid purchases. It's also not supported in OCHost.</small>
            </Show>

            <For each={categoryRoles}>
              {([name, role]) => (
                <label class="self-roles_row" style={(category == "Paid") && "opacity: .5"}>
                  <Show when={role.icon}>
                    <img class="self-roles_icon" src={role.icon} alt="" />
                  </Show>

                  <span
                    class="self-roles_color_dot"
                    style={{ "background-color": role.color || "transparent" }}
                  />

                  <div class="self-roles_info fill">
                    <div class="self-roles_name">{role.name || name}</div>
                    <Show when={role.description}>
                      <small class="self-roles_description">
                        {role.description}
                      </small>
                    </Show>
                  </div>

                  <Show when={role.price}>
                    <span class="self-roles_price">{role.price}</span>
                  </Show>
                  <input
                    class="settings_input"
                    type="checkbox"
                    checked={assigned(name)}
                    onChange={() => toggleRole(name)}
                  />
                </label>
              )}
            </For>
          </div>
        )}
      </For>
    </div>
  );
}
