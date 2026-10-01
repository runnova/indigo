import { setSocketReady, applyRoomState, applyStatusUpdate } from "../App";

export default async function (conn, setState, state, Rotur, setLoadingProgress) {
  Object.assign(tempState, {
    conn
  });

  const server = state.current.server ?? state.servers[0];
  if (!server) return;
  setState("current", "server", server);
  setLoadingProgress(20);

  const settings = JSON.parse(localStorage.getItem("settings") || "{}");
  setLoadingProgress(35);

  tempState.rotur = new Rotur({ token: settings.token });
  if (settings.type === "token" && settings.token) {
    localStorage.setItem("rotur_embed_token", settings.token);
    conn.connect(server, settings.token);
  } else {
    conn.connectCracked(server, { username: "guest", password: "guest" });
  }

  const getHostname = (src) =>
    new URL(src.includes("://") ? src : `https://${src}`).hostname;

  setLoadingProgress(50);
  await tempState.rotur.connectSocket();
  setLoadingProgress(80);

  tempState.rotur.socket.on("room_state", applyRoomState);
  tempState.rotur.socket.on("status_update", applyStatusUpdate);
  setSocketReady(true);

  await tempState.rotur.socket.join(
    state.servers.map(({ src }) => `originChats:${getHostname(src)}`)
  );
  setLoadingProgress(100);
}
