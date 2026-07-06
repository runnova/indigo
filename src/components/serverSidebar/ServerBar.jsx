import { For, createSignal, createEffect } from "solid-js";
import Dialog from "../Dialog.jsx";
import ServerBrowser from "./discovery/ServerBrowser.jsx";
import Settings from "./Settings"
import { HiOutlineAdjustmentsHorizontal } from "solid-icons/hi";

export default function ServerBar(props) {
  const [dialogOpen, setDialogOpen] = createSignal(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = createSignal(false);

  const [dragIndex, setDragIndex] = createSignal(null);

  function move(array, from, to) {
    const copy = [...array];
    const [item] = copy.splice(from, 1);
    copy.splice(to, 0, item);
    return copy;
  }
  const fallbackIcon = `https://icons.veryicon.com/png/o/commerce-shopping/soft-designer-online-tools-icon/group-38.png`;
  return (
    <>
      <div class="server_bar y">
        <For each={props.servers}>
          {(server, index) => (
            <div
              draggable
              onClick={() => props.onSelect(server)}
              data-context="server"
              data-src={server.src}
              onDragStart={() => {
                setDragIndex(index());
              }}
              onDragOver={(e) => {
                e.preventDefault();
              }}
              onDrop={() => {
                const from = dragIndex();
                const to = index();

                if (from == null || from === to) return;

                props.onReorder(move(props.servers, from, to));

                setDragIndex(null);
              }}
              onDragEnd={() => setDragIndex(null)}
              class={`server_single ${props.currentServer?.src === server.src
                ? "server_single--active"
                : ""
                }`}
            >
              <img
                src={server.icon ?? fallbackIcon}
                alt={server.name}
                class="server_icon"
              />
              {!(
                props.unreads.servers?.[server.src]?.online ||
                props?.currentServer?.src === server.src
              ) && <span class="server_offline_indicator" />}

              <span class="server_tooltip">{server.name}</span>

              {props.unreadTotal(server.src) > 0 && (
                <span class="unread_badge"></span>
              )}
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

        <div
          class="server_single"
          onClick={() => setSettingsDialogOpen(true)}
          style={{ "margin-top": "auto" }}
        >
          <HiOutlineAdjustmentsHorizontal class="add_server"/>
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
      <Dialog
        open={settingsDialogOpen()}
        onClose={() => setSettingsDialogOpen(false)}
      >
        <Settings
        />
      </Dialog>
    </>
  );
}