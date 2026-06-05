"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { searchTransportHubs } from "@/lib/actions/travel-profile";
import { searchPlaces } from "@/lib/actions/place-search";
import { searchContacts } from "@/lib/actions/contact-search";
import { formatMiles } from "@/lib/geo";
import type { ActiveToken } from "./use-active-token";

// A single suggestion: a canonical name to rewrite into the text + meta.
interface Suggestion {
  key: string;
  name: string;
  meta?: string; // code, role, distance
}

// Live mid-sentence suggestions for the active entity fragment. Debounced,
// proximity-seeded. Picking rewrites the fragment to the canonical name; the
// next parse binds it. Anchored just under the textarea (not the caret — caret
// pixel anchoring needs a browser to tune, so we sit it below the field).
// Keyboard movers the parent's textarea drives (↑↓ to move, Enter to pick).
export interface SuggestControls {
  down: () => void;
  up: () => void;
  pick: () => boolean; // true if a selection was committed
}

export function SuggestPopover({
  token,
  anchor,
  controlRef,
  onPick,
  onDismiss,
}: {
  token: ActiveToken;
  anchor: { lat: number; lng: number } | null;
  controlRef: MutableRefObject<SuggestControls | null>;
  onPick: (canonicalName: string) => void;
  onDismiss: () => void;
}) {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [active, setActive] = useState(0);
  const reqId = useRef(0);

  useEffect(() => {
    const q = token.fragment.trim();
    if (q.length < 2) {
      setItems([]);
      return;
    }
    const id = ++reqId.current;
    const timer = setTimeout(async () => {
      const next = await fetchSuggestions(token, anchor);
      if (id === reqId.current) {
        setItems(next);
        setActive(0);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [token, anchor]);

  // Keyboard handling is owned by the textarea; it forwards via this ref.
  useEffect(() => {
    controlRef.current = {
      down: () => setActive((a) => Math.min(a + 1, items.length - 1)),
      up: () => setActive((a) => Math.max(a - 1, 0)),
      pick: () => {
        const it = items[active];
        if (it) {
          onPick(it.name);
          return true;
        }
        return false;
      },
    };
    return () => {
      controlRef.current = null;
    };
  }, [items, active, onPick, controlRef]);

  if (items.length === 0) return null;

  return (
    <div
      className="hub-picker-list"
      role="listbox"
      style={{ marginTop: -8, marginBottom: 4, boxShadow: "0 6px 20px rgba(0,0,0,0.12)" }}
    >
      {items.map((it, i) => (
        <button
          key={it.key}
          type="button"
          role="option"
          aria-selected={i === active}
          className="hub-picker-item"
          style={{ background: i === active ? "var(--gold-tint)" : undefined }}
          onMouseEnter={() => setActive(i)}
          onMouseDown={(e) => {
            e.preventDefault(); // keep textarea focus
            onPick(it.name);
          }}
        >
          <span className="hub-picker-name">{it.name}</span>
          {it.meta ? <span className="hub-picker-meta">{it.meta}</span> : null}
        </button>
      ))}
      <button
        type="button"
        role="option"
        className="hub-picker-item"
        onMouseDown={(e) => {
          e.preventDefault();
          onDismiss();
        }}
      >
        <span className="hub-picker-name">Keep “{token.fragment}”</span>
        <span className="hub-picker-meta">as typed</span>
      </button>
    </div>
  );
}

async function fetchSuggestions(
  token: ActiveToken,
  anchor: { lat: number; lng: number } | null,
): Promise<Suggestion[]> {
  const q = token.fragment.trim();
  if (token.search === "station") {
    const res = await searchTransportHubs({ query: q, kind: token.hubKind ?? "rail_station", near: anchor ?? undefined });
    if (!res.ok) return [];
    return res.value.map((h) => ({
      key: h.id,
      name: h.name,
      meta: [h.code, h.distance_m != null ? formatMiles(h.distance_m) : null].filter(Boolean).join(" · ") || undefined,
    }));
  }
  if (token.search === "place") {
    const res = await searchPlaces({ query: q, near: anchor ?? undefined });
    if (!res.ok) return [];
    return res.value.map((p) => ({
      key: `${p.kind}:${p.id}`,
      name: p.name,
      meta: p.distance_m != null ? formatMiles(p.distance_m) : undefined,
    }));
  }
  const res = await searchContacts({ query: q });
  if (!res.ok) return [];
  return res.value.map((c) => ({ key: c.id, name: c.name, meta: c.role ?? undefined }));
}
