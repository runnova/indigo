import { For, Show, createMemo, createResource, createSignal } from "solid-js";
import { HiOutlineMagnifyingGlass } from "solid-icons/hi"
import { timeAgo } from "../../Utility"
import "./style.css"

const PINNED_URL = "indigo.host.originchats.com";

async function fetchServerInfo(baseUrl) {
  try {
    const res = await fetch(`https://${baseUrl.replace(/\/$/, "")}/info`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchServers() {
  const urls = [
    "https://originchats.com/discovery.json",
    "https://discovery.host.originchats.com/discovery.json",
  ];

  const lists = await Promise.all(
    urls.map(async (url) => {
      try {
        const response = await fetch(url);
        if (!response.ok) return [];
        return await response.json();
      } catch {
        return [];
      }
    })
  );

  const merged = new Map();
  for (const list of lists) {
    for (const entry of list) {
      merged.set(entry.url, entry);
    }
  }
  const list = [...merged.values()];

  const withInfo = await Promise.all(
    list.map(async (entry) => {
      const info = await fetchServerInfo(entry.url);
      return { ...entry, info };
    })
  );

  return withInfo;
}

export default function ServerDiscovery(props) {
  const [servers] = createResource(fetchServers);
  const [search, setSearch] = createSignal("");

  const filteredServers = createMemo(() => {
    const query = search().toLowerCase();

    const list = !query
      ? (servers() ?? [])
      : (servers() ?? []).filter((server) =>
          [
            server.info?.server?.name ?? server.name,
            server.info?.server?.owner?.name ?? server.owner,
            server.url,
            ...(server.tags ?? [])
          ]
            .join(" ")
            .toLowerCase()
            .includes(query)
        );

    // Pin the chosen server to the front, regardless of search/sort order.
    const normalize = (u) => (u ?? "").replace(/^https?:\/\//, "").replace(/\/$/, "");
    const pinnedIndex = list.findIndex((s) => normalize(s.url) === PINNED_URL);

    if (pinnedIndex > 0) {
      const copy = [...list];
      const [pinned] = copy.splice(pinnedIndex, 1);
      copy.unshift(pinned);
      return copy;
    }

    return list;
  });

  return (
    <div class="discovery">
      <Show when={!servers.loading} fallback={<p>Loading...</p>}>
        <Show when={!servers.error} fallback={<p>Failed to load servers.</p>}>
          <div className="member_section_label">Explore public servers</div>
          <div class="searchbox">
            <input
              type="text"
              class="discovery_search"
              placeholder="Search servers..."
              value={search()}
              onInput={(e) => setSearch(e.currentTarget.value)}
            />
            <HiOutlineMagnifyingGlass />
          </div>
          <div class="discovery_grid">
            <For each={filteredServers()}>
              {(server) => {
                const info = () => server.info?.server;
                const stats = () => server.info?.stats;

                const name = () => info()?.name ?? server.name;
                const icon = () => info()?.icon ?? server.icon;
                const ownerName = () => info()?.owner?.name ?? server.owner;

                const [bannerFailed, setBannerFailed] = createSignal(false);
                const [iconFailed, setIconFailed] = createSignal(false);

                return (
                  <div class="discovery_card y">
                    <Show when={info()?.banner && !bannerFailed()}>
                      <img
                        src={info().banner}
                        alt=""
                        class="discovery_card_banner"
                        onError={() => setBannerFailed(true)}
                        loading="lazy"
                      />
                    </Show>

                    <div class="x">
                      <Show when={icon() && !iconFailed()}>
                        <img
                          loading="lazy"
                          src={icon()}
                          alt={name()}
                          class="discovery_card_icon"
                          onError={() => setIconFailed(true)}
                        />
                      </Show>

                      <div class="discovery_card_content y">
                        <h3>{name()}</h3>
                        <small>{server.url}</small>
                        <div class="discovery_owner">
                          by {ownerName()} &bull; {timeAgo(server.created_at)}
                        </div>

                        <Show when={stats()}>
                          <div class="discovery_stats">
                            {stats().connected_users} online &bull; {stats().total_users} members
                          </div>
                        </Show>

                        <div class="discovery_tags">
                          <For each={server.tags ?? []}>
                            {(tag) => <span class="discovery_tag">{tag}</span>}
                          </For>
                        </div>

                        <button
                          class="discovery_join"
                          onClick={() => props.onJoin?.(server)}
                        >
                          Join
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }}
            </For>
          </div>
        </Show>
      </Show>
    </div>
  );
}
