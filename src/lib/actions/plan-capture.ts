"use server";

import { revalidatePath } from "next/cache";
import { previewCapture, confirmCapture } from "@/lib/actions/tell-khonsera";

// Capture → spine (Planner parity, slice 1). Type a fact in plain language on
// /plan → parse it (the deterministic engine) → materialise it into a journey
// (the existing brief pipeline + solver) → the spine re-renders.
//
// NOTE (next slice): this CREATES a journey from the facts. Appending facts to an
// existing journey on the spine is the follow-up (an add-to-journey path); for
// now the magic is the empty spine → first facts → a threaded plan.
export async function captureOnPlan(
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "Tell me something to add." };

  const payload = await previewCapture(trimmed);
  if (!payload.facts || payload.facts.length === 0) {
    return { ok: false, error: "I couldn't find a fact in that — try a place, a time, or a booking." };
  }

  const res = await confirmCapture({
    payload,
  } as unknown as Parameters<typeof confirmCapture>[0]);
  if (!res.ok) {
    const msg = "message" in res.error ? res.error.message : "Couldn't add that.";
    return { ok: false, error: msg };
  }

  revalidatePath("/plan");
  return { ok: true };
}
