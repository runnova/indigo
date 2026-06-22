export default function ServerBar(props) {
  return (
    <div class="server_bar y">
      <For each={props.servers}>
        {(server) => (
          <div
            class={`server_single${
              props.currentServer?.src === server.src
                ? " server_single--active"
                : ""
            }`}
            onClick={() => props.onSelect(server)}
          >
            <img
              src={server.icon ?? "https://icons.veryicon.com/png/o/commerce-shopping/soft-designer-online-tools-icon/group-38.png"}
              alt={server.name}
              class="server_icon"
            />
          </div>
        )}
      </For>
    </div>
  );
}