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
                  const server = { url: serverInput.value, src: serverInput.value, name: serverInput.value }
                  props.onJoin(server)
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
            <p><a href="https://git.rotur.dev/originChats/server">Create a server</a> and publish it to discovery.</p>
            <section class="requirements">
              <h2>Requirements</h2>
              <p>
                To be listed in discovery, a server must meet all of the following conditions:
              </p>

              <ul>
                <li>
                  <strong>Publicly accessible</strong>: The server must accept connections
                  from any user without an invite or whitelist.
                </li>
                <li>
                  <strong>Actively maintained</strong>: The server must be online and
                  responsive. Servers that go offline for extended periods will be removed.
                </li>
                <li>
                  <strong>Running OriginChats</strong>: The server must be a valid
                  OriginChats-compatible WebSocket server.
                </li>
                <li>
                  <strong>Safe for general audiences</strong>: NSFW content, harassment,
                  hate speech, and illegal material are not permitted on listed servers.
                </li>
                <li>
                  <strong>Owned by a real account</strong>: The listed owner must be a
                  valid rotur.dev account that can be contacted if needed.
                </li>
              </ul>
            </section>

            <section class="submission">
              <h2>How to submit your server</h2>

              <p>
                Discovery is curated manually. To request that your server is added:
              </p>

              <ol>
                <li>
                  Make sure your server meets all the requirements above.
                </li>
                <li>
                  Open a pull request on the 
                  <a href="https://git.rotur.dev/originChats/client">originChats-client</a> repository adding your server to
                  <code>discovery.json</code>.
                </li>
                <li>
                  Include your server's URL, name, owner (your
                  <code>rotur.dev</code> username), and an icon URL (square image,
                  at least <strong>128×128px</strong>).
                </li>
                <li>
                  A maintainer will review your submission. Servers that pass the
                  requirements will be merged and appear in discovery on the next release.
                </li>
              </ol>
            </section>

            <section class="removal">
              <h2>Removal</h2>

              <p>
                A server may be removed from discovery at any time if it no longer meets
                the requirements, becomes inaccessible, or receives reports of harmful
                content. Server owners will be contacted before removal where possible.
              </p>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}