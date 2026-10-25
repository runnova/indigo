import { createStore, produce } from "solid-js/store";

/*
  Layout model
  ------------
  node  = group | split
  group = { type: "group", id, tabs: Tab[], active: tabId | null }
  split = { type: "split", id, dir: "row" | "col", children: node[], sizes: number[] }  // sizes sum to 1
  tab   = { id, src, serverName, icon, channel, title, threadId }

  Nodes are kept in a Solid store and mutated in place, so a group/tab keeps its
  object identity when the tree around it changes. The Workspace renders panes
  from a *flat* list keyed by that identity, which means splitting or resizing
  never remounts an existing message list.
*/

export const TAB_MIME = "application/x-indigo-tab";
export const CHAN_MIME = "application/x-indigo-channel";

let seq = 0;
const nid = (p) => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`;

export const tabKey = (t) => `${t.src}|${t.channel}|${t.threadId ?? ""}`;

export function makeTab(d) {
  return {
    id: nid("t"),
    src: d.src,
    serverName: d.serverName ?? d.src,
    icon: d.icon ?? null,
    channel: d.channel,
    title: d.title ?? d.channel,
    threadId: d.threadId ?? null,
  };
}

const newGroup = (tabs = []) => ({
  type: "group",
  id: nid("g"),
  tabs,
  active: tabs[0]?.id ?? null,
});

/* ---------- tree helpers (work on plain objects, store proxies or drafts) ---------- */

export function findNode(node, id) {
  if (node.id === id) return node;
  if (node.type === "split") {
    for (const c of node.children) {
      const f = findNode(c, id);
      if (f) return f;
    }
  }
  return null;
}

function findParent(node, id) {
  if (node.type !== "split") return null;
  for (let i = 0; i < node.children.length; i++) {
    if (node.children[i].id === id) return { parent: node, index: i };
    const f = findParent(node.children[i], id);
    if (f) return f;
  }
  return null;
}

export function listGroups(node, out = []) {
  if (node.type === "group") out.push(node);
  else node.children.forEach((c) => listGroups(c, out));
  return out;
}

/** Drops empty groups, unwraps single-child splits, merges same-direction nested splits. */
function normalize(node) {
  if (node.type === "group") return node;

  const kids = [];
  const sizes = [];
  let emptyFallback = null;

  node.children.forEach((c, i) => {
    const n = normalize(c);

    if (n.type === "group" && !n.tabs.length) {
      emptyFallback ??= n;
      return;
    }

    if (n.type === "split" && n.dir === node.dir) {
      n.children.forEach((cc, j) => {
        kids.push(cc);
        sizes.push(node.sizes[i] * n.sizes[j]);
      });
    } else {
      kids.push(n);
      sizes.push(node.sizes[i]);
    }
  });

  if (!kids.length) return emptyFallback;
  if (kids.length === 1) return kids[0];

  const sum = sizes.reduce((a, b) => a + b, 0) || 1;
  node.children = kids;
  node.sizes = sizes.map((x) => x / sum);
  return node;
}

function finish(s) {
  s.root = normalize(s.root);
  if (!findNode(s.root, s.focusedGroup)) {
    s.focusedGroup = listGroups(s.root)[0].id;
  }
}

/* ---------- store ---------- */

function load() {
  try {
    const s = JSON.parse(localStorage.getItem("workspace") || "null");
    if (s?.root) {
      if (!s.focusedGroup || !findNode(s.root, s.focusedGroup)) {
        s.focusedGroup = listGroups(s.root)[0].id;
      }
      return s;
    }
  } catch {}
  const g = newGroup();
  return { root: g, focusedGroup: g.id };
}

export const [layout, setLayout] = createStore(load());

/* ---------- operations ---------- */

export function focusGroup(id) {
  if (!id || layout.focusedGroup === id) return;
  if (!findNode(layout.root, id)) return;
  setLayout("focusedGroup", id);
}

export function setActive(groupId, tabId) {
  setLayout(
    produce((s) => {
      const g = findNode(s.root, groupId);
      if (!g) return;
      g.active = tabId;
      s.focusedGroup = groupId;
    }),
  );
}

export function openTab(data, { groupId, replaceActive = false } = {}) {
  setLayout(
    produce((s) => {
      const g =
        findNode(s.root, groupId ?? s.focusedGroup) ?? listGroups(s.root)[0];
      s.focusedGroup = g.id;

      const existing = g.tabs.find((t) => tabKey(t) === tabKey(data));
      if (existing) {
        g.active = existing.id;
        return;
      }

      const tab = makeTab(data);
      const ai = g.tabs.findIndex((t) => t.id === g.active);

      if (replaceActive && ai >= 0) g.tabs.splice(ai, 1, tab);
      else g.tabs.splice(ai + 1, 0, tab);

      g.active = tab.id;
    }),
  );
}

export function closeTab(groupId, tabId) {
  setLayout(
    produce((s) => {
      const g = findNode(s.root, groupId);
      if (!g) return;
      const i = g.tabs.findIndex((t) => t.id === tabId);
      if (i < 0) return;

      g.tabs.splice(i, 1);
      if (g.active === tabId) g.active = (g.tabs[i] ?? g.tabs[i - 1])?.id ?? null;
      finish(s);
    }),
  );
}

/**
 * source: { groupId, tabId }  – an existing tab
 *       | { data }            – a channel dragged from the sidebar
 * zone:   "center" | "left" | "right" | "top" | "bottom"
 * index:  insertion index for "center" (tab strip drops)
 */
export function moveTab(source, targetId, zone, index = null) {
  setLayout(
    produce((s) => {
      const tg = findNode(s.root, targetId);
      if (!tg) return;

      let tab;

      if (source.groupId) {
        const sg = findNode(s.root, source.groupId);
        if (!sg) return;
        const i = sg.tabs.findIndex((t) => t.id === source.tabId);
        if (i < 0) return;

        if (sg.id === tg.id && zone === "center") {
          const [t] = sg.tabs.splice(i, 1);
          let at = index ?? sg.tabs.length;
          if (index != null && index > i) at = index - 1;
          sg.tabs.splice(at, 0, t);
          sg.active = t.id;
          s.focusedGroup = sg.id;
          return;
        }

        if (sg.id === tg.id && sg.tabs.length === 1) return;

        [tab] = sg.tabs.splice(i, 1);
        if (sg.active === tab.id) {
          sg.active = (sg.tabs[i] ?? sg.tabs[i - 1])?.id ?? null;
        }
      } else {
        if (zone === "center") {
          const dup = tg.tabs.find((t) => tabKey(t) === tabKey(source.data));
          if (dup) {
            tg.active = dup.id;
            s.focusedGroup = tg.id;
            return;
          }
        }
        tab = makeTab(source.data);
      }

      if (zone === "center") {
        tg.tabs.splice(index ?? tg.tabs.length, 0, tab);
        tg.active = tab.id;
        s.focusedGroup = tg.id;
      } else {
        const ng = newGroup([tab]);
        const dir = zone === "left" || zone === "right" ? "row" : "col";
        const before = zone === "left" || zone === "top";

        const split = {
          type: "split",
          id: nid("s"),
          dir,
          children: before ? [ng, tg] : [tg, ng],
          sizes: [0.5, 0.5],
        };

        const p = findParent(s.root, tg.id);
        if (p) p.parent.children[p.index] = split;
        else s.root = split;

        s.focusedGroup = ng.id;
      }

      finish(s);
    }),
  );
}

/** Moves the divider after child `index`. Returns the delta actually applied. */
export function resizeSplit(splitId, index, delta) {
  let applied = 0;
  setLayout(
    produce((s) => {
      const n = findNode(s.root, splitId);
      if (!n || n.type !== "split") return;
      const a = n.sizes[index];
      const b = n.sizes[index + 1];
      const MIN = 0.08;
      const d = Math.max(MIN - a, Math.min(b - MIN, delta));
      n.sizes[index] = a + d;
      n.sizes[index + 1] = b - d;
      applied = d;
    }),
  );
  return applied;
}

/* ---------- drag source helper for the channel sidebar ---------- */

export function channelDragProps(server, channel, threadId = null) {
  return {
    draggable: true,
    onDragStart: (e) => {
      e.dataTransfer.effectAllowed = "copyMove";
      e.dataTransfer.setData(
        CHAN_MIME,
        JSON.stringify({
          src: server.src,
          serverName: server.name,
          icon: server.icon ?? null,
          channel: channel.name,
          title: channel.display_name || channel.name,
          threadId,
        }),
      );
    },
  };
}
