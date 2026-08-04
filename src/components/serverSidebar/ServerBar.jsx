import { For, createSignal, Show, createMemo } from "solid-js";
import Dialog from "../Dialog.jsx";
import ServerBrowser from "./discovery/ServerBrowser.jsx";
import Settings from "./Settings"
import { HiOutlineAdjustmentsHorizontal, HiOutlineChevronDown } from "solid-icons/hi";

export default function ServerBar(props) {
  const [dialogOpen, setDialogOpen] = createSignal(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = createSignal(false);

  const [dragSrc, setDragSrc] = createSignal(null); // { src, fromGroupId }
  const [dragOverGroupId, setDragOverGroupId] = createSignal(null);

  const fallbackIcon = `https://icons.veryicon.com/png/o/commerce-shopping/soft-designer-online-tools-icon/group-38.png`;

  const groups = () => props.groups ?? [];

  function genId() {
    return `grp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }

  // servers not inside any group, in top-level order
  const ungroupedServers = createMemo(() => {
    const grouped = new Set(groups().flatMap(g => g.servers ?? []));
    return props.servers.filter(s => !grouped.has(s.src));
  });

  function serverBySrc(src) {
    return props.servers.find(s => s.src === src);
  }

  function updateGroups(next) {
    props.onGroupsChange(next);
  }

  function toggleCollapse(groupId) {
    updateGroups(
      groups().map(g =>
        g.id === groupId ? { ...g, collapsed: !g.collapsed } : g
      )
    );
  }

  function removeFromAllGroups(src) {
    return groups()
      .map(g => ({ ...g, servers: (g.servers ?? []).filter(s => s !== src) }))
      .filter(g => (g.servers ?? []).length > 0);
  }

  // Drop server onto another server -> form/extend a group
  function handleDropOnServer(targetSrc, targetGroupId) {
    const drag = dragSrc();
    setDragOverGroupId(null);
    if (!drag || drag.src === targetSrc) return;

    let nextGroups = removeFromAllGroups(drag.src);

    if (targetGroupId) {
      // add to existing group
      nextGroups = nextGroups.map(g =>
        g.id === targetGroupId
          ? { ...g, servers: [...(g.servers ?? []), drag.src] }
          : g
      );
    } else {
      // target is ungrouped -> create new group with target + dragged
      nextGroups = [
        ...nextGroups,
        {
          id: genId(),
          name: "New Group",
          color: "#5865F2",
          collapsed: false,
          servers: [targetSrc, drag.src]
        }
      ];

      // reorder top-level servers so the new group sits where target was
      const targetIndex = props.servers.findIndex(s => s.src === targetSrc);
      const reordered = props.servers.filter(
        s => s.src !== targetSrc && s.src !== drag.src
      );
      reordered.splice(targetIndex, 0, serverBySrc(targetSrc));
      props.onReorder(reordered);
    }

    updateGroups(nextGroups);
    setDragSrc(null);
  }

  // Drop server onto a collapsed group toggle -> add into group
  function handleDropOnGroupToggle(groupId) {
    const drag = dragSrc();
    setDragOverGroupId(null);
    if (!drag) return;

    let nextGroups = removeFromAllGroups(drag.src);
    nextGroups = nextGroups.map(g =>
      g.id === groupId
        ? { ...g, servers: [...(g.servers ?? []), drag.src] }
        : g
    );

    updateGroups(nextGroups);
    setDragSrc(null);
  }

  // Drop into the gap (top-level list) -> remove from group if it was in one
  function handleDropInGap(toIndex) {
    const drag = dragSrc();
    if (!drag) return;

    let nextGroups = groups();
    if (drag.fromGroupId) {
      nextGroups = removeFromAllGroups(drag.src);
      updateGroups(nextGroups);
    }

    const withoutDragged = props.servers.filter(s => s.src !== drag.src);
    const draggedServer = serverBySrc(drag.src);
    withoutDragged.splice(toIndex, 0, draggedServer);
    props.onReorder(withoutDragged);

    setDragSrc(null);
  }

  return (
    <>
      <div class="server_bar y">
        <For each={groups()}>
          {(group) => (
            <div
              class={`server_group ${dragOverGroupId() === group.id ? "server_group--drag-over" : ""}`}
              style={{ "--group-color": group.color || "#5865F2" }}
              data-context="server_group"
              data-group-id={group.id}
            >
              <Show
                when={!group.collapsed}
                fallback={
                  <div
                    class="server_single server_group_collapsed"
                    onClick={() => toggleCollapse(group.id)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverGroupId(group.id);
                    }}
                    onDragLeave={() => setDragOverGroupId(null)}
                    onDrop={() => handleDropOnGroupToggle(group.id)}
                    data-context="server_group"
                    data-group-id={group.id}
                  >
                    <div class="server_group_mini_grid">
                      <For each={(group.servers ?? []).slice(0, 4)}>
                        {(src) => (
                          <img
                            src={serverBySrc(src)?.icon ?? fallbackIcon}
                            alt=""
                            class="server_group_mini_icon"
                          />
                        )}
                      </For>
                    </div>
                    <span class="server_tooltip">{group.name}</span>
                  </div>
                }
              >
                <div class="server_group_expanded">
                  <For each={group.servers ?? []}>
                    {(src) => {
                      const server = () => serverBySrc(src);
                      return (
                        <Show when={server()}>
                          <div
                            draggable
                            onClick={() => props.onSelect(server())}
                            data-context="server"
                            data-src={src}
                            onDragStart={() => setDragSrc({ src, fromGroupId: group.id })}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => handleDropOnServer(src, group.id)}
                            onDragEnd={() => setDragSrc(null)}
                            class={`server_single ${props.currentServer?.src === src ? "server_single--active" : ""}`}
                          >
                            <img
                              src={server().icon ?? fallbackIcon}
                              alt={server().name}
                              class="server_icon"
                            />
                            {!(
                              props.unreads.servers?.[src]?.online ||
                              props?.currentServer?.src === src
                            ) && <span class="server_offline_indicator" />}

                            <span class="server_tooltip">{server().name}</span>

                            {props.unreadTotal(src) > 0 && (
                              <span class="unread_badge"></span>
                            )}
                          </div>
                        </Show>
                      );
                    }}
                  </For>

                  <div
                    class="server_group_toggle"
                    onClick={() => toggleCollapse(group.id)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverGroupId(group.id);
                    }}
                    onDragLeave={() => setDragOverGroupId(null)}
                    onDrop={() => handleDropOnGroupToggle(group.id)}
                    data-context="server_group"
                    data-group-id={group.id}
                  >
                    <HiOutlineChevronDown class="server_group_toggle_icon" />
                    <span class="server_tooltip">{group.name}</span>
                  </div>
                </div>
              </Show>
            </div>
          )}
        </For>

        <For each={ungroupedServers()}>
          {(server) => {
            const index = () => props.servers.findIndex(s => s.src === server.src);
            return (
              <div
                draggable
                onClick={() => props.onSelect(server)}
                data-context="server"
                data-src={server.src}
                onDragStart={() => setDragSrc({ src: server.src, fromGroupId: null })}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.stopPropagation();
                  handleDropOnServer(server.src, null);
                }}
                onDragEnd={() => setDragSrc(null)}
                class={`server_single ${props.currentServer?.src === server.src
                  ? "server_single--active"
                  : ""
                  }`}
              >
                <img
                  src={server.icon ?? fallbackIcon}
                  alt={server.name}
                  class="server_icon"
                />
                {!(
                  props.unreads.servers?.[server.src]?.online ||
                  props?.currentServer?.src === server.src
                ) && <span class="server_offline_indicator" />}

                <span class="server_tooltip">{server.name}</span>

                {props.unreadTotal(server.src) > 0 && (
                  <span class="unread_badge"></span>
                )}
              </div>
            );
          }}
        </For>

        {/* gap drop zone to pull servers out of groups / to end of list */}
        <div
          class="server_gap_drop"
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => handleDropInGap(props.servers.length)}
        />

        <div
          class="server_single"
          onClick={() => setDialogOpen(true)}
        >
          <img
            src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' height='24px' viewBox='0 -960 960 960' width='24px' fill='%233DA35D'%3E%3Cpath d='M440-440H240q-17 0-28.5-11.5T200-480q0-17 11.5-28.5T240-520h200v-200q0-17 11.5-28.5T480-760q17 0 28.5 11.5T520-720v200h200q17 0 28.5 11.5T760-480q0 17-11.5 28.5T720-440H520v200q0 17-11.5 28.5T480-200q-17 0-28.5-11.5T440-240v-200Z'/%3E%3C/svg%3E"
            class="server_icon add_server"
          />
        </div>

        <div
          class="server_single"
          onClick={() => setSettingsDialogOpen(true)}
          style={{ "margin-top": "auto" }}
        >
          <HiOutlineAdjustmentsHorizontal class="add_server"/>
        </div>
      </div>

      <Dialog
        open={dialogOpen()}
        onClose={() => setDialogOpen(false)}
      >
        <ServerBrowser
          servers={props.servers}
          onJoin={(server) => {
            props.onSelect(server);
            setDialogOpen(false);
          }}
        />
      </Dialog>
      <Dialog
        open={settingsDialogOpen()}
        onClose={() => setSettingsDialogOpen(false)}
      >
        <Settings
        />
      </Dialog>
    </>
  );
}