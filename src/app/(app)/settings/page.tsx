import Link from "next/link";
import { PageShell, ComingSoon } from "@/components/ui/page-shell";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { TravelProfileForm } from "./travel-profile-form";

export default async function SettingsPage() {
  const ctx = await requireUserContext();
  const supabase = await createClient();

  const [{ data: profile }, { data: locations }] = await Promise.all([
    supabase
      .from("travel_profiles")
      .select(
        "default_drive_origin_location_id, default_rail_origin_location_id, default_return_location_id, preferred_mode, default_arrival_buffer_minutes, default_return_buffer_minutes, mileage_rate",
      )
      .eq("user_id", ctx.userId)
      .eq("workspace_id", ctx.workspaceId)
      .maybeSingle(),
    supabase
      .from("locations")
      .select("id, name, type")
      .eq("workspace_id", ctx.workspaceId)
      .order("type")
      .order("name"),
  ]);

  return (
    <PageShell
      title="Settings"
      description="Your defaults — used when generating travel options."
    >
      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-md border border-border p-4 text-sm">
          <h2 className="mb-2 font-semibold">Account</h2>
          <p className="text-muted-foreground">{ctx.email}</p>
          {ctx.isStaff ? (
            <p className="mt-1 text-xs text-amber-700">Staff account · demo mode available</p>
          ) : null}
        </div>

        <div className="rounded-md border border-border p-4 text-sm md:row-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Travel preferences</h2>
            <Link
              href="/locations"
              className="text-xs underline text-muted-foreground"
            >
              Manage locations
            </Link>
          </div>
          <TravelProfileForm
            initial={{
              default_drive_origin_location_id:
                profile?.default_drive_origin_location_id ?? null,
              default_rail_origin_location_id:
                profile?.default_rail_origin_location_id ?? null,
              default_return_location_id: profile?.default_return_location_id ?? null,
              preferred_mode: (profile?.preferred_mode ?? "compare") as
                | "rail"
                | "drive"
                | "compare"
                | "mixed",
              default_arrival_buffer_minutes:
                profile?.default_arrival_buffer_minutes ?? 15,
              default_return_buffer_minutes:
                profile?.default_return_buffer_minutes ?? 15,
              mileage_rate: Number(profile?.mileage_rate ?? 0.45),
            }}
            locations={locations ?? []}
          />
        </div>
      </section>

      <ComingSoon
        feature="Calendar connection · notifications · working hours"
        detail="Lands alongside the relevant integrations (Layer 10)."
      />
    </PageShell>
  );
}
