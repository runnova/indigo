import { For, Show, createMemo, createResource, createSignal } from "solid-js";
import { HiOutlineMagnifyingGlass } from "solid-icons/hi"
import { timeAgo } from "../../Utility"
import "./style.css"

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
  const response = await fetch("https://originchats.com/discovery.json");

  if (!response.ok) {
    throw new Error("Failed to fetch servers");
  }

  const list = await response.json();

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

    if (!query) return servers() ?? [];

    return (servers() ?? []).filter((server) =>
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
                      />
                    </Show>

                    <div class="x">
                      <Show when={icon() && !iconFailed()}>
                        <img
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
