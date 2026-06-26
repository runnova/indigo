import { createSignal } from "solid-js";
import { setState } from "../../../App"
import ServerDiscovery from "./ServerDiscovery";
import { HiOutlineGlobeEuropeAfrica, HiOutlineLink, HiOutlineServerStack } from "solid-icons/hi"

export default function ServerBrowser(props) {
  const [tab, setTab] = createSignal("explore");

  let serverInput;
  return (
    <div class="server_browser">
      <div class="browser_tabs">
        <button
          class="icon_button text"
          classList={{ active: tab() === "explore" }}
          onClick={() => setTab("explore")}
        >
          <HiOutlineGlobeEuropeAfrica />
          Explore
        </button>

        <button
          class="icon_button text"
          classList={{ active: tab() === "url" }}
          onClick={() => setTab("url")}
        >
          <HiOutlineLink />
          By URL
        </button>

        <button
          class="icon_button text"
          classList={{ active: tab() === "host" }}
          onClick={() => setTab("host")}
        >
          <HiOutlineServerStack />
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

              <input
                ref={serverInput}
                placeholder="chats.mistium.com"
              />

              <button
                onClick={() => {
                  setState("current", {
                    server: serverInput.value,
                    channel: null
                  });
                }}
              >
                Join
              </button>
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