import { Dynamic } from "solid-js/web";
import { createSignal, createEffect, Show } from "solid-js";
import MemberList from "./memberList/MemberList.jsx";
import PinnedList from "./PinnedList.jsx";
import SelfRoles from "./SelfRoles.jsx";
import SearchResultsList from "./SearchResultsList.jsx";
import MemberProfile from "./memberList/MemberPopoutContent.jsx";
import Inbox from "./Inbox.jsx";
import { thirdBarWidth, thirdBarCollapsed } from "../../App.jsx"

const thirdBarViews = {
  members: MemberList,
  pinned: PinnedList,
  search: SearchResultsList,
  inbox: Inbox,
  selfroles: SelfRoles
};

export default function RightSidebar(props) {
  const [isLoading, setIsLoading] = createSignal(false);
  const [currentContext, setCurrentContext] = createSignal(null);

  createEffect(() => {
    const newContext = props.state.thirdBarContext;
    if (newContext !== currentContext()) {
      setIsLoading(true);
      const timeout = setTimeout(() => {
        setCurrentContext(newContext);
        setIsLoading(false);
      }, 300);
      return () => clearTimeout(timeout);
    }
  });

  const View = () => {
    if (props?.type && props?.type === "fill") {
      return MemberList;
    }
    if (props?.type && props?.type === "chat" && currentContext() === "members") {
      return MemberProfile;
    }
    return thirdBarViews[currentContext()] || MemberList
  };

  return (
    <>
      <div
        class="third_bar bar"
        style={{
          width: thirdBarCollapsed() ? "0px" : `${thirdBarWidth()}px`,
          "min-width": thirdBarCollapsed() ? "0px" : `${thirdBarWidth()}px`,
          "max-width": thirdBarCollapsed() ? "0px" : `${thirdBarWidth()}px`,
          "overflow-x": "hidden",
          "border-left": thirdBarCollapsed() ? "none" : undefined,
        }}
      >
        <Show when={!thirdBarCollapsed()}>
          <div style={{ position: "relative", height: "100%" }}>
            <Show when={isLoading()}>
              <div class="loader_overlay">
                <div class="loader_spinner"></div>
              </div>
            </Show>

            <div
              style={{
                opacity: isLoading() ? 0.5 : 1,
                transition: "opacity 0.2s ease-in-out",
                "pointer-events": isLoading() ? "none" : "auto",
              }}
            >
              <Dynamic component={View()}
                conn={props.conn}
                getHoistedRole={props.getHoistedRole} {...props} />
            </div>
          </div>
        </Show>
      </div>
    </>
  );
}
