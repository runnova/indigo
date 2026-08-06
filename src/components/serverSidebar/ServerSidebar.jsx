import ServerHeader from "./ServerHeader.jsx";
import ChannelList from "./ChannelList.jsx";
import DMsServerBtns from "./DMsServerBtns.jsx"
export default function ServerSidebar(props) {
  return (
    <>
      <ServerHeader serverInfo={props.serverInfo} />
      <DMsServerBtns/>
      <ChannelList
        channels={props.channels}
        currentChannel={props.currentChannel}
        unreads={props.unreads}
        serverSrc={props.serverSrc}
        onSelect={props.onSelectChannel}
        preloadChannel={props.preloadChannel}
      />
    </>
  );
}
