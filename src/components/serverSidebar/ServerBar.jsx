import { For, createSignal, Show, createMemo } from "solid-js";
import Dialog from "../Dialog.jsx";
import ServerBrowser from "./discovery/ServerBrowser.jsx";
import Settings from "./Settings";
import {
  HiOutlineAdjustmentsHorizontal,
  HiOutlineChatBubbleOvalLeft,
  HiOutlineChevronDown,
  HiOutlineMagnifyingGlass,
} from "solid-icons/hi";

import {
  genId,
  removeFromAllGroups,
  addToGroup,
  createGroupWith,
  toggleGroupCollapse,
  ungroupedServers,
  serverBySrc,
  renderedOrder,
  getColorValue,
} from "./groups.js";
import { showSpotlight } from "../spotlight/Spotlight.jsx";
import { state } from "../../App.jsx";

const FALLBACK_ICON = HiOutlineChatBubbleOvalLeft;
function ServerEntry(local) {
  return (
    <Show when={local.server()}>
      <div
        draggable
        onClick={() => local.onSelect(local.server())}
        data-context="server"
        data-src={local.src}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", local.src);
          local.setDragSrc({ src: local.src, fromGroupId: local.groupId ?? null });
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (local.dragSrc()?.src !== local.src) {
            local.setDragOverServerSrc(local.src);
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = "move";
          if (local.dragSrc()?.src !== local.src) {
            local.setDragOverServerSrc(local.src);
          }
        }}
        onDragLeave={(e) => {
          e.stopPropagation();
          if (!e.currentTarget.contains(e.relatedTarget)) {
            local.setDragOverServerSrc(null);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          local.handleDropOnServer(local.src, local.groupId ?? null);
        }}
        onDragEnd={() => {
          local.setDragSrc(null);
          local.setDragOverServerSrc(null);
        }}
        class={`server_single ${
          local.currentServer?.src === local.src ? "server_single--active" : ""
        } ${
          local.dragOverServerSrc() === local.src ? "server_single--drop-target" : ""
        }`}
        data-tooltip={local.server().name + ": " + local.server().src}
        data-tooltip-position="right"
      >
        <Show
          when={local.server().src !== state.settings.dmsServer}
          fallback={<HiOutlineChatBubbleOvalLeft class="server_icon dms" />}
        >
          <img
            src={local.server().icon ?? FALLBACK_ICON}
            alt={local.server().name}
            class="server_icon"
          />
        </Show>
        {!(
          local.unreads.servers?.[local.src]?.online ||
          local.currentServer?.src === local.src
        ) && <span class="server_offline_indicator" />}
        {local.unreadTotal(local.src) > 0 && (
          <span class="unread_badge"></span>
        )}
      </div>
    </Show>
  );
}

