import { state, setState, switchToChannel } from "../state.js";

export const getFavorites = () => state.settings.favoriteSpace ?? [];

export const isFavorite = (src, channel) =>
  getFavorites().some((f) => f.src === src && f.channel === channel);

export function removeFavorite(src, channel) {
  setState("settings", "favoriteSpace", (favs) =>
    (favs ?? []).filter((f) => !(f.src === src && f.channel === channel)),
  );
}

export function removeFavoritesForServer(src) {
  setState("settings", "favoriteSpace", (favs) =>
    (favs ?? []).filter((f) => f.src !== src),
  );
}

export function toggleFavorite(server, channel) {
  if (!server?.src || !channel?.name) return;

  if (isFavorite(server.src, channel.name)) {
    removeFavorite(server.src, channel.name);
    return;
  }

  setState("settings", "favoriteSpace", (favs) => [
    ...(favs ?? []),
    {
      src: server.src,
      serverName: server.name ?? server.src,
      serverIcon: server.icon ?? null,
      channel: channel.name,
      displayName: channel.display_name || channel.name,
      type: channel.type ?? "text",
    },
  ]);
}

export async function openFavorite(fav) {
  setState("serverChannels", fav.src, fav.channel);
  await switchToChannel(fav.src, fav.channel);
  setState("current", "inFavorites", true);
}

export function openFavorites() {
  const favs = getFavorites();
  setState("current", "inFavorites", true);

  const alreadyOnOne = favs.some(
    (f) =>
      f.src === state.current.server?.src &&
      f.channel === state.current.channel,
  );
  if (!alreadyOnOne && favs[0]) openFavorite(favs[0]);
}
