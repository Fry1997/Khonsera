// Today disruption banner (Phase 10). When a live break is on today's plan, Today
// adopts its disruption character — this banner leads and the rest recedes (the
// skin fades siblings via `.cc-screen[data-disrupted]`). Driven by Darwin
// server-side, dormant without the key (no false alarms). Markup carries Design's
// live contract; the actions (re-plan) arrive with P11 recovery.
export type TodayDisruptionItem = { title: string; text: string; severe: boolean };

export function TodayDisruption({ items }: { items: TodayDisruptionItem[] }) {
  if (items.length === 0) return null;
  const severe = items.some((i) => i.severe);
  return (
    <section className="cc-today-disruption" data-severe={severe ? "true" : undefined}>
      <span className="cc-today-disruption-eyebrow">{severe ? "Disruption" : "Running late"}</span>
      <h2 className="cc-today-disruption-title">{items[0].title}</h2>
      {items.map((i, idx) => (
        <div key={idx} className="cc-today-disruption-item">
          <span className="what">{i.text}</span>
        </div>
      ))}
    </section>
  );
}