export default function ServerBar(props) {
  const [dialogOpen, setDialogOpen] = createSignal(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = createSignal(false);
  const [dragSrc, setDragSrc] = createSignal(null);
  const [dragOverGroupId, setDragOverGroupId] = createSignal(null);
  const [dragOverGapIndex, setDragOverGapIndex] = createSignal(null);
  const [dragOverServerSrc, setDragOverServerSrc] = createSignal(null);

  const groups = () => props.groups ?? [];

  const order = createMemo(() => renderedOrder(props.servers, groups()));

  const items = createMemo(() => {
    const currentGroups = groups();
    const currentServers = props.servers ?? [];
    const currentOrder = order();

    const result = [];
    const processedGroupIds = new Set();

    for (const src of currentOrder) {
      const group = currentGroups.find((g) => (g.servers ?? []).includes(src));

      if (group) {
        if (!processedGroupIds.has(group.id)) {
          processedGroupIds.add(group.id);

          const members = group.servers ?? [];
          let maxIdx = -1;
          for (const mSrc of members) {
            const idx = currentOrder.indexOf(mSrc);
            if (idx > maxIdx) maxIdx = idx;
          }
          const gapIndexAfter =
            maxIdx === -1 ? currentOrder.length : maxIdx + 1;

          result.push({
            type: "group",
            group,
            gapIndexAfter,
          });
        }
      } else {
        const server = serverBySrc(currentServers, src);
        if (server) {
          const serverIdx = currentOrder.indexOf(src);
          result.push({
            type: "server",
            server,
            gapIndexAfter: serverIdx + 1,
          });
        }
      }
    }

    for (const group of currentGroups) {
      if (!processedGroupIds.has(group.id)) {
        processedGroupIds.add(group.id);
        result.push({
          type: "group",
          group,
          gapIndexAfter: currentOrder.length,
        });
      }
    }

    return result;
  });

  function updateGroups(next) {
    props.onGroupsChange(next);
  }

  function toggleCollapse(groupId) {
    updateGroups(toggleGroupCollapse(groups(), groupId));
  }

  function handleRealtimeGapOver(index) {
    const drag = dragSrc();
    if (!drag) return;

    const currentOrder = order();
    const currentGroups = groups();
    const inGroup = currentGroups.find((g) =>
      (g.servers ?? []).includes(drag.src),
    );

    const draggedOriginalIndex = currentOrder.findIndex((s) => s === drag.src);
    const filteredOrder = currentOrder.filter((s) => s !== drag.src);

    let adjustedIndex = index;
    if (draggedOriginalIndex !== -1 && draggedOriginalIndex < index) {
      adjustedIndex -= 1;
    }
    adjustedIndex = Math.max(0, Math.min(adjustedIndex, filteredOrder.length));

    if (!inGroup && draggedOriginalIndex === adjustedIndex) {
      return;
    }

    if (inGroup) {
      const nextGroups = removeFromAllGroups(currentGroups, drag.src);
      updateGroups(nextGroups);
      setDragSrc({ src: drag.src, fromGroupId: null });
    }

    const nextOrder = [...filteredOrder];
    nextOrder.splice(adjustedIndex, 0, drag.src);

    const reorderedServers = nextOrder
      .map((src) => serverBySrc(props.servers, src))
      .filter(Boolean);

    props.onReorder(reorderedServers);
  }

  function handleDropOnServer(targetSrc, targetGroupId) {
    const drag = dragSrc();

    if (!drag || drag.src === targetSrc) {
      return;
    }

    let nextGroups = removeFromAllGroups(groups(), drag.src);

    if (targetGroupId) {
      nextGroups = addToGroup(nextGroups, targetGroupId, drag.src);
    } else {
      nextGroups = [...nextGroups, createGroupWith([targetSrc, drag.src])];
    }

    updateGroups(nextGroups);
    setDragOverGroupId(null);
    setDragOverServerSrc(null);
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

    handleRealtimeGapOver(toIndex);
    setDragSrc(null);
  }

  // Shared by both the collapsed and expanded group-toggle elements: dropping
  // a server on either one adds it to that group.
  function groupToggleHandlers(groupId) {
    return {
      onDragEnter: (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOverGroupId(groupId);
      },
      onDragOver: (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOverGroupId(groupId);
      },
      onDragLeave: (e) => {
        e.stopPropagation();
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setDragOverGroupId(null);
        }
      },
      onDrop: (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleDropOnGroupToggle(groupId);
      },
    };
  }

  function GapDrop(index) {
    return (
      <div
        class={`server_gap_drop ${dragOverGapIndex() === index ? "server_gap_drop--active" : ""}`}
        style={{ "pointer-events": "auto" }}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOverGapIndex(index);
          handleRealtimeGapOver(index);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (dragOverGapIndex() !== index) setDragOverGapIndex(index);
          handleRealtimeGapOver(index);
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
        <For each={items()}>
          {(item) => (
            <Show
              when={item.type === "group"}
              fallback={
                <>
                  <ServerEntry
                    src={item.server.src}
                    server={() => item.server}
                    groupId={null}
                    currentServer={props.currentServer}
                    unreads={props.unreads}
                    unreadTotal={props.unreadTotal}
                    onSelect={props.onSelect}
                    dragSrc={dragSrc}
                    setDragSrc={setDragSrc}
                    dragOverServerSrc={dragOverServerSrc}
                    setDragOverServerSrc={setDragOverServerSrc}
                    handleDropOnServer={handleDropOnServer}
                  />
                  {GapDrop(item.gapIndexAfter)}
                </>
              }
            >
              <div
                class={`server_group ${
                  dragOverGroupId() === item.group.id
                    ? "server_group--drag-over"
                    : ""
                }`}
                style={{ "--group-color": getColorValue(item.group.color) }}
                data-context="server_group"
                data-group-id={item.group.id}
              >
                <Show
                  when={!item.group.collapsed}
                  fallback={
                    <div
                      class="server_single server_group_collapsed"
                      onClick={() => toggleCollapse(item.group.id)}
                      {...groupToggleHandlers(item.group.id)}
                      data-context="server_group"
                      data-group-id={item.group.id}
                      data-tooltip={item.group.name + ": Server Group"}
                      data-tooltip-position="right"
                    >
                      <div class="server_group_mini_grid">
                        <For each={(item.group.servers ?? []).slice(0, 4)}>
                          {(src) => (
                            <img
                              src={
                                serverBySrc(props.servers, src)?.icon ??
                                FALLBACK_ICON
                              }
                              alt=""
                              class="server_group_mini_icon"
                            />
                          )}
                        </For>
                      </div>
                    </div>
                  }
                >
                  <div class="server_group_expanded">
                    <div
                      class="server_group_toggle"
                      onClick={() => toggleCollapse(item.group.id)}
                      {...groupToggleHandlers(item.group.id)}
                      data-group-id={item.group.id}
                      data-tooltip={item.group.name + ": Server Group"}
                      data-tooltip-position="right"
                    >
                      <HiOutlineChevronDown class="server_group_toggle_icon" />
                    </div>

                    <For each={item.group.servers ?? []}>
                      {(src) => (
                        <ServerEntry
                          src={src}
                          server={() => serverBySrc(props.servers, src)}
                          groupId={item.group.id}
                          currentServer={props.currentServer}
                          unreads={props.unreads}
                          unreadTotal={props.unreadTotal}
                          onSelect={props.onSelect}
                          dragSrc={dragSrc}
                          setDragSrc={setDragSrc}
                          dragOverServerSrc={dragOverServerSrc}
                          setDragOverServerSrc={setDragOverServerSrc}
                          handleDropOnServer={handleDropOnServer}
                        />
                      )}
                    </For>
                  </div>
                </Show>
              </div>
              {GapDrop(item.gapIndexAfter)}
            </Show>
          )}
        </For>
        <div
          class="server_single"
          onClick={() => setDialogOpen(true)}
          data-tooltip="Add Server"
          data-tooltip-position="right"
        >
          <img
            src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' height='24px' viewBox='0 -960 960 960' width='24px' fill='%233DA35D'%3E%3Cpath d='M440-440H240q-17 0-28.5-11.5T200-480q0-17 11.5-28.5T240-520h200v-200q0-17 11.5-28.5T480-760q17 0 28.5 11.5T520-720v200h200q17 0 28.5 11.5T760-480q0 17-11.5 28.5T720-440H520v200q0 17-11.5 28.5T480-200q-17 0-28.5-11.5T440-240v-200Z'/%3E%3C/svg%3E"
            class="server_icon add_server legit_add_server"
          />
        </div>
        <div
          class="server_single"
          onClick={() => showSpotlight(true)}
          style={{ "margin-top": "auto" }}
          data-tooltip={"Spotlight: CTRL + /"}
          data-tooltip-position="right"
        >
          <HiOutlineMagnifyingGlass class="add_server" />
        </div>
        <div
          class="server_single"
          data-tooltip={"Settings"}
          data-tooltip-position="right"
          onClick={() => setSettingsDialogOpen(true)}
        >
          <HiOutlineAdjustmentsHorizontal class="add_server" />
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
