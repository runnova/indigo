import { Dynamic } from "solid-js/web";
import MemberList from "./MemberList.jsx";
import PinnedList from "./PinnedList.jsx";
import SelfRoles from "./SelfRoles.jsx";
import SearchResultsList from "./SearchResultsList.jsx";
import Inbox from "./Inbox.jsx";

const thirdBarViews = {
  members: MemberList,
  pinned: PinnedList,
  search: SearchResultsList,
  inbox: Inbox,
  selfroles: SelfRoles
};

export default function RightSidebar(props) {
  const View = () =>
    thirdBarViews[props.state.thirdBarContext] || MemberList;

  return (
    <div class="third_bar bar">
      <Dynamic component={View()} {...props} />
    </div>
  );
}