import { createSignal } from "solid-js";
import { HiOutlineXMark } from "solid-icons/hi";
import { tempState } from "../../App";
import "./giftpopup.css"

export default function GiftPopup(props) {
  const [amount, setAmount] = createSignal(1);
  const [note, setNote] = createSignal("");
  const [expires, setExpires] = createSignal(48);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal("");

  async function createGift() {
    setLoading(true);
    setError("");

    try {
      const gift = await tempState.rotur.gifts.create(amount(), {
        note: note(),
        expiresInHrs: expires(),
      });

      props.onCreated(gift.claim_url);
      props.onClose();
    } catch (err) {
      setError(err?.message || "Failed to create gift.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div class="popup_backdrop">
      <div class="gift_popup">
        <div class="popup_header">
          <span>Create Gift</span>

          <button onClick={props.onClose}>
            <HiOutlineXMark />
          </button>
        </div>

        <label>
          Amount
          <input
            type="number"
            min="1"
            value={amount()}
            onInput={e => setAmount(Number(e.currentTarget.value))}
          />
        </label>

        <label>
          Note
          <textarea
            value={note()}
            onInput={e => setNote(e.currentTarget.value)}
          />
        </label>

        <label>
          Expires (hours)
          <input
            type="number"
            min="1"
            value={expires()}
            onInput={e => setExpires(Number(e.currentTarget.value))}
          />
        </label>

        {error() && (
          <div class="error">
            {error()}
          </div>
        )}

        <button
          disabled={loading()}
          onClick={createGift}
        >
          {loading() ? "Creating..." : "Create Gift"}
        </button>
      </div>
    </div>
  );
}