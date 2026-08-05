import { createResource, createSignal, Show } from "solid-js";
import { registerEmbedProvider } from "./registry.jsx";
import { HiOutlineGift, HiOutlineBolt } from "solid-icons/hi";
import "./embeds.css"

function parseBeamId(url) {
  const match = url.match(/beam\.rotur\.dev\/#beam=([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

function parseGiftCode(url) {
  let match = url.match(/rotur\.dev\/gift\?code=([a-zA-Z0-9]+)/);
  if (match) return match[1];

  match = url.match(/rotur\.dev\/gift\/([a-zA-Z0-9]+)/);
  if (match) return match[1];

  return null;
}

function BeamEmbed(props) {
  const beamId = parseBeamId(props.url);

  const [data] = createResource(beamId, async (id) => {
    try {
      const res = await fetch(`https://beam.rotur.dev/api/beam/${id}`);
      return await res.json();
    } catch {
      return null;
    }
  });

  return (
    <a
      href={props.url}
      target="_blank"
      rel="noopener noreferrer"
      class="embed_card beam_embed"
    >
      <div class="beam_embed_header x">
        <HiOutlineBolt/>
        <span>Beam</span>
      </div>

      <Show when={data()} fallback={<div class="beam_embed_id">Session {beamId}</div>}>
        {(d) => (
          <div class="beam_embed_body">
            <div class="beam_title">{d().title ?? "Untitled beam"}</div>
            {d().participants && (
              <div class="beam_participants">{d().participants} listening</div>
            )}
          </div>
        )}
      </Show>
    </a>
  );
}

function GiftEmbed(props) {
  const code = parseGiftCode(props.url);

  const [data, { refetch }] = createResource(code, async (c) => {
    try {
      const json = await tempState.rotur.gifts.get(c);
      return json.gift;
    } catch {
      return { error: "notfound" };
    }
  });

  const [claimError, setClaimError] = createSignal("");
  const [claiming, setClaiming] = createSignal(false);

  const handleClaim = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    setClaimError("");
    setClaiming(true);

    try {
      await tempState.rotur.gifts.claim(code);
      await refetch();
    } catch (err) {
      setClaimError(err?.message ?? String(err));
    } finally {
      setClaiming(false);
    }
  };
  return (
    <a
      href={props.url}
      target="_blank"
      rel="noopener noreferrer"
      class="embed_card gift_embed"
    >
      <div class="beam_embed_header x">
        <HiOutlineGift />
        <span>Gift</span>
      </div>

      <Show
        when={data()}
        fallback={
          <div class="beam_embed_id">
            Gift {code}
          </div>
        }
      >
        {(d) =>
          d().error ? (
            <div class="beam_embed_id">
              {d().error === "claimed"
                ? "This gift has already been claimed"
                : "Gift not found"}
            </div>
          ) : (
            <div class="beam_embed_body">
              <div class="gift_amount">{d().amount} RC</div>
              <div class="gift_by">from {d().creator_id}</div>
              {d().note && <div class="gift_note">"{d().note}"</div>}

              <button
                class="gift_claim_btn"
                onClick={handleClaim}
                disabled={claiming()}
              >
                {claiming() ? "Claiming..." : "Claim Gift"}
              </button>

              <Show when={claimError()}>
                <div class="gift_error" style={{"margin-top": ".5em"}}>{claimError()}</div>
              </Show>
            </div>
          )
        }
      </Show>
    </a>
  );
}

registerEmbedProvider({
  test: (url) => url.includes("beam.rotur.dev/#beam="),
  Component: BeamEmbed,
});
registerEmbedProvider({
  test: (url) => url.includes("rotur.dev/gift?code="),
  Component: GiftEmbed,
});
registerEmbedProvider({
  test: (url) => url.includes("rotur.dev/gift/"),
  Component: GiftEmbed,
});

export { BeamEmbed, GiftEmbed };
