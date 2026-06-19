import { Show } from "solid-js";
import { HiSolidChevronRight } from "solid-icons/hi";

export default function ServerHeader(props) {
  return (
    <div class="server_info">
      <div class="header">
        <Show when={props.serverInfo?.banner}>
          <img
            src={props.serverInfo.banner}
            alt="Server Banner"
            class="banner"
          />
        </Show>

        <div class="dropdown x">
          <span>{props.serverInfo?.name}</span>
          <HiSolidChevronRight />
        </div>
      </div>
    </div>
  );
}