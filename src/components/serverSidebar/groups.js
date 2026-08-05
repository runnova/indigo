export function genId() {
  return `grp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function ensureGroups(groups) {
  return Array.isArray(groups) ? groups : [];
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

export function createGroupWith(servers, name = "New Group", color = "#5865F2") {
  return {
    id: genId(),
    name,
    color,
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
