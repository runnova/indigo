import { For } from "solid-js";

export default function SelfRoles(props) {
  const roles = () =>
    Object.entries(props.conn.roles() ?? {});

  const assigned = (name) =>
    props.conn.me()?.roles?.includes(name);

  async function toggleRole(name) {
    await props.conn.send({
      cmd: assigned(name)
        ? "self_role_remove"
        : "self_role_add",
      role: name,
    });

    props.conn.setMe((me) => ({
      ...me,
      roles: assigned(name)
        ? me.roles.filter((r) => r !== name)
        : [...me.roles, name],
    }));
  }

  return (
    <div class="self-roles">
      <div className="member_section_label">Available roles</div>

      <For each={roles()}>
        {([name, role]) =>
          role.self_assignable && (
            <button
              classList={{
                assigned: assigned(name),
              }}
              onClick={() => toggleRole(name)}
            >
              {name}
            </button>
          )
        }
      </For>
    </div>
  );
}