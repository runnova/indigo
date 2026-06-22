import { For, createSignal } from "solid-js";
import Dialog from "./Dialog";
import ServerBrowser from "./ServerBrowser.jsx";

export default function ServerBar(props) {
  const [dialogOpen, setDialogOpen] = createSignal(false);

  return (
    <>
      <div class="server_bar y">
        <For each={props.servers}>
          {(server) => (
            <div
              class={`server_single${props.currentServer?.src === server.src
                  ? " server_single--active"
                  : ""
                }`}
              onClick={() => props.onSelect(server)}
            >
              <img
                src={
                  server.icon ??
                  "https://icons.veryicon.com/png/o/commerce-shopping/soft-designer-online-tools-icon/group-38.png"
                }
                alt={server.name}
                class="server_icon"
              />
            </div>
          )}
        </For>

        <div
          class="server_single"
          onClick={() => setDialogOpen(true)}
        >
          <img
            src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' height='24px' viewBox='0 -960 960 960' width='24px' fill='%233DA35D'%3E%3Cpath d='M440-440H240q-17 0-28.5-11.5T200-480q0-17 11.5-28.5T240-520h200v-200q0-17 11.5-28.5T480-760q17 0 28.5 11.5T520-720v200h200q17 0 28.5 11.5T760-480q0 17-11.5 28.5T720-440H520v200q0 17-11.5 28.5T480-200q-17 0-28.5-11.5T440-240v-200Z'/%3E%3C/svg%3E"
            class="server_icon add_server"
          />
        </div>
      </div>

      <Dialog
        open={dialogOpen()}
        onClose={() => setDialogOpen(false)}
      >
        <ServerBrowser
          servers={servers()}
          onJoin={(server) => {
            props.onSelect(server);
            setDialogOpen(false);
          }}
        />
      </Dialog>
    </>
  );
}