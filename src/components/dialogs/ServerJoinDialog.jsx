import { Show, createSignal } from "solid-js";
import { HiOutlineUsers, HiOutlineHashtag } from "solid-icons/hi";
import "./joinDialog.css";

export default function ServerJoinDialog(props) {
  const info = () => props.join?.info;
  const [joining, setJoining] = createSignal(false);

  const handleJoin = async () => {
    if (joining()) return;
    setJoining(true);
    try {
      await props.onJoin();
    } finally {
      setJoining(false);
    }
  };

  return (
    <Show when={props.join}>
      <div class="server_join_overlay">
        <div class="server_join_dialog">
          <div className="x">
            <Show
              when={info()?.icon}
              fallback={
                <div class="server_join_icon server_join_icon_fallback">
                  {(info()?.name || props.join.src).slice(0, 1).toUpperCase()}
                </div>
              }
            >
              <img class="server_join_icon" src={info().icon} alt="" />
            </Show>
            <div>
              <small>You have been invited to,</small>
              <div class="server_join_name">
                {info()?.name || props.join.src}
              </div>
              <small class="server_join_src">{props.join.src}</small>
            </div>
          </div>

          <Show when={info()?.description}>
            <div class="server_join_description">{info().description}</div>
          </Show>

          <Show when={info()?.stats}>
            <div class="server_join_stats">
              <div class="server_join_stat">
                <HiOutlineUsers />
                <span>{info().stats.connectedUsers ?? 0} online</span>
              </div>
              <div class="server_join_stat">
                <HiOutlineUsers />
                <span>{info().stats.totalUsers ?? 0} members</span>
              </div>
              <div class="server_join_stat">
                <HiOutlineHashtag />
                <span>{info().stats.totalChannels ?? 0} channels</span>
              </div>
            </div>
          </Show>

          <div class="server_join_actions">
            <button onClick={props.onCancel} disabled={joining()}>
              Cancel
            </button>

            <button onClick={handleJoin} disabled={joining()}>
              {joining() ? "Joining…" : "Join Server"}
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}
