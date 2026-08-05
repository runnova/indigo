import { For, createSignal, Show, createMemo } from "solid-js";
import Dialog from "../Dialog.jsx";
import ServerBrowser from "./discovery/ServerBrowser.jsx";
import Settings from "./Settings";
import { HiOutlineAdjustmentsHorizontal, HiOutlineChevronDown } from "solid-icons/hi";
import {
  genId,
  removeFromAllGroups,
  addToGroup,
  createGroupWith,
  toggleGroupCollapse,
  ungroupedServers,
  serverBySrc,
  renderedOrder,
} from "./groups.js";

export default function ServerBar(props) {
  const [dialogOpen, setDialogOpen] = createSignal(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = createSignal(false);
  const [dragSrc, setDragSrc] = createSignal(null);
  const [dragOverGroupId, setDragOverGroupId] = createSignal(null);
  const [dragOverGapIndex, setDragOverGapIndex] = createSignal(null);
  const [dragOverServerSrc, setDragOverServerSrc] = createSignal(null);

  const fallbackIcon = `https://icons.veryicon.com/png/o/commerce-shopping/soft-designer-online-tools-icon/group-38.png`;
  const groups = () => props.groups ?? [];

  const ungrouped = createMemo(() =>
    ungroupedServers(props.servers, groups())
  );

  const order = createMemo(() =>
    renderedOrder(props.servers, groups())
  );

  function updateGroups(next) {
    props.onGroupsChange(next);
  }

  function toggleCollapse(groupId) {
    updateGroups(toggleGroupCollapse(groups(), groupId));
  }

  function handleDropOnServer(targetSrc, targetGroupId) {
    const drag = dragSrc();
    setDragOverGroupId(null);
    setDragOverServerSrc(null);
    if (!drag || drag.src === targetSrc) return;

    let nextGroups = removeFromAllGroups(groups(), drag.src);

    if (targetGroupId) {
      nextGroups = addToGroup(nextGroups, targetGroupId, drag.src);
    } else {
      nextGroups = [
        ...nextGroups,
        createGroupWith([targetSrc, drag.src]),
      ];
    }

    updateGroups(nextGroups);
    setDragSrc(null);
  }

  function handleDropOnGroupToggle(groupId) {
    const drag = dragSrc();
    setDragOverGroupId(null);
    if (!drag) return;

    let nextGroups = removeFromAllGroups(groups(), drag.src);
    nextGroups = addToGroup(nextGroups, groupId, drag.src);
    updateGroups(nextGroups);
    setDragSrc(null);
  }

  function handleDropInGap(toIndex) {
    const drag = dragSrc();
    setDragOverGapIndex(null);
    if (!drag) return;

    if (drag.fromGroupId) {
      updateGroups(removeFromAllGroups(groups(), drag.src));
    }

    const currentOrder = order().filter((src) => src !== drag.src);
    let adjustedIndex = toIndex;
    const draggedOriginalIndex = order().findIndex((s) => s === drag.src);
    if (draggedOriginalIndex !== -1 && draggedOriginalIndex < toIndex) {
      adjustedIndex -= 1;
    }
    currentOrder.splice(adjustedIndex, 0, drag.src);

    const reorderedServers = currentOrder
      .map((src) => serverBySrc(props.servers, src))
      .filter(Boolean);
    props.onReorder(reorderedServers);
    setDragSrc(null);
  }

  function GapDrop(index) {
    return (
      <div
        class={`server_gap_drop ${dragOverGapIndex() === index ? "server_gap_drop--active" : ""}`}
        style={{ "min-height": "8px", "pointer-events": "auto" }}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOverGapIndex(index);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (dragOverGapIndex() !== index) setDragOverGapIndex(index);
        }}
        onDragLeave={(e) => {
          e.stopPropagation();
          if (dragOverGapIndex() === index) setDragOverGapIndex(null);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleDropInGap(index);
        }}
      />
    );
  }

  return (
    <>
      <div class="server_bar y">
        {GapDrop(0)}
        <For each={groups()}>
          {(group) => {
            const groupTopIndex = () => {
              const members = group.servers ?? [];
              let lastIdx = -1;
              for (const src of members) {
                const idx = order().indexOf(src);
                if (idx !== -1) lastIdx = Math.max(lastIdx, idx);
              }
              return lastIdx === -1 ? order().length : lastIdx + 1;
            };

            return (
              <>
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
                                src={serverBySrc(props.servers, src)?.icon ?? fallbackIcon}
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
                      <For each={group.servers ?? []}>
                        {(src) => {
                          const server = () => serverBySrc(props.servers, src);
                          return (
                            <Show when={server()}>
                              <div
                                draggable
                                onClick={() => props.onSelect(server())}
                                data-context="server"
                                data-src={src}
                                onDragStart={() =>
                                  setDragSrc({ src, fromGroupId: group.id })
                                }
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  setDragOverServerSrc(src);
                                }}
                                onDragLeave={() => setDragOverServerSrc(null)}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleDropOnServer(src, group.id);
                                }}
                                onDragEnd={() => {
                                  setDragSrc(null);
                                  setDragOverServerSrc(null);
                                }}
                                class={`server_single ${
                                  props.currentServer?.src === src
                                    ? "server_single--active"
                                    : ""
                                } ${
                                  dragOverServerSrc() === src
                                    ? "server_single--drop-target"
                                    : ""
                                }`}
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
                    </div>
                  </Show>
                </div>
                {GapDrop(groupTopIndex())}
              </>
            );
          }}
        </For>
        <For each={ungrouped()}>
          {(server) => {
            const index = () => order().indexOf(server.src);
            return (
              <>
                <div
                  draggable
                  onClick={() => props.onSelect(server)}
                  data-context="server"
                  data-src={server.src}
                  onDragStart={() =>
                    setDragSrc({ src: server.src, fromGroupId: null })
                  }
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverServerSrc(server.src);
                  }}
                  onDragLeave={() => setDragOverServerSrc(null)}
                  onDrop={(e) => {
                    e.stopPropagation();
                    handleDropOnServer(server.src, null);
                  }}
                  onDragEnd={() => {
                    setDragSrc(null);
                    setDragOverServerSrc(null);
                  }}
                  class={`server_single ${
                    props.currentServer?.src === server.src
                      ? "server_single--active"
                      : ""
                  } ${
                    dragOverServerSrc() === server.src
                      ? "server_single--drop-target"
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
                {GapDrop(index() + 1)}
              </>
            );
          }}
        </For>
        <div class="server_single" onClick={() => setDialogOpen(true)}>
          <img
            src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' height='24px' viewBox='0 -960 960 960' width='24px' fill='%233DA35D'%3E%3Cpath d='M440-440H240q-17 0-28.5-11.5T200-480q0-17 11.5-28.5T240-520h200v-200q0-17 11.5-28.5T480-760q17 0 28.5 11.5T520-720v200h200q17 0 28.5 11.5T760-480q0 17-11.5 28.5T720-440H520v200q0 17-11.5 28.5T480-200q-17 0-28.5-11.5T440-240v-200Z'/%3E%3C/svg%3E"
            class="server_icon add_server"
          />
          <span class="server_tooltip">Add Server</span>
        </div>
        <div
          class="server_single"
          onClick={() => setSettingsDialogOpen(true)}
          style={{ "margin-top": "auto" }}
        >
          <HiOutlineAdjustmentsHorizontal class="add_server" />
          <span class="server_tooltip">Settings</span>
        </div>
      </div>
      <Dialog open={dialogOpen()} onClose={() => setDialogOpen(false)}>
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
        <Settings />
      </Dialog>
    </>
  );
}
