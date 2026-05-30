"use server";

// Tell Khonsera capture actions: a stateless live preview, the captured_inputs
// persistence lifecycle, and confirmation → materialisation. Nothing is written
// to captured_inputs during live parsing (brief §0c); rows appear only on an
// explicit user action.

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { getWorkspaceConfig } from "@/lib/flags/workspace-flags";
import { ok, err, errors, fromThrown, type Result } from "@/lib/errors";
import { parseInput } from "./_helpers";
import { createItineraryFromBrief } from "./itineraries";
import { parse } from "@/lib/parser/parse";
import { PARSER_VERSION, type ParsedPayload } from "@/lib/parser/types";
import { factsToBrief } from "@/lib/parser/materialise";
import type { PlaceResolver, ResolvedHub } from "@/lib/parser/slots";

// A workspace-scoped place resolver backed by transport_hubs + the user's places.
function makeResolver(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
): PlaceResolver {
  return {
    async resolveHub(name) {
      const cleaned = name.trim();
      if (!cleaned) return { match: null, candidates: [] };
      const { data } = await supabase
        .from("transport_hubs")
        .select("id, name, code")
        .or(`code.eq.${cleaned.toUpperCase()},name.ilike.${cleaned}%`)
        .limit(6);
      const rows = (data ?? []) as ResolvedHub[];
      // Exact name/code first; otherwise the prefix hits are the candidates.
      const exact = rows.find(
        (r) => r.name.toLowerCase() === cleaned.toLowerCase() || r.code === cleaned.toUpperCase(),
      );
      if (exact) return { match: exact, candidates: rows };
      if (rows.length === 1) return { match: rows[0], candidates: rows };
      return { match: null, candidates: rows };
    },
    async resolveLocation(name) {
      const cleaned = name.trim();
      if (!cleaned) return null;
      const { data: loc } = await supabase
        .from("locations")
        .select("id, name")
        .eq("workspace_id", workspaceId)
        .ilike("name", cleaned)
        .limit(1)
        .maybeSingle();
      if (loc) return loc;
      const { data: site } = await supabase
        .from("customer_sites")
        .select("id, name")
        .eq("workspace_id", workspaceId)
        .ilike("name", cleaned)
        .limit(1)
        .maybeSingle();
      return site ?? null;
    },
  };
}

// ── Live preview — stateless, read-only, NO persistence ──────────────────────
export async function previewCapture(text: string): Promise<ParsedPayload> {
  const ctx = await requireUserContext();
  const supabase = await createClient();
  const resolver = makeResolver(supabase, ctx.workspaceId);
  return parse(text ?? "", { resolver, ref: new Date() });
}

// ── Persistence lifecycle (brief §15) ────────────────────────────────────────
const payloadSchema = z.object({}).passthrough();
const saveSchema = z.object({
  original_text: z.string().min(1).max(4000),
  parsed_payload: payloadSchema,
});

export async function saveCaptureDraft(
  input: z.input<typeof saveSchema>,
): Promise<Result<{ id: string }>> {
  const parsed = parseInput(saveSchema, input);
  if (!parsed.ok) return parsed;
  const ctx = await requireUserContext();
  const supabase = await createClient();
  const expires = new Date();
  expires.setDate(expires.getDate() + 7);

  const { data, error } = await supabase
    .from("captured_inputs")
    .insert({
      workspace_id: ctx.workspaceId,
      user_id: ctx.userId,
      original_text: parsed.value.original_text,
      parser_version: PARSER_VERSION,
      parsed_payload: parsed.value.parsed_payload,
      status: "pending_review",
      expires_at: expires.toISOString(),
    })
    .select("id")
    .single();
  if (error || !data) return err(fromThrown(error, "captured_input"));
  return ok({ id: data.id });
}

const updateSchema = z.object({
  id: z.string().uuid(),
  parsed_payload: payloadSchema,
});

export async function updateCaptureDraft(
  input: z.input<typeof updateSchema>,
): Promise<Result<{ id: string }>> {
  const parsed = parseInput(updateSchema, input);
  if (!parsed.ok) return parsed;
  const ctx = await requireUserContext();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("captured_inputs")
    .select("parsed_payload")
    .eq("id", parsed.value.id)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (!existing) return err(errors.notFound("captured_input", parsed.value.id));

  // Preserve lineage: the first correction stows the original parse.
  const prev = (existing.parsed_payload ?? {}) as Record<string, unknown>;
  const nextPayload =
    "original_parse" in prev
      ? { ...prev, confirmed_payload: parsed.value.parsed_payload }
      : { original_parse: prev, confirmed_payload: parsed.value.parsed_payload };

  const { error } = await supabase
    .from("captured_inputs")
    .update({ status: "corrected", parsed_payload: nextPayload })
    .eq("id", parsed.value.id)
    .eq("workspace_id", ctx.workspaceId);
  if (error) return err(fromThrown(error, "captured_input"));
  return ok({ id: parsed.value.id });
}

