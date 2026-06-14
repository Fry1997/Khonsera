import { tflLineStatus } from "@/lib/integrations/tfl";

// London line status (Phase 8). Concierge restraint: lead with what's disrupted,
// withhold the rest. Markup carries Design's Edition III live contract (`.cc-tfl`
// + `-head/-eyebrow/-line/-dot/-name/-status/-reason/-rest/-allgood`,
// `.cc-tfl-line[data-state]`); the skin lives in khonsera-edition-iii-live.css.
export async function TflLineStatus() {
  const res = await tflLineStatus();
  const lines = res.mode === "unavailable" ? [] : res.data;
  if (lines.length === 0) return null;
  const disrupted = lines.filter((l) => l.state !== "good");
  const goodCount = lines.length - disrupted.length;

  return (
    <section className="cc-tfl" aria-label="London transit status">
      <div className="cc-tfl-head">
        <span className="cc-tfl-eyebrow">London transit</span>
        {res.mode === "demo" ? <span className="cc-tfl-sample">· sample</span> : null}
      </div>

      {disrupted.length === 0 ? (
        <p className="cc-tfl-allgood">All lines running well.</p>
      ) : (
        <>
          {disrupted.map((l) => (
            <div key={l.id} className="cc-tfl-line" data-state={l.state}>
              <span className="cc-tfl-dot" aria-hidden />
              <span className="cc-tfl-name">{l.name}</span>
              <span className="cc-tfl-status">{l.status}</span>
              {l.reason ? <span className="cc-tfl-reason">{l.reason}</span> : null}
            </div>
          ))}
          {goodCount > 0 ? <p className="cc-tfl-rest">Everything else is running well.</p> : null}
        </>
      )}
    </section>
  );
}
