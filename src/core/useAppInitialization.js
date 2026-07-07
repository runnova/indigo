export default async function (conn, setState, state, Rotur, setLoadingProgress) {
  Object.assign(tempState, {
    conn,
    roles: conn.roles,
    members: conn.members,
    membersOnline: conn.membersOnline
  });

  const server =
    state.current.server ??
    state.servers[0];

  if (!server) return;
  setState("current", "server", server);
setLoadingProgress(20);
  // get auth settings
  const settings = JSON.parse(
    localStorage.getItem("settings") || "{}"
  );
  setLoadingProgress(35);

  if (settings.type === "token" && settings.token) {
    tempState.rotur = new Rotur({ token: settings.token });
    conn.connect(server, settings.token);
  } else {
    conn.connectCracked(server, {
      username: "guest",
      password: "guest"
    });
  }
  const getHostname = (src) => {
    return new URL(
      src.includes("://") ? src : `https://${src}`
    ).hostname;
  };
  setLoadingProgress(50);
  await tempState.rotur.connectSocket();
  setLoadingProgress(80);

  await tempState.rotur.socket.join(
    state.servers.map(({ src }) => `originChats:${getHostname(src)}`)
  );
  setLoadingProgress(100);
}