import { For, createSignal, Show, createMemo } from "solid-js";
import Dialog from "../Dialog.jsx";
import ServerBrowser from "./discovery/ServerBrowser.jsx";
import Settings from "./Settings";
import { HiOutlineAdjustmentsHorizontal, HiOutlineChevronDown, HiOutlineMagnifyingGlass } from "solid-icons/hi";
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

export default function ServerBar(props) {
  const [dialogOpen, setDialogOpen] = createSignal(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = createSignal(false);
  const [dragSrc, setDragSrc] = createSignal(null);
  const [dragOverGroupId, setDragOverGroupId] = createSignal(null);
  const [dragOverGapIndex, setDragOverGapIndex] = createSignal(null);
  const [dragOverServerSrc, setDragOverServerSrc] = createSignal(null);

  const fallbackIcon = `https://icons.veryicon.com/png/o/commerce-shopping/soft-designer-online-tools-icon/group-38.png`;
  const groups = () => props.groups ?? [];

  const order = createMemo(() =>
    renderedOrder(props.servers, groups())
  );

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
          const gapIndexAfter = maxIdx === -1 ? currentOrder.length : maxIdx + 1;

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
    const inGroup = currentGroups.find((g) => (g.servers ?? []).includes(drag.src));

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

    handleRealtimeGapOver(toIndex);
    setDragSrc(null);
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
                  <div
                    draggable
                    onClick={() => props.onSelect(item.server)}
                    data-context="server"
                    data-src={item.server.src}
                    onDragStart={() =>
                      setDragSrc({ src: item.server.src, fromGroupId: null })
                    }
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverServerSrc(item.server.src);
                    }}
                    onDragLeave={() => setDragOverServerSrc(null)}
                    onDrop={(e) => {
                      e.stopPropagation();
                      handleDropOnServer(item.server.src, null);
                    }}
                    onDragEnd={() => {
                      setDragSrc(null);
                      setDragOverServerSrc(null);
                    }}
                    class={`server_single ${
                      props.currentServer?.src === item.server.src
                        ? "server_single--active"
                        : ""
                    } ${
                      dragOverServerSrc() === item.server.src
                        ? "server_single--drop-target"
                        : ""
                    }`}
                  >
                    <img
                      src={item.server.icon ?? fallbackIcon}
                      alt={item.server.name}
                      class="server_icon"
                    />
                    {!(
                      props.unreads.servers?.[item.server.src]?.online ||
                      props?.currentServer?.src === item.server.src
                    ) && <span class="server_offline_indicator" />}
                    <span class="server_tooltip">{item.server.name}</span>
                    {props.unreadTotal(item.server.src) > 0 && (
                      <span class="unread_badge"></span>
                    )}
                  </div>
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
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOverGroupId(item.group.id);
                      }}
                      onDragLeave={() => setDragOverGroupId(null)}
                      onDrop={() => handleDropOnGroupToggle(item.group.id)}
                      data-context="server_group"
                      data-group-id={item.group.id}
                    >
                      <div class="server_group_mini_grid">
                        <For each={(item.group.servers ?? []).slice(0, 4)}>
                          {(src) => (
                            <img
                              src={
                                serverBySrc(props.servers, src)?.icon ??
                                fallbackIcon
                              }
                              alt=""
                              class="server_group_mini_icon"
                            />
                          )}
                        </For>
                      </div>
                      <span class="server_tooltip">{item.group.name}</span>
                    </div>
                  }
                >
                  <div class="server_group_expanded">
                    <div
                      class="server_group_toggle"
                      onClick={() => toggleCollapse(item.group.id)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOverGroupId(item.group.id);
                      }}
                      onDragLeave={() => setDragOverGroupId(null)}
                      onDrop={() => handleDropOnGroupToggle(item.group.id)}
                      data-context="server_group"
                      data-group-id={item.group.id}
                    >
                      <HiOutlineChevronDown class="server_group_toggle_icon" />
                      <span class="server_tooltip">{item.group.name}</span>
                    </div>
                    <For each={item.group.servers ?? []}>
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
                                setDragSrc({ src, fromGroupId: item.group.id })
                              }
                              onDragOver={(e) => {
                                e.preventDefault();
                                setDragOverServerSrc(src);
                              }}
                              onDragLeave={() => setDragOverServerSrc(null)}
                              onDrop={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleDropOnServer(src, item.group.id);
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
              {GapDrop(item.gapIndexAfter)}
            </Show>
          )}
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
          onClick={() => showSpotlight(true)}
          style={{ "margin-top": "auto" }}
        >
          <HiOutlineMagnifyingGlass class="add_server"/>
          <span class="server_tooltip">Spotlight <kbd style={{"font-size": "small"}}>CTRL + /</kbd></span>
        </div>
        <div
          class="server_single"
          onClick={() => setSettingsDialogOpen(true)}
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
