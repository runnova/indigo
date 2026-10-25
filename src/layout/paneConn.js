import { getConnectionView } from "../core/server_connection.jsx";

/*
  A pane's view of ITS server's connection. Backed by the reactive "view"
  that server_connection.jsx now attaches to every connection (active or idle),
  so panes on non-active servers still receive events and reactive state.
  Every accessor is safe to call before the connection exists.
*/
export function getPaneConn(src) {
  const v = () => getConnectionView(src);

  return {
    src,
    send: (msg) => v()?.send(msg),
    lastEvent: () => v()?.lastEvent() ?? null,
    status: () => v()?.status() ?? "connecting",
    error: () => v()?.error() ?? null,
    channels: () => v()?.channels() ?? [],
    me: () => v()?.me() ?? null,
    serverInfo: () => v()?.serverInfo() ?? null,
    roles: () => v()?.roles() ?? [],
    emojis: () => v()?.emojis() ?? [],
    members: () => v()?.members() ?? [],
    membersOnline: () => v()?.membersOnline() ?? [],
  };
}
