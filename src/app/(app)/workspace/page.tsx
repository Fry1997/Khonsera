import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";

// Workspace / admin (handover §15). Built early because multi-tenancy is
// foundational. Placeholder for the teams machinery (approvals, allowance/
// per-diem, policy). Work-mode only — a visible restatement of the §2 privacy
// boundary: personal travel is never surfaced to a workspace.

const ROLE_LABEL: Record<string, string> = {
  owner: "Company admin",
  company_admin: "Company admin",
  admin: "Team manager",
  team_manager: "Team manager",
  member: "Traveller",
  viewer: "Traveller",
  traveller: "Traveller",
};

export default async function WorkspacePage() {
  const ctx = await requireUserContext();
  const supabase = await createClient();

  if (ctx.activeMode === "personal") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <header>
          <span className="eyebrow" style={{ color: "var(--gold-2)" }}>
            Personal
          </span>
          <h1 className="h1" style={{ marginTop: 6 }}>
            Workspace
          </h1>
        </header>
        <div className="j-card p-6">
          <p className="text-ink">You&apos;re in personal mode.</p>
          <p className="small" style={{ marginTop: 8, maxWidth: "52ch" }}>
            Workspaces are a work-mode thing. Your personal travel is yours alone —
            never visible to any company, manager, or admin. Switch to work mode to
            see your workspace.
          </p>
        </div>
      </div>
    );
  }

  const [{ data: workspace }, { data: membership }, { count: memberCount }] =
    await Promise.all([
      supabase.from("workspaces").select("name, type").eq("id", ctx.workspaceId).maybeSingle(),
      supabase
        .from("memberships")
        .select("role")
        .eq("workspace_id", ctx.workspaceId)
        .eq("user_id", ctx.userId)
        .maybeSingle(),
      supabase
        .from("memberships")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", ctx.workspaceId)
        .eq("status", "active"),
    ]);

  const roleLabel = ROLE_LABEL[membership?.role ?? "traveller"] ?? "Traveller";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      <header>
        <span className="eyebrow" style={{ color: "var(--gold-2)" }}>
          Work · Workspace
        </span>
        <h1 className="h1" style={{ marginTop: 6 }}>
          {workspace?.name ?? "Your workspace"}
        </h1>
        <p className="small" style={{ marginTop: 8 }}>
          You&apos;re a <span className="text-ink">{roleLabel}</span> ·{" "}
          {memberCount ?? 1} {memberCount === 1 ? "member" : "members"}
        </p>
      </header>

      <section style={{ display: "grid", gap: "var(--space-3)" }}>
        <StubSection
          title="Approvals"
          body="Bookings route to an approver before they're confirmed. Booker initiates, approver approves or rejects — built against the booking stub now, wired to real providers later."
        />
        <StubSection
          title="Allowance & per-diem"
          body="A daily allowance tracker: receipts auto-submit, expenses deduct, the balance counts down. The per-diem view lands with the teams ledger."
        />
        <StubSection
          title="Travel policy"
          body="Fare caps, approved providers, cost centres. Khonsera keeps everyone inside policy without anyone having to read it."
        />
      </section>
    </div>
  );
}

function StubSection({ title, body }: { title: string; body: string }) {
  return (
    <div className="j-card-soft p-5">
      <header className="mb-1 flex items-center justify-between gap-3">
        <span className="uc">{title}</span>
        <span className="tag-tight">coming</span>
      </header>
      <p className="small" style={{ maxWidth: "60ch" }}>{body}</p>
    </div>
  );
}
