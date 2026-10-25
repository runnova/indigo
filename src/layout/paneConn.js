import { getConnectionView } from "../core/server_connection.jsx";

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
