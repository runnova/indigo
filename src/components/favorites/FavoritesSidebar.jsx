import { For, Show, createMemo } from "solid-js";
import { HiOutlineHashtag, HiOutlineXMark } from "solid-icons/hi";
import { state, unreads } from "../../state.js";
import {
  getFavorites,
  openFavorite,
  removeFavorite,
} from "../../core/favorites.js";

export default function FavoritesSidebar() {
  const groups = createMemo(() => {
    const map = new Map();
    for (const f of getFavorites()) {
      if (!map.has(f.src)) {
        map.set(f.src, {
          src: f.src,
          name: f.serverName,
          icon: f.serverIcon,
          items: [],
        });
      }
      map.get(f.src).items.push(f);
    }
    return [...map.values()];
  });

  const isActive = (f) =>
    state.current.server?.src === f.src && state.current.channel === f.channel;

  return (
    <>
      <div class="server_info">
        <div class="header">
          <div class="dropdown x">
            <span>Favorites</span>
          </div>
        </div>
      </div>
      <div class="channel_list fill y">
        <Show
          when={groups().length}
          fallback={
            <p class="empty_state">
              No favorites yet. Use the ★ in a channel's top bar.
            </p>
          }
        >
          <For each={groups()}>
            {(g) => (
              <>
                <div class="fav_group_header x">
                  <Show when={g.icon}>
                    <img
                      src={g.icon}
                      class="fav_server_icon"
                      width="16"
                      height="16"
                    />
                  </Show>
                  <span>{g.name}</span>
                </div>
                <For each={g.items}>
                  {(f) => {
                    const u = () => unreads.servers?.[f.src]?.[f.channel];
                    return (
                      <div
                        class={`channel_item x ${isActive(f) ? "active" : ""}`}
                        onClick={() => openFavorite(f)}
                      >
                        <span className="channel_icon">
                          <HiOutlineHashtag class="" />
                        </span>
                        <div class="channel_name">{f.displayName}</div>
                        <Show when={u()?.ping_count > 0}>
                          <span class="channel_badge channel_badge--ping">
                            @{u().ping_count}
                          </span>
                        </Show>
                        <Show when={!u()?.ping_count && u()?.count > 0}>
                          <span class="channel_badge">{u().count}</span>
                        </Show>
                        <span> <HiOutlineXMark
                          class="fav_remove"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFavorite(f.src, f.channel);
                          }}
                        /></span>

                      </div>
                    );
                  }}
                </For>
              </>
            )}
          </For>
        </Show>
      </div>
    </>
  );
}
