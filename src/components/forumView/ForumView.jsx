import { createSignal, createEffect, on, For, Show } from "solid-js";
import {
  HiOutlineRocketLaunch,
  HiOutlineUserGroup,
  HiOutlineMagnifyingGlass,
  HiOutlineChatBubbleLeft,
  HiOutlineXMark,
} from "solid-icons/hi";
import { createForumThreads } from "../../core/useChannelMessages";
import { VirtualMessageList } from "../../scrolling";
import { timeAgo } from "../Utility";
import { state, setState, conn } from "../../App";
import MessageComposer from "../compose/MessageComposer";
import "./style.css";

export function ForumView(props) {
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

    const stillCurrent = list.find((t) => t.id === currentId);
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
        onLeave={() => {
          conn.send({
            cmd: "thread_leave",
            thread_id: state.current.thread.id,
          });
        }}
        onJoin={() => {
          conn.send({
            cmd: "thread_join",
            thread_id: state.current.thread.id,
          });
        }}
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
            ...(state.replying && { reply_to: state.replying.id }),
          });

          if (state.replying) setState("replying", null);
        }}
      />
    </Show>
  );
}

function ForumThreadList(props) {
  const WEEK = 7 * 24 * 60 * 60;

  // "search" mode: input acts as a filter over existing threads
  // "compose" mode: input becomes the new thread's title, plus a body textarea
  const [mode, setMode] = createSignal("search"); // "search" | "compose"
  const [query, setQuery] = createSignal("");
  const [postBody, setPostBody] = createSignal("");
  const [submitting, setSubmitting] = createSignal(false);

  let inputRef;

  const filteredThreads = () => {
    const q = query().trim().toLowerCase();
    if (!q || mode() === "compose") return props.threads();
    return props
      .threads()
      .filter((thread) =>
        (thread.name ?? "Untitled Thread").toLowerCase().includes(q),
      );
  };

  const activeThreads = () => {
    const now = Date.now() / 1000;

    return filteredThreads()
      .filter(
        (thread) =>
          thread.pinned ||
          (thread.last_message && now - thread.last_message < WEEK),
      )
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return b.pinned - a.pinned;
        return (b.last_message ?? 0) - (a.last_message ?? 0);
      });
  };
  const inactiveThreads = () => {
    const now = Date.now() / 1000;

    return filteredThreads().filter(
      (thread) =>
        !thread.pinned &&
        (!thread.last_message || now - thread.last_message >= WEEK),
    );
  };

  const enterComposeMode = () => {
    setMode("compose");
    // keep whatever was typed in the search box as the starting title
    queueMicrotask(() => inputRef?.focus());
  };

  const cancelDraft = () => {
    setMode("search");
    setPostBody("");
    // keep query text so the user's search isn't lost, but you could
    // clear it instead with setQuery("") if that's the desired UX
  };

  const submitPost = () => {
    const title = query().trim();
    const body = postBody().trim();
    if (!title || submitting()) return;

    setSubmitting(true);

    conn.send({
      cmd: "thread_new",
      channel: state.current.channel,
      name: title,
      content: body,
    });

    // Optimistically reset back to search mode; the new thread will
    // arrive via the ws event / createForumThreads refresh.
    setSubmitting(false);
    setMode("search");
    setQuery("");
    setPostBody("");
  };

  const handleInputKeyDown = (e) => {
    if (e.key === "Enter" && mode() === "compose" && !e.shiftKey) {
      e.preventDefault();
      submitPost();
    }
    if (e.key === "Escape" && mode() === "compose") {
      cancelDraft();
    }
  };

  const ThreadItem = (thread) => (
    <div class="forum-thread-item y" onClick={() => props.onSelect(thread)}>
      <small>
        <img
          src={`https://avatars.rotur.dev/${thread.created_by}`}
          alt=""
          class="pfp"
          loading="lazy"
        />
        <span class="username">{thread.created_by}</span>
        <span style={{ margin: "0 .3em" }}>&bull;</span>
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
    <>
      <div className="forum_post_compose">
        <div className="searchbox" style={(mode() === "compose") ? { "align-items": "flex-start" } : {} }>
          <Show when={mode() !== "compose"}>
            <HiOutlineMagnifyingGlass></HiOutlineMagnifyingGlass>
          </Show>

          <Show when={mode() === "compose"}>
            <button
              style={{"padding": ".5em 0"}}>
              <HiOutlineXMark
                onClick={cancelDraft}
              />
            </button>
          </Show>
          <div class={mode() === "compose" ? "y fill" : "fill"}>
            {" "}
            <input
              ref={inputRef}
              type="text"
              value={query()}
              onInput={(e) => setQuery(e.currentTarget.value)}
              onKeyDown={handleInputKeyDown}
              placeholder={
                mode() === "compose"
                  ? "Post title..."
                  : "Search " + state.current.channel + " or create a post..."
              }
            />
            <Show when={mode() === "compose"}>
              <textarea
                class="forum_post_body"
                placeholder="Write the first message of your post..."
                value={postBody()}
                onInput={(e) => setPostBody(e.currentTarget.value)}
                rows={4}
              />
            </Show>
          </div>

          <button
            class="new_forum_post_btn"
            disabled={mode() === "compose" && !query().trim()}
            onClick={() => {
              if (mode() === "search") {
                enterComposeMode();
              } else {
                submitPost();
              }
            }}
          >
            <HiOutlineChatBubbleLeft></HiOutlineChatBubbleLeft>
            {mode() === "compose" ? "Post" : "New Post"}
          </button>
        </div>
      </div>

      <div class="forum-thread-list y">
        <Show when={props.loading()}>
          <div>Loading threads…</div>
        </Show>

        <Show
          when={
            mode() === "search" && !filteredThreads().length && query().trim()
          }
        >
          <div class="no_results">No threads match "{query()}"</div>
        </Show>

        <Show when={activeThreads().length}>
          <div className="label">Active</div>
          <div class="forum-section">
            <For each={activeThreads()}>{(thread) => ThreadItem(thread)}</For>
          </div>
        </Show>
        <Show when={inactiveThreads().length}>
          <div className="label">Inactive</div>
          <div class="forum-section">
            <For each={inactiveThreads()}>{(thread) => ThreadItem(thread)}</For>
          </div>
        </Show>
      </div>
    </>
  );
}
