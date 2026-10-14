export function genId() {
  return `grp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function ensureGroups(groups) {
  return Array.isArray(groups) ? groups : [];
}

export const GROUP_COLORS = {
  blurple: "#5865F2",
  red: "#ED4245",
  orange: "#E67E22",
  yellow: "#F1C40F",
  green: "#3DA35D",
  teal: "#11A89D",
  cyan: "#00B0F4",
  blue: "#3B82F6",
  purple: "#9B59B6",
  pink: "#EB459E",
  gray: "#99AAB5",
  black: "#23272A",
};

export function getColorNames() {
  return Object.keys(GROUP_COLORS);
}

export function getColorValue(name) {
  return GROUP_COLORS[name] ?? GROUP_COLORS.blurple;
}

export function setGroupColor(groups, groupId, colorName) {
  const value = GROUP_COLORS[colorName] ? colorName : "blurple";
  return ensureGroups(groups).map((g) =>
    g.id === groupId ? { ...g, color: value } : g
  );
}

export function removeFromAllGroups(groups, src) {
  return ensureGroups(groups)
    .map(g => ({ ...g, servers: (g.servers ?? []).filter(s => s !== src) }))
    .filter(g => (g.servers ?? []).length > 0);
}
export const removeServer = removeFromAllGroups;

export function removeGroup(groups, groupId) {
  return ensureGroups(groups).filter(g => g.id !== groupId);
}

export function addToGroup(groups, groupId, src) {
  return ensureGroups(groups)
    .map(g =>
      g.id === groupId
        ? { ...g, servers: [...(g.servers ?? []), src] }
        : g
    )
    .filter(g => (g.servers ?? []).length > 0);
}

export function createGroupWith(servers, name = "New Group", color = "blurple") {
  return {
    id: genId(),
    name,
    color: GROUP_COLORS[color] ? color : "blurple",
    collapsed: false,
    servers: [...(servers ?? [])],
  };
}

export function toggleGroupCollapse(groups, groupId) {
  return ensureGroups(groups).map(g =>
    g.id === groupId ? { ...g, collapsed: !g.collapsed } : g
  );
}

export function ungroupedServers(servers, groups) {
  const list = ensureGroups(groups);
  const grouped = new Set(list.flatMap(g => g.servers ?? []));
  return (servers ?? []).filter(s => !grouped.has(s.src));
}

export function serverBySrc(servers, src) {
  return (servers ?? []).find(s => s.src === src);
}

export function renderedOrder(servers, groups) {
  const list = ensureGroups(groups);
  const groupOfSrc = new Map();
  list.forEach(g => (g.servers ?? []).forEach(src => groupOfSrc.set(src, g.id)));
  const seenGroups = new Set();
  const order = [];
  (servers ?? []).forEach(s => {
    const gid = groupOfSrc.get(s.src);
    if (gid) {
      if (seenGroups.has(gid)) return;
      seenGroups.add(gid);
      const group = list.find(g => g.id === gid);
      (group?.servers ?? []).forEach(src => order.push(src));
    } else {
      order.push(s.src);
    }
  });
  return order;
}

export function renameGroup(groups, groupId, name) {
  return ensureGroups(groups).map((g) =>
    g.id === groupId
      ? { ...g, name }
      : g
  );
}

// Top-level sidebar items, built the same way ServerBar builds `items`
function topLevelItems(servers, groups) {
  const order = renderedOrder(servers, groups);
  const items = [];
  const seen = new Set();

  for (const src of order) {
    const group = groups.find((g) => (g.servers ?? []).includes(src));
    if (group) {
      if (!seen.has(group.id)) {
        seen.add(group.id);
        items.push({ type: "group", id: group.id, srcs: [...(group.servers ?? [])] });
      }
    } else {
      items.push({ type: "server", id: src, srcs: [src] });
    }
  }
  return items;
}

// Flatten items back into a servers array (group members stay contiguous)
function flattenItems(servers, items) {
  const order = items.flatMap((i) => i.srcs);
  const ordered = order.map((src) => serverBySrc(servers, src)).filter(Boolean);
  const missing = servers.filter((s) => !order.includes(s.src));
  return [...ordered, ...missing];
}

function swap(arr, index, dir) {
  const j = index + dir;
  if (index < 0 || j < 0 || j >= arr.length) return arr;
  const copy = [...arr];
  [copy[index], copy[j]] = [copy[j], copy[index]];
  return copy;
}

/** dir: -1 = up, +1 = down. Returns { servers, groups } */
export function moveServer(servers, groups, src, dir) {
  const group = groups.find((g) => (g.servers ?? []).includes(src));

  // Inside a group: reorder within that group
  if (group) {
    const nextGroups = groups.map((g) =>
      g.id === group.id
        ? { ...g, servers: swap(g.servers, g.servers.indexOf(src), dir) }
        : g,
    );
    return {
      groups: nextGroups,
      servers: flattenItems(servers, topLevelItems(servers, nextGroups)),
    };
  }

  // Ungrouped: swap with the neighbouring server/group
  const items = topLevelItems(servers, groups);
  const idx = items.findIndex((i) => i.type === "server" && i.id === src);
  return { groups, servers: flattenItems(servers, swap(items, idx, dir)) };
}

export function moveGroup(servers, groups, groupId, dir) {
  const items = topLevelItems(servers, groups);
  const idx = items.findIndex((i) => i.type === "group" && i.id === groupId);
  return flattenItems(servers, swap(items, idx, dir));
}
