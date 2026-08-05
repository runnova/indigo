import { createSignal, createEffect, on, For, Show } from "solid-js";
import { HiOutlineRocketLaunch, HiOutlineUserGroup, HiOutlineChatBubbleOvalLeft } from "solid-icons/hi";
import { createForumThreads } from "../core/useChannelMessages";
import { VirtualMessageList } from "../scrolling";
import { timeAgo } from "./Utility";
import { state, setState, conn } from "../App";
import MessageComposer from "./compose/MessageComposer";

export function ForumView(props) {
  const [activeThread, setActiveThread] = createSignal(null);

  const { threads, loading } = createForumThreads({
    channel: () => props.channel,
    wsEvent: () => props.wsMessages?.(),
    sendRequest: props.sendRequest,
  });

  createEffect(() => {
    const list = threads();
    if (!list.length) return;

    const currentId = state.current.thread?.id;
    if (!currentId) return;

    const stillCurrent = list.find(t => t.id === currentId);
    if (stillCurrent && stillCurrent !== state.current.thread) {
      setState("current", "thread", stillCurrent);
    }
  });
  return (
    <Show
      when={state.current.thread}
      fallback={
        <ForumThreadList
          threads={threads}
          loading={loading}
          onSelect={(thread) => setState("current", "thread", thread)}
        />
      }
    >
      <VirtualMessageList
        channel={props.channel}
        threadId={state.current.thread.id}
        sendRequest={props.sendRequest}
        wsMessages={props.wsMessages}
        onReady={props.onReady}
        onBack={() => setState("current", "thread", null)}
      />

      <MessageComposer
        channel={state.current.channel}
        onSend={(content, attachments) => {
          conn.send({
            cmd: "message_new",
            channel: state.current.channel,
            thread_id: state.current.thread.id,
            content,
            attachments,
            ...(state.replying && { reply_to: state.replying.id })
          });

          if (state.replying) setState("replying", null);
        }}
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
