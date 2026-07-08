import { HiOutlineHome } from "solid-icons/hi"
import { setState } from "../../App"

export default function DMsServerBtns() {
  return (
    <>
      <div className="channelList_button" onClick={() => { setState("current", "channel_type", "dms_home"); }}>
        <HiOutlineHome />
        Home
      </div>
      <hr className="channelPageList" />
    </>
  )
}