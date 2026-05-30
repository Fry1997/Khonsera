import Link from "next/link";
import type { Route } from "next";
import { requireUserContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Minimal, functional list of saved (pending_review / corrected) capture drafts so
// "Save later" is resumable. No design polish — v1.
export default async function CaptureDraftsPage() {
  const ctx = await requireUserContext();
  const supabase = await createClient();

  const { data } = await supabase
    .from("captured_inputs")
    .select("id, original_text, status, created_at")
    .eq("workspace_id", ctx.workspaceId)
    .eq("user_id", ctx.userId)
    .in("status", ["pending_review", "corrected"])
    .order("created_at", { ascending: false })
    .limit(50);

  const drafts = data ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <header>
        <span className="eyebrow" style={{ color: "var(--gold-2)" }}>Tell Khonsera</span>
        <h1 style={{ fontFamily: "var(--display)", fontWeight: 500, fontSize: "clamp(24px,4vw,32px)", color: "var(--ink)" }}>
          Saved drafts
        </h1>
      </header>

      {drafts.length === 0 ? (
        <p className="serif-i" style={{ color: "var(--ink-dim)" }}>Nothing saved for later.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {drafts.map((d) => (
            <Link
              key={d.id}
              href={`/capture?draft=${d.id}` as Route}
              className="card"
              style={{ padding: "12px 16px", display: "block", color: "var(--ink)" }}
            >
              <div style={{ fontSize: 14 }}>{d.original_text}</div>
              <div className="uc" style={{ marginTop: 4 }}>{d.status}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
