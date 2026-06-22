import { createSignal } from "solid-js";
import ServerDiscovery from "./ServerDiscovery";

export default function ServerBrowser(props) {
  const [tab, setTab] = createSignal("explore");

  return (
    <div class="server_browser">
      <div class="browser_tabs">
        <button
          classList={{ active: tab() === "explore" }}
          onClick={() => setTab("explore")}
        >
          Explore
        </button>

        <button
          classList={{ active: tab() === "url" }}
          onClick={() => setTab("url")}
        >
          By URL
        </button>

        <button
          classList={{ active: tab() === "host" }}
          onClick={() => setTab("host")}
        >
          Host your own
        </button>
      </div>

      <div class="browser_content">
        {tab() === "explore" && (
          <ServerDiscovery onJoin={props.onJoin} />
        )}

        {tab() === "url" && (
          <div class="url_tab">
            <div className="member_section_label">Join by URL</div>
            <div className="searchbox">
            <input placeholder="chats.mistium.com" />
            <button>Join</button>

            </div>
          </div>
        )}

        {tab() === "host" && (
          <div class="host_tab">
            <h1>Host your own</h1>
            <p>Create a server and publish it to discovery.</p>
          </div>
        )}
      </div>
    </div>
  );
}