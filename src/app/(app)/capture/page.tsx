import { requireUserContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceConfig } from "@/lib/flags/workspace-flags";
import { getDictionary } from "@/lib/dictionary/dictionary";
import type { SlotDef } from "@/lib/dictionary/types";
import type { ParsedPayload } from "@/lib/parser/types";
import { CaptureScreen } from "@/components/capture/capture-screen";

// Serialisable slot schemas per fact-type, built once from the dictionary.
function buildSlotSchemas(): Record<string, SlotDef[]> {
  const dict = getDictionary();
  const out: Record<string, SlotDef[]> = {};
  for (const [factType, schema] of dict.schemas) out[factType] = schema.slots;
  return out;
}

function normaliseDraftPayload(raw: unknown): ParsedPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (Array.isArray(o.facts)) return o as unknown as ParsedPayload;
  if (o.confirmed_payload && typeof o.confirmed_payload === "object") {
    return o.confirmed_payload as ParsedPayload;
  }
  return null;
}

export default async function CapturePage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string }>;
}) {
  const ctx = await requireUserContext();
  const supabase = await createClient();
  const cfg = await getWorkspaceConfig(ctx.workspaceId);
  const { draft: draftId } = await searchParams;

  const [{ data: customers }, { data: customerSites }, { data: locations }] = await Promise.all([
    supabase.from("customers").select("id, name").eq("workspace_id", ctx.workspaceId).order("name"),
    supabase
      .from("customer_sites")
      .select("id, customer_id, name, address")
      .eq("workspace_id", ctx.workspaceId),
    supabase
      .from("locations")
      .select("id, name, type, address")
      .eq("workspace_id", ctx.workspaceId)
      .order("name"),
  ]);

  let initialDraft:
    | { id: string; original_text: string; payload: ParsedPayload | null }
    | null = null;
  if (draftId) {
    const { data } = await supabase
      .from("captured_inputs")
      .select("id, original_text, parsed_payload")
      .eq("id", draftId)
      .eq("workspace_id", ctx.workspaceId)
      .eq("user_id", ctx.userId)
      .maybeSingle();
    if (data) {
      initialDraft = {
        id: data.id,
        original_text: data.original_text,
        payload: normaliseDraftPayload(data.parsed_payload),
      };
    }
  }

  return (
    <CaptureScreen
      timezone={cfg.timezone}
      slotSchemas={buildSlotSchemas()}
      pickerData={{
        customers: customers ?? [],
        customerSites: customerSites ?? [],
        locations: (locations ?? []) as never,
      }}
      initialDraft={initialDraft}
    />
  );
}
