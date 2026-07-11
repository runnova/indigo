import { HiOutlineHome } from "solid-icons/hi"
import { setState, state } from "../../App"

export default function DMsServerBtns() {
  return (
    <>
      <Show when={(state.settings.dmsServer == state.current.server.src)}>
        <div className="channelList_button" onClick={() => { setState("current", "channel_type", "dms_home"); }}>
          <HiOutlineHome />
          Home
        </div>
        <hr className="channelPageList" />
      </Show>
    </>
  )
}