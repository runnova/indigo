import { createSignal, onMount, onCleanup, Show } from "solid-js";
import { formatTime } from "./MemberPopoutContent";

export function ActivityCard(props) {
  const activity = () => props.activity;
  const media = () => activity()?.media;

  const [now, setNow] = createSignal(Date.now());
  let interval;
  onMount(() => {
    interval = setInterval(() => setNow(Date.now()), 1000);
  });
  onCleanup(() => clearInterval(interval));

  const hasProgress = () => {
    const m = media();
    return (
      m &&
      typeof m.start === "number" &&
      typeof m.end === "number" &&
      m.end > m.start
    );
  };

  const progressPct = () => {
    if (!hasProgress()) return 0;
    const m = media();
    const pct = ((now() - m.start) / (m.end - m.start)) * 100;
    return Math.min(100, Math.max(0, pct));
  };

  const elapsedLabel = () => {
    const m = media();
    if (!m) return null;
    const cur = Math.min(now(), m.end ?? now()) - m.start;
    return formatTime(cur);
  };

  const totalLabel = () => {
    const m = media();
    if (!m || !m.end) return null;
    return formatTime(m.end - m.start);
  };

  function elapsedSince(startTime) {
    const diffMs = now() - startTime;
    const mins = Math.floor(diffMs / 60000);
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;

    if (hrs > 0) {
      return `for ${hrs} hour${hrs !== 1 ? "s" : ""}${remMins > 0 ? ` ${remMins}m` : ""}`;
    }
    if (mins == 0) {
      return "started just now";
    }
    return `for ${mins} minute${mins !== 1 ? "s" : ""}`;
  }

  return (
    <div class="activity_card x">
      <div class="activity_img_col">
        <Show
          when={activity().image}
          fallback={<div class="activity_img activity_img_placeholder" />}
        >
          <img src={activity().image} alt="" class="activity_img" />
        </Show>
      </div>

      <div class="activity_text_col y">
        <div
          className="x"
          style={{
            "align-items": "flex-start",
            "justify-content": "space-between",
            "flex-wrap": "wrap",
          }}
        >
          <div class="activity_title" style={{ "margin-right": "1em" }}>
            {activity().title}
          </div>

          <Show when={activity().application?.name}>
            <small class="activity_app">{activity().application.name}</small>
          </Show>
        </div>

        <Show when={media()?.title}>
          <div class="activity_media_title">{media().title}</div>
        </Show>

        <Show when={media()?.artist}>
          <small class="activity_media_artist">{media().artist}</small>
        </Show>

        <Show
          when={hasProgress()}
          fallback={
            <Show when={activity().start_time}>
              <small class="activity_time">
                {elapsedSince(activity().start_time)}
              </small>
            </Show>
          }
        >
          <div class="activity_progress_wrap">
            <div class="activity_progress_track">
              <div
                class="activity_progress_fill"
                style={{ width: `${progressPct()}%` }}
              />
            </div>
            <div class="activity_progress_labels x">
              <small>{elapsedLabel()}</small>
              <small>{totalLabel()}</small>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}
