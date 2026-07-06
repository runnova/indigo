export default async function (conn, setState, state, Rotur) {
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

  // get auth settings
  const settings = JSON.parse(
    localStorage.getItem("settings") || "{}"
  );

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
  await tempState.rotur.connectSocket();

  await tempState.rotur.socket.join(
    state.servers.map(({ src }) => `originChats:${getHostname(src)}`)
  );
}