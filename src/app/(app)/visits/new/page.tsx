import Link from "next/link";
import { PageShell, ComingSoon } from "@/components/ui/page-shell";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { getWorkspaceConfig } from "@/lib/flags/workspace-flags";
import { PlanVisitForm } from "./plan-visit-form";

export default async function NewVisitPage() {
  const ctx = await requireUserContext();
  const supabase = await createClient();

  const [{ data: customers }, { data: sites }, { data: locations }, { data: profile }] = await Promise.all([
    supabase
      .from("customers")
      .select("id, name")
      .eq("workspace_id", ctx.workspaceId)
      .order("name"),
    supabase
      .from("customer_sites")
      .select("id, customer_id, name, address")
      .eq("workspace_id", ctx.workspaceId)
      .order("name"),
    supabase
      .from("locations")
      .select("id, name, type")
      .eq("workspace_id", ctx.workspaceId)
      .order("type"),
    supabase
      .from("travel_profiles")
      .select(
        "default_drive_origin_location_id, default_rail_origin_location_id, default_return_location_id, preferred_mode, default_arrival_buffer_minutes, default_return_buffer_minutes",
      )
      .eq("user_id", ctx.userId)
      .eq("workspace_id", ctx.workspaceId)
      .maybeSingle(),
  ]);

  const wsCfg = await getWorkspaceConfig(ctx.workspaceId);

  const blockingReason: string | null =
    !customers || customers.length === 0
      ? "Add a customer first."
      : !locations || locations.length === 0
        ? "Add at least one location (home/office) first."
        : null;

  return (
    <PageShell
      title="Plan new visit"
      description="Enter the appointment, we'll check whether it's actually feasible."
    >
      {blockingReason ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm">
          <p className="font-medium">{blockingReason}</p>
          <p className="mt-1 text-muted-foreground">
            {!customers || customers.length === 0 ? (
              <Link href="/customers/new" className="underline">
                Add a customer
              </Link>
            ) : (
              <Link href="/locations" className="underline">
                Add locations
              </Link>
            )}
          </p>
        </div>
      ) : (
        <div className="max-w-2xl">
          <PlanVisitForm
            customers={customers ?? []}
            sites={sites ?? []}
            locations={locations ?? []}
            defaults={{
              startLocationId:
                profile?.default_drive_origin_location_id ??
                profile?.default_rail_origin_location_id ??
                null,
              returnLocationId: profile?.default_return_location_id ?? null,
              preferredMode:
                (profile?.preferred_mode as
                  | "rail"
                  | "drive"
                  | "compare"
                  | "mixed") ?? "compare",
              arrivalBuffer: profile?.default_arrival_buffer_minutes ?? 15,
              returnBuffer: profile?.default_return_buffer_minutes ?? 15,
            }}
            timezone={wsCfg.timezone}
          />
        </div>
      )}

      {ctx.isStaff ? null : (
        <ComingSoon
          feature="Real routing + rail data"
          detail="Demo mode (staff only) walks the full flow with realistic mock journeys. Real users will see live results once the routing + rail integrations land in Layer 10."
        />
      )}
    </PageShell>
  );
}
