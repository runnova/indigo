import { createSignal, createEffect, onMount, For, Show } from "solid-js";

export function SelfRoles(props) {
  const [roles, setRoles] = createSignal([]);
  const [loading, setLoading] = createSignal(true);

  onMount(() => {
    props.sendRequest({
      cmd: "self_roles_list",
    });
  });

  createEffect(() => {
    const event = props.lastEvent?.();

    if (!event) return;

    if (event.cmd === "self_roles_list") {
      setRoles(event.roles ?? []);
      setLoading(false);
    }
  });

  async function toggleRole(role) {
    await props.sendRequest({
      cmd: role.assigned
        ? "self_role_remove"
        : "self_role_add",
      role: role.name,
    });

    setLoading(true);

    props.sendRequest({
      cmd: "self_roles_list",
    });
  }

  return (
    <div class="self-roles">
      <h2>Self Assignable Roles</h2>

      <Show when={!loading()} fallback={<p>Loading...</p>}>
        <For each={roles()}>
          {(role) => (
            <button
              classList={{
                assigned: role.assigned,
              }}
              onClick={() => toggleRole(role)}
            >
              {role.name}
            </button>
          )}
        </For>
      </Show>
    </div>
  );
}