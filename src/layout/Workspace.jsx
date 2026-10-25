import {
  ErrorBoundary,
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  on,
  onCleanup,
  onMount,
  untrack,
} from "solid-js";
import { HiOutlinePlus, HiOutlineViewColumns, HiOutlineXMark } from "solid-icons/hi";

import {
  state,
  setState,
  tempState,
  switchToChannel,
  conn as activeConn,
} from "../state.js";
import { reconnectServer, pinServer } from "../core/server_connection.jsx";
import { showSpotlight } from "../components/spotlight/Spotlight.jsx";
import { VirtualMessageList } from "../scrolling";
import { ForumView } from "../components/forumView/ForumView";
import { VoiceChannelView } from "../components/voiceChannel/VoiceChannelView.jsx";
import MessageComposer from "../components/compose/MessageComposer.jsx";

import { getPaneConn } from "./paneConn.js";
import {
  layout,
  listGroups,
  findNode,
  focusGroup,
  setActive,
  openTab,
  closeTab,
  moveTab,
  resizeSplit,
  tabKey,
  TAB_MIME,
  CHAN_MIME,
} from "./layoutStore.js";
import "./workspace.css";

const TABBAR_H = 35;
const EDGE = 0.25;

const [showTabBar, setShowTabBar] = createSignal({});

export function TabBarToggle() {
  const group = createMemo(() => findNode(layout.root, layout.focusedGroup));
  const gid = () => group()?.id;

  return (
    <Show when={group()?.tabs.length === 1}>
      <button
        class="ws-tabbar-toggle"
        classList={{ active: !!showTabBar()[gid()] }}
        title="Toggle tab bar"
        aria-label="Toggle tab bar"
        onClick={() => setShowTabBar((m) => ({ ...m, [gid()]: !m[gid()] }))}
      >
        <HiOutlineViewColumns />
      </button>
    </Show>
  );
}

function computeLayout(root) {
  const groups = {};
  const splitters = [];

  const walk = (node, r) => {
    if (node.type === "group") {
      groups[node.id] = r;
      return;
    }
    const row = node.dir === "row";
    let off = 0;
    node.children.forEach((c, i) => {
      const s = node.sizes[i];
      walk(
        c,
        row
          ? { x: r.x + off * r.w, y: r.y, w: r.w * s, h: r.h }
          : { x: r.x, y: r.y + off * r.h, w: r.w, h: r.h * s },
      );
      off += s;
      if (i < node.children.length - 1) {
        splitters.push({
          id: `${node.id}:${i}`,
          split: node.id,
          index: i,
          dir: node.dir,
          r,
          pos: row ? r.x + off * r.w : r.y + off * r.h,
        });
      }
    });
  };

  walk(root, { x: 0, y: 0, w: 100, h: 100 });
  return { groups, splitters };
}

function PaneContent(props) {
  const pconn = getPaneConn(props.tab.src);
  onMount(() => pinServer(props.tab.src));

  const info = () => pconn.channels().find((c) => c.name === props.tab.channel);
  const thread = () =>
    info()?.threads?.find((t) => t.id === props.tab.threadId) ?? null;
  const ready = () => pconn.status() === "ready";

  const serverObj = () =>
    state.servers.find((s) => s.src === props.tab.src) ?? {
      src: props.tab.src,
    };

  return (
    <div
      class="interactive_section y fill ws-pane-inner"
      classList={{ "ws-active": props.active() }}
    >
      <Show
        when={ready() && info()}
        fallback={
          <div class="empty_state fill y">
            <p>
              {!ready()
                ? pconn.status()
                : pconn.channels().length
                  ? "This channel no longer exists."
                  : "Loading channels…"}{" "}
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  reconnectServer(props.tab.src);
                }}
              >
                Reconnect
              </a>
            </p>
          </div>
        }
      >
        {info()?.type === "voice" ? (
          <VoiceChannelView
            channel={props.tab.channel}
            server={serverObj()}
            conn={state.current.server?.src === props.tab.src ? activeConn : pconn}
          />
        ) : info()?.type === "forum" ? (
          <ForumView
            channel={props.tab.channel}
            sendRequest={pconn.send}
            wsMessages={pconn.lastEvent}
            onReady={(api) => props.registerApi(props.tab.id, api)}
          />
        ) : (
          <>
            <VirtualMessageList
              channel={props.tab.channel}
              threadId={props.tab.threadId}
              serverSrc={props.tab.src}
              conn={pconn}
              active={props.active}
              sendRequest={pconn.send}
              wsMessages={pconn.lastEvent}
              onReady={(api) => props.registerApi(props.tab.id, api)}
            />
            <MessageComposer channel={props.tab.channel} thread={thread()} />
          </>
        )}
      </Show>
    </div>
  );
}

