"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SlotDef } from "@/lib/dictionary/types";
import type { ParsedPayload, Slot } from "@/lib/parser/types";
import {
  previewCapture,
  saveCaptureDraft,
  updateCaptureDraft,
  confirmCapture,
} from "@/lib/actions/tell-khonsera";
import { feedbackFromError } from "@/lib/actions/_form";
import {
  applyCorrections,
  factTypeLabel,
  includedFacts,
  pruneCorrections,
  type Corrections,
} from "./draft-model";
import { FactCard } from "./fact-card";
import type { PickerData } from "./slot-editor";
import { stubIntentCopy } from "./intent-copy";

const CHIPS: { label: string; seed: string }[] = [
  { label: "I’m going somewhere", seed: "Train to " },
  { label: "I’ve booked something", seed: "Booked " },
  { label: "be somewhere", seed: "Meeting " },
  { label: "something due", seed: "Remember to " },
  { label: "a loose thought", seed: "" },
];

export interface CaptureScreenProps {
  timezone: string;
  slotSchemas: Record<string, SlotDef[]>;
  pickerData: PickerData;
  initialDraft?: { id: string; original_text: string; payload: ParsedPayload | null } | null;
}

export function CaptureScreen({ slotSchemas, pickerData, initialDraft }: CaptureScreenProps) {
  const router = useRouter();
  const [text, setText] = useState(initialDraft?.original_text ?? "");
  const [payload, setPayload] = useState<ParsedPayload | null>(initialDraft?.payload ?? null);
  const [loading, setLoading] = useState(false);
  const [parseError, setParseError] = useState(false);
  const [corrections, setCorrections] = useState<Corrections>({});
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [capturedId, setCapturedId] = useState<string | null>(initialDraft?.id ?? null);
  const [rebuiltNotice, setRebuiltNotice] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [hoverRange, setHoverRange] = useState<{ start: number; end: number } | null>(null);
  const [pending, startTransition] = useTransition();
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Live preview — debounced, read-only. NO persistence here.
  useEffect(() => {
    if (text.trim().length === 0) {
      setPayload(null);
      setParseError(false);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      setParseError(false);
      try {
        const next = await previewCapture(text);
        setPayload(next);
        setCorrections((prev) => {
          const { corrections: kept, dropped } = pruneCorrections(next, prev);
          if (dropped) setRebuiltNotice(true);
          return kept;
        });
      } catch {
        setParseError(true);
        setPayload(null);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [text]);

  const autoGrow = () => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  const included = payload ? includedFacts(payload, dismissed) : [];
  const stub = payload?.intent_type && payload.intent_type !== "create_intent"
    ? stubIntentCopy(payload.intent_type)
    : null;
  const canAdd = !stub && included.length > 0;

  const labelForLocalId = useMemo(() => {
    const map = new Map((payload?.facts ?? []).map((f) => [f.local_id, factTypeLabel(f.fact_type)]));
    return (id: string) => map.get(id) ?? "another fact";
  }, [payload]);

  const outgoing = (): ParsedPayload | null =>
    payload ? applyCorrections(payload, corrections, dismissed) : null;

  const commitSlot = (localId: string, key: string, slot: Slot) => {
    setCorrections((prev) => ({ ...prev, [localId]: { ...(prev[localId] ?? {}), [key]: slot } }));
    // Persist the correction only if this draft is already saved.
    if (capturedId && payload) {
      const next = applyCorrections(
        payload,
        { ...corrections, [localId]: { ...(corrections[localId] ?? {}), [key]: slot } },
        dismissed,
      );
      void updateCaptureDraft({ id: capturedId, parsed_payload: next as unknown as Record<string, unknown> });
    }
  };

  const toggleDismiss = (localId: string) =>
    setDismissed((prev) => {
      const next = new Set(prev);
      if (next.has(localId)) next.delete(localId);
      else next.add(localId);
      return next;
    });

  const saveLater = () => {
    const draft = outgoing();
    if (!draft) return;
    setFeedback(null);
    startTransition(async () => {
      const res = capturedId
        ? await updateCaptureDraft({ id: capturedId, parsed_payload: draft as unknown as Record<string, unknown> })
        : await saveCaptureDraft({ original_text: text, parsed_payload: draft as unknown as Record<string, unknown> });
      if (!res.ok) {
        setFeedback(feedbackFromError(res.error).message);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    });
  };

  const addIt = () => {
    const draft = outgoing();
    if (!draft) return;
    setFeedback(null);
    startTransition(async () => {
      const res = await confirmCapture({
        captured_input_id: capturedId,
        payload: draft as unknown as { original_text: string; facts: unknown[] },
      });
      if (!res.ok) {
        setFeedback(feedbackFromError(res.error).message);
        return;
      }
      if (res.value.itinerary_id) router.push(`/itineraries/${res.value.itinerary_id}`);
      else router.push("/dashboard");
      router.refresh();
    });
  };

  // Highlight the hovered slot's source span in the original text.
  const renderedText = () => {
    if (!hoverRange || !text) return text;
    const { start, end } = hoverRange;
    if (start >= end || end > text.length) return text;
    return (
      <>
        {text.slice(0, start)}
        <mark style={{ background: "var(--gold-soft)", color: "var(--ink)" }}>{text.slice(start, end)}</mark>
        {text.slice(end)}
      </>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 96 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span className="eyebrow" style={{ color: "var(--gold-2)" }}>Tell Khonsera</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={saveLater} disabled={pending || !payload}>
          Save later
        </button>
      </div>

      <h1 style={{ fontFamily: "var(--display)", fontWeight: 500, fontSize: "clamp(24px,4vw,32px)", color: "var(--ink)" }}>
        What’s on your mind?
      </h1>

      <textarea
        ref={taRef}
        className="field"
        style={{ minHeight: 72, resize: "none", lineHeight: 1.5 }}
        placeholder="e.g. Demo at ACME Wed 11 June, train from Wellingborough"
        value={text}
        autoFocus
        onChange={(e) => {
          setText(e.target.value);
          autoGrow();
        }}
      />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {CHIPS.map((c) => (
          <button
            key={c.label}
            type="button"
            className="pill"
            style={{ cursor: "pointer" }}
            onClick={() => {
              setText((t) => (t.trim().length ? t : c.seed));
              taRef.current?.focus();
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Original text with source-range highlight on slot hover */}
      {text.trim().length > 0 ? (
        <p className="serif-i" style={{ color: "var(--ink-dim)", fontSize: 14, margin: 0 }}>{renderedText()}</p>
      ) : null}

      {rebuiltNotice ? (
        <p style={{ fontSize: 12.5, color: "var(--ink-dim)" }}>The draft was rebuilt from your edits.</p>
      ) : null}

      {/* Draft area */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {loading && !payload ? <p style={{ color: "var(--ink-faint)" }}>Reading…</p> : null}

        {parseError ? (
          <div className="card" style={{ padding: 16 }}>
            <p style={{ color: "var(--ink)" }}>I had trouble understanding that. Want to try rephrasing, or save it as a loose thought?</p>
          </div>
        ) : null}

        {stub ? (
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontFamily: "var(--display)", fontWeight: 500, color: "var(--ink)" }}>{stub.title}</div>
            <p style={{ color: "var(--ink-dim)", marginTop: 4 }}>{stub.body}</p>
          </div>
        ) : null}

        {text.length > 1000 ? (
          <p style={{ fontSize: 12.5, color: "var(--ink-dim)" }}>
            This was long — I’ve kept it as a note rather than try to parse it.
          </p>
        ) : null}

        {!stub && payload?.facts.map((fact) => {
          const merged = corrections[fact.local_id]
            ? { ...fact, slots: { ...fact.slots, ...corrections[fact.local_id] } }
            : fact;
          return (
            <FactCard
              key={fact.local_id}
              fact={merged}
              defs={slotSchemas[fact.fact_type] ?? []}
              dismissed={dismissed.has(fact.local_id)}
              pickerData={pickerData}
              labelForLocalId={labelForLocalId}
              onCommitSlot={(key, slot) => commitSlot(fact.local_id, key, slot)}
              onToggleDismiss={() => toggleDismiss(fact.local_id)}
              onHoverRange={setHoverRange}
            />
          );
        })}
      </div>

      {feedback ? (
        <div className="rounded-md border border-rust-2 bg-rust-2/40 px-3 py-2 text-sm text-rust">{feedback}</div>
      ) : null}

      {/* Persistent action bar — always reachable */}
      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          gap: 8,
          justifyContent: "flex-end",
          padding: "12px 20px",
          background: "var(--paper)",
          borderTop: "1px solid var(--rule)",
          zIndex: 20,
        }}
      >
        <button type="button" className="btn btn-ghost" onClick={saveLater} disabled={pending || !payload}>
          Later
        </button>
        <button type="button" className="btn btn-gold" onClick={addIt} disabled={pending || !canAdd}>
          {pending ? "Adding…" : "Add it →"}
        </button>
      </div>
    </div>
  );
}
