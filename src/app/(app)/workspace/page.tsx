import Link from "next/link";
import type { Route } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext, isManager } from "@/lib/auth";
import { loadApprovalsQueue } from "@/lib/actions/approvals";
import { ApprovalsQueue } from "@/components/workspace/approvals-queue";
import { loadExpenseCaps } from "@/lib/actions/budget";
import { TravelPolicy } from "@/components/workspace/travel-policy";

// Workspace / admin (handover §15) — Design Round 2. Work-mode only; in Personal
// mode it's the .cc-boundary privacy note (the §2 boundary made visible).

const ROLE_LABEL: Record<string, string> = {
  owner: "Company admin", company_admin: "Company admin",
  admin: "Team manager", team_manager: "Team manager",
  member: "Traveller", viewer: "Traveller", traveller: "Traveller",
};

export default async function WorkspacePage() {
  const ctx = await requireUserContext();
  const supabase = await createClient();

  if (ctx.activeMode === "personal") {
    return (
      <div className="cc-screen">
        <header>
          <span className="cc-eyebrow">Workspace</span>
          <h1 className="cc-screen-title" style={{ marginTop: 6 }}>No work team yet</h1>
        </header>
        <div className="cc-boundary">
          <p className="t" style={{ fontSize: 16, color: "var(--ink)" }}>You&apos;re not part of a work team.</p>
          <p className="cc-empty-sub" style={{ margin: "8px 0 16px", maxWidth: "44ch" }}>
            When you join or create one, your work travel appears here. Your personal travel is yours
            alone — never visible to any company, manager, or admin.
          </p>
          <Link href={"/today" as Route} className="cc-btn cc-btn-ghost">Back to today</Link>
        </div>
      </div>
    );
  }

  const [{ data: workspace }, { data: membership }, { count: memberCount }] = await Promise.all([
    supabase.from("workspaces").select("name, type").eq("id", ctx.workspaceId).maybeSingle(),
    supabase.from("memberships").select("role").eq("workspace_id", ctx.workspaceId).eq("user_id", ctx.userId).maybeSingle(),
    supabase.from("memberships").select("id", { count: "exact", head: true }).eq("workspace_id", ctx.workspaceId).eq("status", "active"),
  ]);

  const roleLabel = ROLE_LABEL[membership?.role ?? "traveller"] ?? "Traveller";
  const manager = isManager(ctx);
  const approvals = manager ? await loadApprovalsQueue() : [];
  const policyCaps = manager ? await loadExpenseCaps() : [];
  const stubs = [
    { t: "Allowance & per-diem", b: "A daily allowance tracker: receipts auto-submit, expenses deduct, the balance counts down." },
    { t: "Approved providers & cost centres", b: "Approved suppliers and cost-centre tagging — kept without anyone having to read them." },
  ];

  return (
    <div className="cc-screen">
      <header>
        <span className="cc-eyebrow">Work · Workspace</span>
        <h1 className="cc-screen-title" style={{ marginTop: 6 }}>{workspace?.name ?? "Your workspace"}</h1>
      </header>

      <div className="cc-settings-group">
        <div className="cc-settings-row"><span className="l">Your role</span><span className="v">{roleLabel}</span></div>
        <div className="cc-settings-row"><span className="l">Members</span><span className="v">{memberCount ?? 1}</span></div>
      </div>

      {manager ? <ApprovalsQueue items={approvals} /> : null}
      {manager ? <TravelPolicy caps={policyCaps} /> : null}

      <section className="cc-section">
        <div className="cc-section-head"><span className="cc-section-title">Coming with teams</span></div>
        {stubs.map((s) => (
          <div className="cc-list-row" key={s.t}>
            <div className="main">
              <span className="t">{s.t}</span>
              <span className="s">{s.b}</span>
            </div>
            <span className="r">soon</span>
          </div>
        ))}
      </section>
    </div>
  );
}
