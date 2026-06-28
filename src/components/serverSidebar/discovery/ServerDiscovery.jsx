import { For, Show, createMemo, createResource, createSignal } from "solid-js";
import { HiOutlineMagnifyingGlass } from "solid-icons/hi"
import { timeAgo } from "../../Utility"

async function fetchServers() {
  const response = await fetch(
    "https://originchats.mistium.com/discovery.json"
  );

  if (!response.ok) {
    throw new Error("Failed to fetch servers");
  }

  return response.json();
}

export default function ServerDiscovery(props) {
  const [servers] = createResource(fetchServers);
  const [search, setSearch] = createSignal("");

  const filteredServers = createMemo(() => {
    const query = search().toLowerCase();

    if (!query) return servers() ?? [];

    return (servers() ?? []).filter((server) =>
      [
        server.name,
        server.owner,
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
          <div className="member_section_label">Explore public service</div>
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
              {(server) => (
                <div class="discovery_card">
                  <img
                    src={server.icon}
                    alt={server.name}
                    class="discovery_card_icon"
                  />

                  <div class="discovery_card_content">
                    <h3>{server.name}</h3>
                    <small>
                      {server.url}</small>
                    <div class="discovery_owner">
                      by {server.owner} &bull; {timeAgo(server.created_at)}
                    </div>

                    <div class="discovery_tags">
                      <For each={server.tags ?? []}>
                        {(tag) => (
                          <span class="discovery_tag">
                            {tag}
                          </span>
                        )}
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
              )}
            </For>
          </div>
        </Show>
      </Show>
    </div>
  );
}