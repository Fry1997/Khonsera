import Link from "next/link";
import type { Route } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { getWorkspaceConfig } from "@/lib/flags/workspace-flags";
import { formatDateInTz } from "@/lib/types/time";
import { WeekCalendar } from "@/components/week-calendar";
import {
  FlankEyebrow,
  Masthead,
  Stat,
  StatGroup,
} from "@/components/ui/editorial";
import type { ItineraryStatus } from "@/lib/types/domain";

const STATUS_LABEL: Record<ItineraryStatus, string> = {
  draft: "Draft",
  planning: "Planning",
  planned: "Planned",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default async function DashboardPage() {
  const ctx = await requireUserContext();
  const supabase = await createClient();
  const wsCfg = await getWorkspaceConfig(ctx.workspaceId);

  const today = new Date().toISOString().slice(0, 10);

  const [
    { data: calendarConn },
    { data: nextItinerary },
    { count: draftCount },
    { count: plannedCount },
    { count: inProgressCount },
    { data: recent },
  ] = await Promise.all([
    supabase
      .from("calendar_connections")
      .select("provider_account_email")
      .eq("user_id", ctx.userId)
      .eq("workspace_id", ctx.workspaceId)
      .eq("provider", "google")
      .eq("status", "active")
      .maybeSingle(),
    supabase
      .from("itineraries")
      .select("id, title, status, date_start, date_end")
      .eq("workspace_id", ctx.workspaceId)
      .in("status", ["planned", "in_progress"])
      .gte("date_end", today)
      .order("date_start")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("itineraries")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", ctx.workspaceId)
      .in("status", ["draft", "planning"]),
    supabase
      .from("itineraries")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", ctx.workspaceId)
      .eq("status", "planned"),
    supabase
      .from("itineraries")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", ctx.workspaceId)
      .eq("status", "in_progress"),
    supabase
      .from("itineraries")
      .select("id, title, status, date_start, date_end")
      .eq("workspace_id", ctx.workspaceId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const totalActive = (draftCount ?? 0) + (plannedCount ?? 0) + (inProgressCount ?? 0);

  return (
    <div className="flex flex-col gap-10 px-4 py-6 sm:px-6 sm:py-9 md:px-10 md:py-12">
      {nextItinerary ? (
        <NextItineraryHero
          title={
            nextItinerary.title ??
            formatDateInTz(new Date(nextItinerary.date_start), wsCfg.timezone)
          }
          startDate={nextItinerary.date_start}
          endDate={nextItinerary.date_end}
          status={nextItinerary.status as ItineraryStatus}
          timezone={wsCfg.timezone}
          id={nextItinerary.id}
        />
      ) : (
        <NoNext />
      )}

      <WeekCalendar timezone={wsCfg.timezone} />

      <section className="flex flex-col gap-4">
        <FlankEyebrow align="left">
          On the books · {totalActive} active
        </FlankEyebrow>
        <StatGroup up={3} className="px-1">
          <Link href={"/itineraries" as Route} className="group">
            <Stat
              value={draftCount ?? 0}
              label="In planning · drafts assembling"
            />
            <span className="mt-1 block text-[11px] text-ink-faint group-hover:text-terra">
              View →
            </span>
          </Link>
          <Link href={"/itineraries" as Route} className="group">
            <Stat
              value={plannedCount ?? 0}
              label="Planned · ready to go"
            />
            <span className="mt-1 block text-[11px] text-ink-faint group-hover:text-terra">
              View →
            </span>
          </Link>
          <Link href={"/itineraries" as Route} className="group">
            <Stat
              value={inProgressCount ?? 0}
              label="In progress · happening now"
            />
            <span className="mt-1 block text-[11px] text-ink-faint group-hover:text-terra">
              View →
            </span>
          </Link>
        </StatGroup>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="j-card p-5">
          <h2 className="h3 mb-3">Calendar</h2>
          {calendarConn ? (
            <>
              <p className="small">
                <span className="mono text-ink-2">
                  {calendarConn.provider_account_email ?? "Google account"}
                </span>{" "}
                connected.
              </p>
              <p className="small mt-1">
                Free/busy + event creation use this account. Manage at{" "}
                <Link href="/settings" className="underline">
                  Settings
                </Link>
                .
              </p>
            </>
          ) : (
            <>
              <p className="small">
                Not connected. Connect to check calendar conflicts and create
                stop + travel blocks automatically.
              </p>
              <div className="mt-3">
                <Link href="/settings" className="btn-ghost">
                  Connect in Settings
                </Link>
              </div>
            </>
          )}
        </div>

        <div className="j-card p-5">
          <h2 className="h3 mb-3">Recent itineraries</h2>
          {recent && recent.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {recent.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between text-sm"
                >
                  <Link
                    href={`/itineraries/${r.id}`}
                    className="truncate hover:underline"
                  >
                    {r.title ??
                      formatDateInTz(new Date(r.date_start), wsCfg.timezone)}
                    <span className="ml-2 text-xs text-ink-dim">
                      {formatDateInTz(new Date(r.date_start), wsCfg.timezone)}
                    </span>
                  </Link>
                  <span className="chip">
                    {STATUS_LABEL[r.status as ItineraryStatus]}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="small">
              No itineraries yet. Start your first one above.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

// Splits a "Visit to Pride Park" / "On site at Pride Park" title into a
// neutral prefix + a terra-italic destination fragment, falling back to the
// whole title if no obvious split point exists. Mirrors the deck masthead
// treatment ("On site at *Pride Park.*").
function splitTitleForMasthead(title: string): { head: string; em: string | null } {
  // Prefer the last connective preposition so the destination becomes the em.
  const connectives = [" to ", " at ", " in ", " — ", " – ", ": "];
  for (const c of connectives) {
    const idx = title.lastIndexOf(c);
    if (idx > 0 && idx + c.length < title.length) {
      return {
        head: title.slice(0, idx + c.length).trim(),
        em: title.slice(idx + c.length).trim(),
      };
    }
  }
  // Otherwise — em the last word so something carries colour.
  const words = title.trim().split(/\s+/);
  if (words.length >= 2) {
    return { head: words.slice(0, -1).join(" "), em: words.at(-1) ?? null };
  }
  return { head: title, em: null };
}

function NextItineraryHero({
  title,
  startDate,
  endDate,
  status,
  timezone,
  id,
}: {
  title: string;
  startDate: string;
  endDate: string;
  status: ItineraryStatus;
  timezone: string;
  id: string;
}) {
  const { head, em } = splitTitleForMasthead(title);
  const startLabel = formatDateInTz(new Date(startDate), timezone);
  const dateLine =
    endDate !== startDate
      ? `${startLabel} → ${formatDateInTz(new Date(endDate), timezone)}`
      : startLabel;

  return (
    <Masthead
      eyebrow={`Next up · ${dateLine} · ${STATUS_LABEL[status]}`}
      chapter="01"
      title={head}
      em={em}
      standfirst="Your nearest planned day, anchored on the destination Khonsera thinks matters most."
      actions={
        <>
          <Link href={`/itineraries/${id}`} className="btn-gold">
            Open itinerary
          </Link>
          <Link href={"/itineraries/new" as Route} className="btn-ghost">
            + New
          </Link>
        </>
      }
    />
  );
}

function NoNext() {
  return (
    <Masthead
      eyebrow="Next up · nothing on the books"
      chapter="01"
      title="Plan the next"
      em="trip."
      standfirst="No itinerary is queued. Start one to see your day land here — anchored to the appointment, with travel built backwards from it."
      actions={
        <Link href={"/itineraries/new" as Route} className="btn-terra">
          + New itinerary
        </Link>
      }
    />
  );
}
