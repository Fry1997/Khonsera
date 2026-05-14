import Link from "next/link";
import { PageShell } from "@/components/ui/page-shell";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";

export default async function VisitsPage() {
  const ctx = await requireUserContext();
  const supabase = await createClient();
  const { data: visits } = await supabase
    .from("visit_plans")
    .select("id, title, status, proposed_start_time")
    .eq("workspace_id", ctx.workspaceId)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <PageShell
      title="Visits"
      description="All visit plans — drafts, proposed, confirmed and completed."
      actions={
        <Link
          href="/visits/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Plan new visit
        </Link>
      }
    >
      {visits && visits.length > 0 ? (
        <ul className="divide-y divide-border rounded-md border border-border">
          {visits.map((v) => (
            <li key={v.id} className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm font-medium">
                  {v.title ?? "Untitled visit"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {v.status}
                  {v.proposed_start_time
                    ? ` · ${new Date(v.proposed_start_time).toLocaleString()}`
                    : ""}
                </p>
              </div>
              <Link
                href={`/visits/${v.id}`}
                className="text-sm font-medium underline"
              >
                Open
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No visits yet.{" "}
          <Link href="/visits/new" className="underline">
            Plan your first visit
          </Link>
          .
        </div>
      )}
    </PageShell>
  );
}
