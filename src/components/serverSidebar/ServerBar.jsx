import { For, createSignal, createEffect } from "solid-js";
import Dialog from "../Dialog.jsx";
import ServerBrowser from "./discovery/ServerBrowser.jsx";
import Settings from "./Settings"

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
          <img
            style={{ opacity: .5 }}
            src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' height='24px' viewBox='0 -960 960 960' width='24px' fill='%23e3e3e3'%3E%3Cpath d='M433-80q-27 0-46.5-18T363-142l-9-66q-13-5-24.5-12T307-235l-62 26q-25 11-50 2t-39-32l-47-82q-14-23-8-49t27-43l53-40q-1-7-1-13.5v-27q0-6.5 1-13.5l-53-40q-21-17-27-43t8-49l47-82q14-23 39-32t50 2l62 26q11-8 23-15t24-12l9-66q4-26 23.5-44t46.5-18h94q27 0 46.5 18t23.5 44l9 66q13 5 24.5 12t22.5 15l62-26q25-11 50-2t39 32l47 82q14 23 8 49t-27 43l-53 40q1 7 1 13.5v27q0 6.5-2 13.5l53 40q21 17 27 43t-8 49l-48 82q-14 23-39 32t-50-2l-60-26q-11 8-23 15t-24 12l-9 66q-4 26-23.5 44T527-80h-94Zm7-80h79l14-106q31-8 57.5-23.5T639-327l99 41 39-68-86-65q5-14 7-29.5t2-31.5q0-16-2-31.5t-7-29.5l86-65-39-68-99 42q-22-23-48.5-38.5T533-694l-13-106h-79l-14 106q-31 8-57.5 23.5T321-633l-99-41-39 68 86 64q-5 15-7 30t-2 32q0 16 2 31t7 30l-86 65 39 68 99-42q22 23 48.5 38.5T427-266l13 106Zm42-180q58 0 99-41t41-99q0-58-41-99t-99-41q-59 0-99.5 41T342-480q0 58 40.5 99t99.5 41Zm-2-140Z'/%3E%3C/svg%3E"
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