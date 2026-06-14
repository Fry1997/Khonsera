"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setReadinessStatus } from "@/lib/actions/readiness";
import { createTask } from "@/lib/actions/tasks";
import { CATEGORY_LABELS, type ReadinessItem, type ReadinessCategory } from "@/lib/readiness/types";

// The "have you got everything?" surface (Phase 4). Calm by default: when nothing
// is open it reads "You're set". Each gap is actionable — link out, drop a
// reminder (task), or book (mocked until L5) — then tick or dismiss.
export function ReadinessPanel({ itineraryId, items }: { itineraryId: string; items: ReadinessItem[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [open, setOpen] = useState(true);

  const live = items.filter((i) => i.status === "open" || i.status === "snoozed");
  const doneCount = items.filter((i) => i.status === "done").length;

  async function set(key: string, status: ReadinessItem["status"]) {
    setPending(key);
    await setReadinessStatus(itineraryId, key, status);
    setPending(null);
    router.refresh();
  }

  async function remind(item: ReadinessItem) {
    const title = item.action.kind === "task" ? item.action.title : item.label;
    setPending(item.key);
    await createTask({ title });
    await setReadinessStatus(itineraryId, item.key, "done");
    setPending(null);
    router.refresh();
  }

  if (items.length === 0) return null;

  // Which finder tab a "book" gap deep-links to. Hotel gaps → stays, ticket gaps
  // → flights (rail booking is Assertis-pending). Parking books via its nudge, so
  // it keeps the reminder path (no finder).
  const bookFind = (key: string): "flight" | "stay" | null =>
    key.startsWith("hotel:") ? "stay" : key.startsWith("ticket:") ? "flight" : null;

  const byCat = new Map<ReadinessCategory, ReadinessItem[]>();
  for (const i of live) {
    const arr = byCat.get(i.category) ?? [];
    arr.push(i);
    byCat.set(i.category, arr);
  }

  return (
    <section className="cc-readiness" data-panel data-clear={live.length === 0 ? "true" : "false"}>
      <button type="button" className="cc-readiness-head" onClick={() => setOpen((v) => !v)}>
        <span className="cc-readiness-title">{live.length === 0 ? "Readiness" : "Getting ready"}</span>
        <span className="cc-readiness-meta">
          {live.length > 0 ? `${live.length} to sort` : doneCount > 0 ? `${doneCount} sorted` : ""}
        </span>
      </button>

      {open && live.length > 0 ? (
        <div className="cc-readiness-body">
          {[...byCat.entries()].map(([cat, list]) => (
            <div key={cat} className="cc-readiness-group">
              <div className="cc-readiness-cat">{CATEGORY_LABELS[cat]}</div>
              {list.map((i) => (
                <div key={i.key} className="cc-readiness-item" data-sev={i.severity}>
                  <span className="cc-readiness-dot" aria-hidden />
                  <div className="cc-readiness-text">
                    <span className="cc-readiness-label">{i.label}</span>
                    {i.detail ? <span className="cc-readiness-detail">{i.detail}</span> : null}
                  </div>
                  <div className="cc-readiness-actions">
                    {i.action.kind === "link" ? (
                      <a href={i.action.href} target="_blank" rel="noopener noreferrer">{i.action.label}</a>
                    ) : i.action.kind === "book" && bookFind(i.key) ? (
                      <>
                        <button type="button" onClick={() => router.push(`?find=${bookFind(i.key)}` as Parameters<typeof router.push>[0])}>Find &amp; book</button>
                        <button type="button" disabled={pending === i.key} onClick={() => remind(i)}>Remind me</button>
                      </>
                    ) : i.action.kind === "task" || i.action.kind === "book" ? (
                      <button type="button" disabled={pending === i.key} onClick={() => remind(i)}>
                        {i.action.kind === "book" ? "Add reminder" : "Remind me"}
                      </button>
                    ) : null}
                    <button type="button" disabled={pending === i.key} onClick={() => set(i.key, "done")}>Done</button>
                    <button type="button" disabled={pending === i.key} onClick={() => set(i.key, "dismissed")}>Dismiss</button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