export function Workspace() {
  let rootEl;

  const groups = createMemo(() => listGroups(layout.root));
  const geo = createMemo(() => computeLayout(layout.root));

  const groupById = createMemo(() => {
    const m = {};
    for (const g of groups()) m[g.id] = g;
    return m;
  });

  const activeTabs = createMemo(() =>
    groups()
      .map((g) => g.tabs.find((t) => t.id === g.active))
      .filter(Boolean),
  );

  const barVisible = (gid) => {
    const g = groupById()[gid];
    return !!g && (g.tabs.length > 1 || !!showTabBar()[gid]);
  };
  const barH = (gid) => (barVisible(gid) ? TABBAR_H : 0);

  const tabGroup = createMemo(() => {
    const m = {};
    for (const g of groups()) for (const t of g.tabs) m[t.id] = g.id;
    return m;
  });

  const focusedTab = createMemo(() => {
    const g = findNode(layout.root, layout.focusedGroup);
    return g?.tabs.find((t) => t.id === g.active);
  });

  const frame = (gid) => {
    const r = geo().groups[gid];
    return r
      ? {
          left: `${r.x}%`,
          top: `${r.y}%`,
          width: `${r.w}%`,
          height: `${r.h}%`,
        }
      : { display: "none" };
  };

  const body = (gid) => {
    const r = geo().groups[gid];
    const bh = barH(gid);
    return r
      ? {
          left: `${r.x}%`,
          top: `calc(${r.y}% + ${bh}px)`,
          width: `${r.w}%`,
          height: `calc(${r.h}% - ${bh}px)`,
        }
      : { display: "none" };
  };

  const splitterStyle = (sp) =>
    sp.dir === "row"
      ? {
          left: `calc(${sp.pos}% - 3px)`,
          top: `${sp.r.y}%`,
          width: "6px",
          height: `${sp.r.h}%`,
        }
      : {
          top: `calc(${sp.pos}% - 3px)`,
          left: `${sp.r.x}%`,
          height: "6px",
          width: `${sp.r.w}%`,
        };

  const apiMap = new Map();
  const [apiVer, setApiVer] = createSignal(0);

  function registerApi(tabId, api) {
    apiMap.set(tabId, api);
    setApiVer((v) => v + 1);
    onCleanup(() => {
      if (apiMap.get(tabId) === api) apiMap.delete(tabId);
      setApiVer((v) => v + 1);
    });
  }

  createEffect(() => {
    apiVer();
    const t = focusedTab();
    tempState.virtMsgList = t ? apiMap.get(t.id) : undefined;
  });

  const currentKey = () =>
    `${state.current.server?.src}|${state.current.channel}|${
      state.current.thread?.id ?? ""
    }`;

  let syncing = false;

  createEffect(
    on(
      focusedTab,
      async (tab) => {
        if (!tab || tabKey(tab) === untrack(currentKey)) return;
        syncing = true;
        try {
          await switchToChannel(tab.src, tab.channel, tab.threadId || undefined);
          setState("current", "channel_type", "");
        } finally {
          syncing = false;
        }
      },
      { defer: true },
    ),
  );

  createEffect(() => {
    const src = state.current.server?.src;
    const channel = state.current.channel;
    const threadId = state.current.thread?.id ?? null;
    if (syncing || !src || !channel) return;

    const ft = untrack(focusedTab);
    if (ft && tabKey(ft) === `${src}|${channel}|${threadId ?? ""}`) return;

    const info = untrack(() =>
      getPaneConn(src)
        .channels()
        .find((c) => c.name === channel),
    );

    openTab(
      {
        src,
        serverName: state.current.server?.name ?? src,
        icon: state.current.server?.icon ?? null,
        channel,
        title: info?.display_name || channel,
        threadId,
      },
      { replaceActive: true },
    );
  });

  createEffect(() => {
    try {
      localStorage.setItem("workspace", JSON.stringify(layout));
    } catch {}
  });

  function startResize(e, sp) {
    e.preventDefault();
    const rect = rootEl.getBoundingClientRect();
    const row = sp.dir === "row";
    const total = ((row ? rect.width * sp.r.w : rect.height * sp.r.h) || 1) / 100;
    let last = row ? e.clientX : e.clientY;

    document.body.classList.add("ws-resizing");

    const move = (ev) => {
      const cur = row ? ev.clientX : ev.clientY;
      const applied = resizeSplit(sp.split, sp.index, (cur - last) / total);
      last += applied * total;
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.classList.remove("ws-resizing");
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const [dragging, setDragging] = createSignal(false);
  const [hover, setHover] = createSignal(null);

  let lastOver = 0;
  const cancelStale = () => {
    lastOver = Date.now();
  };
  createEffect(() => {
    if (!dragging()) return;
    const id = setInterval(() => {
      if (Date.now() - lastOver > 400) {
        setDragging(false);
        setHover(null);
      }
    }, 400);
    onCleanup(() => clearInterval(id));
  });

  onMount(() => {
    const isOurs = (e) => {
      const t = Array.from(e.dataTransfer?.types ?? []);
      return t.includes(TAB_MIME) || t.includes(CHAN_MIME);
    };
    const start = (e) => {
      if (isOurs(e)) setTimeout(() => setDragging(true), 0);
    };
    const end = () => {
      setDragging(false);
      setHover(null);
    };

    window.addEventListener("dragstart", start);
    window.addEventListener("dragend", end);
    window.addEventListener("drop", end);
    window.addEventListener("dragover", cancelStale);
    onCleanup(() => {
      window.removeEventListener("dragstart", start);
      window.removeEventListener("dragend", end);
      window.removeEventListener("drop", end);
      window.removeEventListener("dragover", cancelStale);
    });
  });

  function computeDrop(e, gid) {
    const r = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - r.top;
    const bh = barH(gid);

    if (bh && y < bh) {
      const tabs = Array.from(
        rootEl.querySelectorAll(`.ws-group[data-group="${gid}"] .ws-tab`),
      );
      let index = tabs.length;
      for (let i = 0; i < tabs.length; i++) {
        const b = tabs[i].getBoundingClientRect();
        if (e.clientX < b.left + b.width / 2) {
          index = i;
          break;
        }
      }
      return { groupId: gid, zone: "center", index };
    }

    const fx = (e.clientX - r.left) / r.width;
    const fy = (y - bh) / Math.max(1, r.height - bh);
    const [zone, val] = Object.entries({
      left: fx,
      right: 1 - fx,
      top: fy,
      bottom: 1 - fy,
    }).sort((a, b) => a[1] - b[1])[0];

    return { groupId: gid, zone: val < EDGE ? zone : "center", index: null };
  }

  function previewStyle(h) {
    const bh = barH(h.groupId);
    const top = `${bh}px`;
    switch (h.zone) {
      case "left":
        return { top, left: 0, bottom: 0, width: "50%" };
      case "right":
        return { top, right: 0, bottom: 0, width: "50%" };
      case "top":
        return { top, left: 0, right: 0, height: `calc(50% - ${bh / 2}px)` };
      case "bottom":
        return { bottom: 0, left: 0, right: 0, height: `calc(50% - ${bh / 2}px)` };
      default:
        return { top: h.index != null ? 0 : top, left: 0, right: 0, bottom: 0 };
    }
  }

  function onDrop(e, gid) {
    e.preventDefault();
    const h = hover()?.groupId === gid ? hover() : computeDrop(e, gid);

    const tabRaw = e.dataTransfer.getData(TAB_MIME);
    const chanRaw = e.dataTransfer.getData(CHAN_MIME);

    try {
      if (tabRaw) moveTab(JSON.parse(tabRaw), gid, h.zone, h.index);
      else if (chanRaw) moveTab({ data: JSON.parse(chanRaw) }, gid, h.zone, h.index);
    } finally {
      setDragging(false);
      setHover(null);
    }
  }

  function addTabViaSpotlight(gid) {
    focusGroup(gid);
    showSpotlight({
      onSelect: (result) => {
        if (!result) return;

        let src, serverName, icon, ch;
        if (result.kind === "channel") {
          src = result.server.src;
          serverName = result.server.name || src;
          icon = result.server.icon || null;
          ch = result.channel;
        } else {
          src = result.server.src;
          serverName = result.server.name || src;
          icon = result.server.icon || null;
          ch = getPaneConn(src)
            .channels()
            .find((c) => c.type !== "separator" && c.type !== "link");
        }
        if (!ch) return;

        openTab(
          {
            src,
            serverName,
            icon,
            channel: ch.name,
            title: ch.display_name || ch.name,
          },
          { groupId: gid },
        );
      },
    });
  }

  function TabBar(props) {
    const g = () => props.group;
    return (
      <div class="ws-tabbar">
        <For each={g().tabs}>
          {(tab) => (
            <div
              class="ws-tab"
              classList={{ active: g().active === tab.id }}
              draggable={true}
              title={`${tab.serverName} · #${tab.title}`}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData(
                  TAB_MIME,
                  JSON.stringify({ groupId: g().id, tabId: tab.id }),
                );
              }}
              onClick={() => setActive(g().id, tab.id)}
              onAuxClick={(e) => {
                if (e.button === 1) closeTab(g().id, tab.id);
              }}
            >
              <Show when={tab.icon}>
                <img class="ws-tab-icon" src={tab.icon} alt="" />
              </Show>
              <span class="ws-tab-title">{tab.title}</span>
              <button
                class="ws-tab-close"
                aria-label="Close tab"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(g().id, tab.id);
                }}
              >
                <HiOutlineXMark></HiOutlineXMark>
              </button>
            </div>
          )}
        </For>
        <button
          class="ws-tab-add"
          aria-label="New tab"
          title="New tab"
          onClick={(e) => {
            e.stopPropagation();
            addTabViaSpotlight(g().id);
          }}
        >
          <HiOutlinePlus size={16} />
        </button>
      </div>
    );
  }

  return (
    <div class="ws-root" ref={rootEl}>
      <For each={groups()}>
        {(g) => (
          <div
            class="ws-group"
            data-group={g.id}
            classList={{ focused: layout.focusedGroup === g.id }}
            style={frame(g.id)}
            onPointerDown={() => focusGroup(g.id)}
          >
            <Show when={barVisible(g.id)}>
              <TabBar group={g} />
            </Show>

            <Show when={!g.tabs.length}>
              <div class="ws-empty">
                Drag a channel here, or pick one from the sidebar.
              </div>
            </Show>
          </div>
        )}
      </For>

      <For each={activeTabs()}>
        {(tab) => {
          const gid = () => tabGroup()[tab.id];
          return (
            <div
              class="ws-content"
              data-tab={tab.id}
              style={body(gid())}
              onPointerDown={() => focusGroup(gid())}
              onFocusIn={() => focusGroup(gid())}
            >
              <ErrorBoundary
                fallback={(err, reset) => {
                  console.error("[workspace] pane crashed", tab.src, tab.channel, err);
                  return (
                    <div class="empty_state fill y">
                      <p>
                        This pane crashed: {String(err?.message ?? err)}{" "}
                        <a
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            reset();
                          }}
                        >
                          Retry
                        </a>
                      </p>
                    </div>
                  );
                }}
              >
                <PaneContent
                  tab={tab}
                  active={() => layout.focusedGroup === gid()}
                  registerApi={registerApi}
                />
              </ErrorBoundary>
            </div>
          );
        }}
      </For>

      <For each={geo().splitters}>
        {(sp) => (
          <div
            class={`ws-splitter ${sp.dir}`}
            style={splitterStyle(sp)}
            onPointerDown={(e) => startResize(e, sp)}
          />
        )}
      </For>

      <Show when={dragging()}>
        <For each={groups()}>
          {(g) => (
            <div
              class="ws-drop"
              style={frame(g.id)}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setHover(computeDrop(e, g.id));
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) setHover(null);
              }}
              onDrop={(e) => onDrop(e, g.id)}
            >
              <Show when={hover()?.groupId === g.id}>
                <div class="ws-drop-preview" style={previewStyle(hover())} />
              </Show>
            </div>
          )}
        </For>
      </Show>
    </div>
  );
}

export default Workspace;
