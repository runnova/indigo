import { Dynamic } from "solid-js/web";
import MemberList from "./memberList/MemberList.jsx";
import PinnedList from "./PinnedList.jsx";
import SelfRoles from "./SelfRoles.jsx";
import SearchResultsList from "./SearchResultsList.jsx";
import MemberProfile from "./memberList/MemberPopoutContent.jsx";
import Inbox from "./Inbox.jsx";
import { thirdBarWidth } from "../../App.jsx"

const thirdBarViews = {
  members: MemberList,
  pinned: PinnedList,
  search: SearchResultsList,
  inbox: Inbox,
  selfroles: SelfRoles
};

export default function RightSidebar(props) {
  const View = () => {
    if (props?.type && props?.type === "fill") {
      return MemberList;
    }
    if (props?.type && props?.type === "chat" && props.state.thirdBarContext == "members") {
      return MemberProfile;
    }
    return thirdBarViews[props.state.thirdBarContext] || MemberList
  };

  return (
    <>
      <div
        class="third_bar bar"
        style={{
          width: `${thirdBarWidth()}px`,
          "min-width": `${thirdBarWidth()}px`,
          "max-width": `${thirdBarWidth()}px`,
        }}
      >
        <Dynamic component={View()}
          conn={props.conn}
          getHoistedRole={props.getHoistedRole} {...props} />
      </div>
    </>
  );
}