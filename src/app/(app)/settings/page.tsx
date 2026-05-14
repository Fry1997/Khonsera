import { PageShell, ComingSoon } from "@/components/ui/page-shell";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";

export default async function SettingsPage() {
  const ctx = await requireUserContext();
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("travel_profiles")
    .select(
      "preferred_mode, default_arrival_buffer_minutes, default_return_buffer_minutes, mileage_rate",
    )
    .eq("user_id", ctx.userId)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();

  return (
    <PageShell
      title="Settings"
      description="Your defaults — locations, travel preferences, calendar and notifications."
    >
      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-md border border-border p-4 text-sm">
          <h2 className="font-semibold">Account</h2>
          <p className="mt-2 text-muted-foreground">{ctx.email}</p>
          {ctx.isStaff ? (
            <p className="mt-1 text-xs text-amber-700">Staff account · demo mode available</p>
          ) : null}
        </div>
        <div className="rounded-md border border-border p-4 text-sm">
          <h2 className="font-semibold">Travel preferences</h2>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            <li>Preferred mode: {profile?.preferred_mode ?? "compare"}</li>
            <li>
              Arrival buffer: {profile?.default_arrival_buffer_minutes ?? 15} min
            </li>
            <li>
              Return buffer: {profile?.default_return_buffer_minutes ?? 15} min
            </li>
            <li>Mileage rate: £{profile?.mileage_rate ?? "0.4500"}/mile</li>
          </ul>
        </div>
      </section>
      <ComingSoon
        feature="Calendar connection, notification preferences, working hours"
        detail="Hooks for Google Calendar (then Outlook), email/push notifications and quiet hours land alongside their integrations."
      />
    </PageShell>
  );
}
