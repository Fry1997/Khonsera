import Link from "next/link";
import { PageShell, ComingSoon } from "@/components/ui/page-shell";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { TravelProfileForm } from "./travel-profile-form";
import { CalendarSection } from "./calendar-section";
import { GmailSection } from "./gmail-section";
import { ThemePicker } from "@/components/theme-picker";
import { DemoModeIndicator } from "@/components/demo-mode-indicator";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; connected?: string }>;
}) {
  const ctx = await requireUserContext();
  const sp = await searchParams;
  const supabase = await createClient();

  const [
    { data: profile },
    { data: locations },
    { data: calendarConn },
    { data: gmailConn },
  ] = await Promise.all([
    supabase
      .from("travel_profiles")
      .select(
        "default_drive_origin_location_id, default_rail_origin_location_id, default_return_location_id, default_rail_origin_transport_hub_id, default_flight_origin_transport_hub_id, preferred_mode, default_arrival_buffer_minutes, default_return_buffer_minutes, mileage_rate, walking_threshold_minutes, minimum_buffer_minutes, max_taxi_fare_pence, luggage_default",
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
    supabase
      .from("calendar_connections")
      .select("id, provider_account_email")
      .eq("user_id", ctx.userId)
      .eq("workspace_id", ctx.workspaceId)
      .eq("provider", "google")
      .eq("status", "active")
      .maybeSingle(),
    supabase
      .from("gmail_connections")
      .select("id, provider_account_email, last_scan_at")
      .eq("user_id", ctx.userId)
      .eq("workspace_id", ctx.workspaceId)
      .eq("status", "active")
      .maybeSingle(),
  ]);

  // Resolve the two hub defaults to their friendly labels so the
  // picker shows "Wellingborough (WLB)" on first paint rather than
  // a raw uuid. Two extra small queries — fine here, this page only
  // renders on demand.
  const hubIds = [
    profile?.default_rail_origin_transport_hub_id,
    profile?.default_flight_origin_transport_hub_id,
  ].filter(Boolean) as string[];
  const { data: hubRows } =
    hubIds.length > 0
      ? await supabase
          .from("transport_hubs")
          .select("id, name, code")
          .in("id", hubIds)
      : { data: [] as Array<{ id: string; name: string; code: string | null }> };
  const labelFor = (id: string | null | undefined) => {
    if (!id) return null;
    const h = hubRows?.find((r) => r.id === id);
    if (!h) return null;
    return { id: h.id, label: h.code ? `${h.name} (${h.code})` : h.name };
  };
  const defaultRailHub = labelFor(profile?.default_rail_origin_transport_hub_id);
  const defaultFlightHub = labelFor(
    profile?.default_flight_origin_transport_hub_id,
  );

  return (
    <PageShell
      title="Settings"
      description="Your defaults — used when generating travel options."
    >
      {sp.error ? (
        <div className="rounded-md border border-rust-2 bg-rust-2/40 px-3 py-2 text-sm text-rust">
          {sp.error}
        </div>
      ) : null}
      {sp.connected === "google" ? (
        <div className="rounded-md border border-sage-2 bg-sage-2 px-3 py-2 text-sm text-sage">
          Google Calendar connected.
        </div>
      ) : null}
      {sp.connected === "gmail" ? (
        <div className="rounded-md border border-sage-2 bg-sage-2 px-3 py-2 text-sm text-sage">
          Gmail connected. You can now scan for booking emails.
        </div>
      ) : null}

      <section className="grid gap-5 md:grid-cols-2">
        <div className="j-card p-5">
          <h2 className="h3 mb-2">Account</h2>
          <p className="small">{ctx.email}</p>
          {ctx.isAdmin ? (
            <p className="mt-1 text-xs text-terra">Admin account</p>
          ) : ctx.isStaff ? (
            <p className="mt-1 text-xs text-terra">Staff account</p>
          ) : null}
          {ctx.isStaff ? (
            <div className="mt-3">
              <p className="small mb-2">
                Demo mode swaps integration stubs for realistic mock data and shows a sample day-of
                preview on Today (with a time-travel scrubber).
              </p>
              <DemoModeIndicator />
            </div>
          ) : null}
        </div>

        <CalendarSection
          connection={
            calendarConn
              ? {
                  id: calendarConn.id,
                  provider_account_email: calendarConn.provider_account_email,
                }
              : null
          }
        />

        <GmailSection
          connection={
            gmailConn
              ? {
                  id: gmailConn.id,
                  provider_account_email: gmailConn.provider_account_email,
                  last_scan_at: gmailConn.last_scan_at,
                }
              : null
          }
        />

        <div className="j-card p-5 md:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="h3">Travel preferences</h2>
            <Link href="/locations" className="small underline">
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
              default_rail_origin_transport_hub_id:
                profile?.default_rail_origin_transport_hub_id ?? null,
              default_flight_origin_transport_hub_id:
                profile?.default_flight_origin_transport_hub_id ?? null,
              preferred_mode: (profile?.preferred_mode ?? "no_preference") as
                | "walk"
                | "drive"
                | "taxi"
                | "no_preference"
                | "rail"
                | "drive"
                | "compare"
                | "mixed",
              default_arrival_buffer_minutes:
                profile?.default_arrival_buffer_minutes ?? 15,
              default_return_buffer_minutes:
                profile?.default_return_buffer_minutes ?? 15,
              mileage_rate: Number(profile?.mileage_rate ?? 0.45),
              walking_threshold_minutes:
                profile?.walking_threshold_minutes ?? 15,
              max_taxi_fare_pence: profile?.max_taxi_fare_pence ?? 1500,
              luggage_default: (profile?.luggage_default ?? "none") as
                | "none"
                | "light"
                | "heavy",
            }}
            locations={locations ?? []}
            defaultRailHub={defaultRailHub}
            defaultFlightHub={defaultFlightHub}
          />
        </div>
      </section>

      {ctx.isStaff ? (
        <section className="j-card p-5">
          <div className="mb-1 flex items-baseline justify-between gap-3 flex-wrap">
            <h2 className="h3">Palette</h2>
            {/* TODO(brand): remove the staff guard once the alternate
                palettes are signed off for all users. */}
            <span className="tiny" style={{ color: "var(--gold-2)" }}>
              Visible to staff only · TODO open to all users
            </span>
          </div>
          <p className="small mb-4" style={{ color: "var(--ink-dim)" }}>
            The three sanctioned Khonsera palettes from the brand book.
            Selection persists in this browser; the rest of the workspace
            isn&rsquo;t affected.
          </p>
          <ThemePicker />
        </section>
      ) : null}

      {ctx.isAdmin ? (
        <section className="j-card p-5">
          <h2 className="h3">Admin tools</h2>
          <p className="small mt-1 mb-3">
            System-level tools. Only visible to admins.
          </p>
          <a href="/settings/rail-network" className="btn btn-ghost">
            Rail network seed
          </a>
        </section>
      ) : null}

      <ComingSoon
        feature="Notifications · working hours · Outlook calendar"
        detail="Lands in later layers."
      />
    </PageShell>
  );
}