export async function rejectCapture(id: string): Promise<Result<{ id: string }>> {
  const ctx = await requireUserContext();
  const supabase = await createClient();
  const { error } = await supabase
    .from("captured_inputs")
    .update({ status: "rejected", reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId);
  if (error) return err(fromThrown(error, "captured_input"));
  return ok({ id });
}

// ── Confirm → materialise (brief §16) ────────────────────────────────────────
const confirmSchema = z.object({
  captured_input_id: z.string().uuid().nullable().optional(),
  payload: z
    .object({
      original_text: z.string(),
      facts: z.array(z.any()),
    })
    .passthrough(),
});

export async function confirmCapture(
  input: z.input<typeof confirmSchema>,
): Promise<Result<{ itinerary_id: string | null; intent_ids: string[] }>> {
  const parsed = parseInput(confirmSchema, input);
  if (!parsed.ok) return parsed;
  const ctx = await requireUserContext();
  const supabase = await createClient();
  const cfg = await getWorkspaceConfig(ctx.workspaceId);

  const payload = parsed.value.payload as unknown as ParsedPayload;
  const { brief, intents } = factsToBrief(payload);
  const capturedId = parsed.value.captured_input_id ?? null;

  let itineraryId: string | null = null;
  const intentIds: string[] = [];

  try {
    // 1. Itinerary-scoped facts via the existing brief pipeline (+ solver).
    if (brief.anchors.length > 0) {
      const result = await createItineraryFromBrief({
        anchors: brief.anchors,
        transitions: brief.transitions.map((t) => ({
          from_client_id: t.from_client_id,
          to_client_id: t.to_client_id,
          mode: t.mode,
        })),
        transport_bookings: brief.transport_bookings,
        accommodation_bookings: brief.accommodation_bookings,
        timezone: cfg.timezone,
      });
      if (!result.ok) return result;
      itineraryId = result.value.id;

      // 2. Stamp provenance on the created rows (source = captured).
      await supabase
        .from("stops")
        .update({ source: "captured", confidence: "medium", captured_input_id: capturedId })
        .eq("itinerary_id", itineraryId)
        .eq("workspace_id", ctx.workspaceId);
      await supabase
        .from("transitions")
        .update({ source: "captured", confidence: "medium", captured_input_id: capturedId })
        .eq("itinerary_id", itineraryId)
        .eq("workspace_id", ctx.workspaceId);
    }

    // 3. Intents (no itinerary) — direct inserts, lineage via captured_input_id.
    for (const draft of intents) {
      const { data } = await supabase
        .from("intents")
        .insert({
          workspace_id: ctx.workspaceId,
          user_id: ctx.userId,
          captured_input_id: capturedId,
          label: draft.label,
          status: "open",
          surface_after: draft.surface_after,
        })
        .select("id")
        .single();
      if (data) intentIds.push(data.id);
    }

    // 4. Lineage on the captured_inputs row, if one exists.
    if (capturedId) {
      const stopIds = itineraryId
        ? ((await supabase.from("stops").select("id").eq("itinerary_id", itineraryId)).data ?? []).map((r) => r.id)
        : [];
      const transitionIds = itineraryId
        ? ((await supabase.from("transitions").select("id").eq("itinerary_id", itineraryId)).data ?? []).map((r) => r.id)
        : [];
      await supabase
        .from("captured_inputs")
        .update({
          status: "confirmed",
          reviewed_at: new Date().toISOString(),
          created_itinerary_id: itineraryId,
          created_stop_ids: stopIds,
          created_transition_ids: transitionIds,
        })
        .eq("id", capturedId)
        .eq("workspace_id", ctx.workspaceId);
    }

    return ok({ itinerary_id: itineraryId, intent_ids: intentIds });
  } catch (e) {
    // Atomicity: undo a partially-created itinerary (FK cascade clears children).
    if (itineraryId) {
      await supabase.from("itineraries").delete().eq("id", itineraryId).eq("workspace_id", ctx.workspaceId);
    }
    return err(fromThrown(e, "captured_input"));
  }
}
