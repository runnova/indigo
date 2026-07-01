import { Show, createSignal, createEffect, onMount, onCleanup } from "solid-js";
import { popout, closePopout } from "./popout";
function renderICN(code, canvas) {
  const ctx = canvas.getContext('2d');
  ctx.save();

  let scale = 1;
  let moveX = 0;
  let moveY = 0;

  ctx.translate(canvas.width / 2 - 2, canvas.height / 2 - 2);
  ctx.lineCap = 'round';
  let last = { x: 0, y: 0 };
  const cmds = code.trim().split(/\s+/);
  let color = '#000', weight = 1;

  const S = v => v * scale;
  const TX = x => S(x + moveX);
  const TY = y => -S(y + moveY);

  for (let i = 0; i < cmds.length; i++) {
    const cmd = cmds[i];

    if (cmd === 'scale') scale = parseFloat(cmds[++i]);
    else if (cmd === 'move') { moveX = parseFloat(cmds[++i]); moveY = parseFloat(cmds[++i]); }

    else if (cmd === 'c') color = cmds[++i];
    else if (cmd === 'w') weight = parseFloat(cmds[++i]) * scale;

    else if (cmd === 'line') {
      const x1 = TX(parseFloat(cmds[++i])), y1 = TY(parseFloat(cmds[++i])),
        x2 = TX(parseFloat(cmds[++i])), y2 = TY(parseFloat(cmds[++i]));
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = weight;
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      last = { x: parseFloat(cmds[i - 1]), y: parseFloat(cmds[i]) };
    }

    else if (cmd === 'cont') {
      const x = parseFloat(cmds[++i]), y = parseFloat(cmds[++i]);
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = weight;
      ctx.moveTo(TX(last.x), TY(last.y));
      ctx.lineTo(TX(x), TY(y));
      ctx.stroke();
      last = { x, y };
    }

    else if (cmd === 'square') {
      const x = parseFloat(cmds[++i]), y = parseFloat(cmds[++i]),
        w = parseFloat(cmds[++i]), h = parseFloat(cmds[++i]);
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = weight;
      ctx.strokeRect(TX(x) - S(w / 2), TY(y) - S(h / 2), S(w), S(h));
    }

    else if (cmd === 'dot') {
      const x = TX(parseFloat(cmds[++i])), y = TY(parseFloat(cmds[++i]));
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.arc(x, y, weight / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    else if (cmd === 'cutcircle') {
      const x0 = parseFloat(cmds[++i]), y0 = parseFloat(cmds[++i]);
      const radius = parseFloat(cmds[++i]) * scale;
      let angleICN = parseFloat(cmds[++i]);
      let filledICN = parseFloat(cmds[++i]);
      let circleAngle = (angleICN * 10) - filledICN;
      let oldX = TX(x0) + Math.sin(circleAngle * Math.PI / 180) * radius;
      let oldY = TY(y0) - Math.cos(circleAngle * Math.PI / 180) * radius;
      const steps = Math.floor(filledICN / 3) + 1;
      ctx.strokeStyle = color;
      ctx.lineWidth = weight;
      for (let j = 0; j < steps - 1; j++) {
        circleAngle += 6;
        const newX = TX(x0) + Math.sin(circleAngle * Math.PI / 180) * radius;
        const newY = TY(y0) - Math.cos(circleAngle * Math.PI / 180) * radius;
        ctx.beginPath();
        ctx.moveTo(oldX, oldY);
        ctx.lineTo(newX, newY);
        ctx.stroke();
        oldX = newX;
        oldY = newY;
      }
    }

    else if (cmd === 'ellipse') {
      const x = parseFloat(cmds[++i]), y = parseFloat(cmds[++i]),
        width = parseFloat(cmds[++i]), hm = parseFloat(cmds[++i]),
        dir = parseFloat(cmds[++i]) * Math.PI / 180;
      ctx.save();
      ctx.translate(TX(x), TY(y));
      ctx.rotate(dir);
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = weight;
      ctx.scale(1, hm);
      ctx.arc(0, 0, S(width / 2), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    else if (cmd === 'curve') {
      const x1 = TX(parseFloat(cmds[++i])), y1 = TY(parseFloat(cmds[++i])),
        x2 = TX(parseFloat(cmds[++i])), y2 = TY(parseFloat(cmds[++i])),
        cx = TX(parseFloat(cmds[++i])), cy = TY(parseFloat(cmds[++i]));
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = weight;
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(cx, cy, x2, y2);
      ctx.stroke();
      last = { x: parseFloat(cmds[i - 1]), y: parseFloat(cmds[i]) };
    }
  }

  ctx.restore();
}
export default function MemberPopout() {
  let popupRef;

  const [position, setPosition] = createSignal({
    left: 0,
    top: 0
  });

  createEffect(() => {
    const current = popout();

    if (!current || !popupRef) return;

    queueMicrotask(() => {
      const width = popupRef.offsetWidth;
      const height = popupRef.offsetHeight;

      const padding = 12;
      const minRightGap = 250;

      let left = current.x + padding;

      const maxLeft =
        window.innerWidth -
        width -
        minRightGap;

      left = Math.min(left, maxLeft);
      left = Math.max(left, padding);

      let top = current.y - 20;

      top = Math.max(
        padding,
        Math.min(top, window.innerHeight - height - padding)
      );

      setPosition({
        left,
        top
      });
    });
  });

  const [profile, setProfile] = createSignal(null);
  const [loading, setLoading] = createSignal(false);
  const [showAllRoles, setShowAllRoles] = createSignal(false);

  createEffect(async () => {
    const current = popout();

    if (!current?.user?.username) {
      setProfile(null);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(
        `https://api.rotur.dev/profile?name=${current.user.username}&include_posts=0`
      );

      const data = await res.json();
      setProfile(data);
    } finally {
      setLoading(false);
    }
  });

  createEffect(() => {
    const current = popout();
    loading();
    profile();

    if (!current || !popupRef) return;

    queueMicrotask(() => {
      const width = popupRef.offsetWidth;
      const height = popupRef.offsetHeight;

      const padding = 12;
      const minRightGap = 250;

      let left = current.x + padding;

      const maxLeft = window.innerWidth - width - minRightGap;
      left = Math.min(left, maxLeft);
      left = Math.max(left, padding);

      let top = current.y - 20;
      top = Math.max(
        padding,
        Math.min(top, window.innerHeight - height - padding)
      );

      setPosition({ left, top });
    });
  });

  const handlePointerDown = (e) => {
    if (!popout()) return;

    if (popupRef?.contains(e.target)) return;

    if (e.target.closest(".member_item")) return;

    closePopout();
  };

  onMount(() => {
    document.addEventListener("mousedown", handlePointerDown);
  });

  onCleanup(() => {
    document.removeEventListener("mousedown", handlePointerDown);
  });


  return (
    <Show when={popout()}>
      {(data) => {
        console.log("popout roles", data().user.roles);
        return (
          <div
            ref={popupRef}
            class="member_popout y"
            style={{
              position: "fixed",
              left: `${position().left}px`,
              top: `${position().top}px`,
              "--accent": profile()?.theme?.accent,
              "--background": profile()?.theme?.background,
              "--primary": profile()?.theme?.primary,
              "--secondary": profile()?.theme?.secondary,
              "--tertiary": profile()?.theme?.tertiary,
              "--text": profile()?.theme?.text
            }}
          >
            <Show when={loading()}>
              <div class="popup_loader">
                <div class="spinner" />
              </div>
            </Show>

            <div classList={{ "popup_content": true, loading: loading() }}>
              <img
                src={`https://avatars.rotur.dev/.banners/${data().user.username}`}
                alt=""
                class="banner"
              />
              <Show when={data()?.status?.()?.status}>
                <div className="status">
                  <div className="status_text">
                    {data().status().status}
                  </div>
                </div>
              </Show>

              <div class="popupMemberHeader x">
                <div class="pfpWO">
                  <img
                    src={`https://avatars.rotur.dev/${data().user.username}`}
                    alt=""
                    class="pfp"
                  />

                  <img
                    src={`https://avatars.rotur.dev/.overlay/${data().user.username}`}
                    alt=""
                    class="overlay"
                  />
                </div>

                <div class="data y" style={{ "margin-top": ".5em" }}>
                  <div class="x" style={{
                    "font-size": "1.5em",
                    "flex-wrap": "wrap",
                    "align-items": "center",
                    "overflow-wrap": "anywhere"
                  }}>
                    <span style={{ "margin-right": ".3em" }}>{profile()?.username}</span>
                    <small style={{ "font-size": "14px" }}>
                      {profile()?.pronouns}
                    </small>
                  </div>

                  <div class="data_buttons x">
                    {profile()?.group_tag ? (<button onClick={() => { window.open(`https://rotur.dev/groups/${profile()?.group_tag}`) }}>
                      <img
                        src={`https://api.rotur.dev/groups/${profile()?.group_tag}/icon.jpg`}
                        alt=""
                        class="grptgic"
                      />
                      {profile()?.group_tag}
                    </button>) : ""}
                    <button>
                      {profile()?.system}
                    </button>
                  </div>
                </div>
              </div>
              <div style={{ "margin": ".3em", "gap": ".3em" }} className="y">
                <Show when={profile()?.badges?.length}>
                  <div class="badges">
                    {profile().badges.map((badge) => {
                      let canvas;

                      onMount(() => {
                        if (canvas) renderICN(badge.icon, canvas);
                      });

                      return (
                        <canvas
                          ref={canvas}
                          width="24"
                          height="24"
                          title={badge.description}
                        />
                      );
                    })}
                  </div>
                </Show>
                <Show when={profile()}>
                  {(p) => (
                    <>
                      <div>
                        <div
                          style={{
                            "white-space": "pre-wrap",
                            "max-height": "200px",
                            overflow: "hidden"
                          }}
                        >
                          {p().bio}
                        </div>
                      </div>
                      <Show when={data().user.roles?.length}>
                        <div class="roles_section">
                          <div class="roles_title">Roles</div>

                          <div class="roles_list">
                            {(showAllRoles()
                              ? data().user.roles
                              : data().user.roles.slice(0, 5)
                            ).map((role) => (
                              <div class="role_chip">
                                <span
                                  class="role_dot"
                                  style={{
                                    background:
                                      tempState.roles()?.[role]?.color || "#888"
                                  }}
                                />
                                {role}
                              </div>
                            ))}
                          </div>

                          <Show when={data().user.roles.length > 5}>
                            <button
                              class="roles_toggle"
                              onClick={() => setShowAllRoles(v => !v)}
                            >
                              {showAllRoles()
                                ? "Show less"
                                : `+${data().user.roles.length - 5} more`}
                            </button>
                          </Show>
                        </div>
                      </Show>
                      <div className="boxes x">
                        <div className="box">
                          {p().currency}
                          <small>Credits</small>
                        </div>

                        <div className="box">
                          #{p().index}
                          <small>User</small>
                        </div>
                      </div>
                    </>
                  )}
                </Show></div>
              <input type="text" placeholder="Send a DM..." className="dmInput" />
            </div>
          </div>
        );
      }}
    </Show>
  );

}