import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { getWorkspaceConfig } from "@/lib/flags/workspace-flags";
import { NewItineraryBrief } from "./new-itinerary-form";

export default async function NewItineraryPage() {
  const ctx = await requireUserContext();
  const supabase = await createClient();
  const wsCfg = await getWorkspaceConfig(ctx.workspaceId);

  const [{ data: customers }, { data: customerSites }, { data: locations }] =
    await Promise.all([
      supabase
        .from("customers")
        .select("id, name")
        .eq("workspace_id", ctx.workspaceId)
        .order("name"),
      supabase
        .from("customer_sites")
        .select("id, customer_id, name, address")
        .eq("workspace_id", ctx.workspaceId),
      supabase
        .from("locations")
        .select("id, name, type, address")
        .eq("workspace_id", ctx.workspaceId)
        .order("type")
        .order("name"),
    ]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <header>
        <span className="eyebrow" style={{ color: "var(--gold-2)" }}>
          New · Brief
        </span>
        <h1
          className="desk-h1"
          style={{ marginTop: 6, fontSize: "clamp(28px, 4vw, 42px)" }}
        >
          Anchor your <em>day.</em>
        </h1>
        <p
          className="serif-i"
          style={{
            fontSize: 16,
            color: "var(--ink-dim)",
            margin: "8px 0 0",
            maxWidth: "62ch",
            lineHeight: 1.55,
          }}
        >
          The first thing Khonsera needs is the appointment that fixes
          everything else. <em>Where</em>, <em>when</em>, and what for. Then
          we&rsquo;ll build the rest backwards from it.
        </p>
      </header>

      <NewItineraryBrief
        customers={customers ?? []}
        customerSites={customerSites ?? []}
        locations={locations ?? []}
        timezone={wsCfg.timezone}
      />
    </div>
  );
}
