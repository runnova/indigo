import { createSignal, createEffect, on, For, Show } from "solid-js";
import { HiOutlineRocketLaunch, HiOutlineUserGroup, HiOutlineChatBubbleOvalLeft } from "solid-icons/hi";
import { createForumThreads } from "../useChannelMessages";
import { VirtualMessageList } from "../scolling";
import { timeAgo } from "./Utility";
import { state, setState } from "../App";

export function ForumView(props) {
  const [activeThread, setActiveThread] = createSignal(null);

  createEffect(() => {
    setState("current", "thread", activeThread());
  });

  const { threads, loading } = createForumThreads({
    channel: () => props.channel,
    wsEvent: () => props.wsMessages?.(),
    sendRequest: props.sendRequest,
  });

  return (
    <Show
      when={activeThread()}
      fallback={
        <ForumThreadList
          threads={threads}
          loading={loading}
          onSelect={(thread) => { setActiveThread(thread) }}
        />
      }
    >
      <VirtualMessageList
        channel={props.channel}
        threadId={activeThread().id}
        sendRequest={props.sendRequest}
        wsMessages={props.wsMessages}
        onReady={props.onReady}
        onBack={() => setActiveThread(null)}
      />
    </Show>
  );
}
function ForumThreadList(props) {
  const WEEK = 7 * 24 * 60 * 60;

  const activeThreads = () => {
    const now = Date.now() / 1000;

    return props.threads()
      .filter(
        (thread) =>
          thread.pinned ||
          (thread.last_message && now - thread.last_message < WEEK)
      )
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return b.pinned - a.pinned;
        return (b.last_message ?? 0) - (a.last_message ?? 0);
      });
  };
  const inactiveThreads = () => {
    const now = Date.now() / 1000;

    return props.threads().filter(
      (thread) =>
        !thread.pinned &&
        (!thread.last_message || now - thread.last_message >= WEEK)
    );
  };

  const ThreadItem = (thread) => (
    <div
      class="forum-thread-item y"
      onClick={() => props.onSelect(thread)}
    >
      <small>
        <img
          src={`https://avatars.rotur.dev/${thread.created_by}`}
          alt=""
          class="pfp"
          loading="lazy"
        />
        <span class="username">

          {thread.created_by}</span>
        <span style={{ "margin": "0 .3em" }}>&bull;</span>
        <span>{timeAgo(thread.created_at)}</span>
      </small>

      <div class="thread_name">{thread.name ?? "Untitled Thread"}</div>

      <Show when={thread.pinned}>
        <span class="pinned_icon">
          <HiOutlineRocketLaunch />
        </span>
      </Show>

      <small class="subt x">
        <HiOutlineUserGroup /> {thread.participants?.length ?? 0}
      </small>
    </div>
  );

  return (
    <div class="forum-thread-list y">
      <Show when={props.loading()}>
        <div>Loading threads…</div>
      </Show>

      <Show when={activeThreads().length}>
        <div className="label">Active</div>
        <div class="forum-section">

          <For each={activeThreads()}>
            {(thread) => ThreadItem(thread)}
          </For>
        </div>
      </Show>

      <Show when={inactiveThreads().length}>
        <div className="label">Inactive</div>
        <div class="forum-section">
          <For each={inactiveThreads()}>
            {(thread) => ThreadItem(thread)}
          </For>
        </div>
      </Show>
    </div>
  );
}