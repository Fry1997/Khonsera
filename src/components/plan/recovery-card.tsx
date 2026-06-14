import type { RecoveryOption } from "@/lib/recovery/engine";

// Recovery / the way out (Phase 11). When a booked train is cancelled or badly
// delayed, this is the consequence band: each viable alternative + its honest
// impact on your day. Until the protect-target is set we show the TRADE-OFF
// (soonest-first), never a silent ranking.
//
// Round 8 skin (`khonsera-edition-iii-care.css`) owns the look via the `.cc-recovery`
// contract classes + `data-makes`/`data-return` — no inline styles here (inline
// overrides the stylesheet). data-attrs are the only Design hooks.
export function RecoveryCard({ options, sample }: { options: RecoveryOption[]; sample: boolean }) {
  if (!options.length) return null;
  return (
    <div className="cc-recovery">
      <div className="cc-recovery-head">
        <span className="cc-recovery-eyebrow">The way out</span>
        {sample ? <span className="cc-recovery-sample">· sample</span> : null}
      </div>
      <p className="cc-recovery-note">the trade-off — choose your priority</p>
      <ul className="cc-recovery-list">
        {options.map((o) => (
          <li key={o.id} className="cc-recovery-opt" data-makes={o.makesIt ? "true" : "false"} data-return={o.returnNote ? "at-risk" : undefined}>
            <span className="cc-recovery-label">{o.label}</span>
            <span className="cc-recovery-conseq">{o.consequence}</span>
            {o.returnNote ? <span className="cc-recovery-return">{renderReturnNote(o.returnNote)}</span> : null}
            {o.note ? <span className="cc-recovery-via">{o.note}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

// The return-pairing line emphasises its cost clause (the part after the em-dash,
// e.g. "the trip's lost") so the skin can rust it — the only salt in the sentence.
function renderReturnNote(note: string) {
  const [lead, cost] = note.split(" — ");
  if (!cost) return note;
  return (
    <>
      {lead} — <strong>{cost}</strong>
    </>
  );
}
