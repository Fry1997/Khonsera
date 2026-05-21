"use client";

// useRoutePreview — session-scoped cache + on-demand fetcher for
// per-mode travel-time estimates. The editor's TransitionRow opens
// to a popover with one chip per mode; while it's open we want a
// "12m" / "4m drive" hint next to each chip. Calling the server
// action eagerly for every transition would be wasteful, so this
// hook batches by (fromStopId, toStopId, mode) and only fires when
// the consumer asks for that triple.
//
// Cache scope: the lifetime of the hook's caller. A short-lived
// in-memory Map is enough — the editor only stays mounted while the
// user is on the page, and a refresh re-fetches the underlying
// transitions anyway. Persistent caching is a future optimisation.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  previewRoute,
  previewRouteForPlaces,
} from "@/lib/actions/transitions";
import type { PlaceSelection } from "@/components/place-picker";
import type { TransitionMode } from "@/lib/types/domain";

export type RoutePreview = {
  durationMinutes: number | null;
  distanceMiles: number | null;
};

const cacheKey = (
  fromStopId: string,
  toStopId: string,
  mode: TransitionMode,
) => `${fromStopId}::${toStopId}::${mode}`;

export type InitialPreviewSeed = {
  fromStopId: string;
  toStopId: string;
  mode: TransitionMode;
  durationMinutes: number | null;
  distanceMiles: number | null;
};

export function useRoutePreviews(initialSeeds?: InitialPreviewSeed[]) {
  // Map<key, RoutePreview | 'pending'>. Stored in a ref so
  // concurrent calls don't reset state; the public Map is mirrored
  // into useState only on resolution to trigger re-renders.
  //
  // Seeded from server-side cache rows on first construction so the
  // editor can render resolved pills on first paint instead of
  // flashing 'pending' for 10s while N round-tripped previewRoute
  // calls work through Vercel + DB.
  const cacheRef = useRef<Map<string, RoutePreview | "pending">>(new Map());
  const seededRef = useRef(false);
  if (!seededRef.current) {
    seededRef.current = true;
    if (initialSeeds) {
      for (const s of initialSeeds) {
        cacheRef.current.set(cacheKey(s.fromStopId, s.toStopId, s.mode), {
          durationMinutes: s.durationMinutes,
          distanceMiles: s.distanceMiles,
        });
      }
    }
  }
  const [, force] = useState(0);

  const fetchPreview = useCallback(
    async (fromStopId: string, toStopId: string, mode: TransitionMode) => {
      const k = cacheKey(fromStopId, toStopId, mode);
      if (cacheRef.current.has(k)) return;
      cacheRef.current.set(k, "pending");
      const result = await previewRoute({
        from_stop_id: fromStopId,
        to_stop_id: toStopId,
        mode,
      });
      if (result.ok) {
        cacheRef.current.set(k, result.value);
      } else {
        // Drop the pending marker on error so a later retry isn't
        // blocked. We don't surface the error to the UI — the hint
        // just stays blank.
        cacheRef.current.delete(k);
      }
      force((n) => n + 1);
    },
    [],
  );

  // Batched variant — fires N previews and only triggers one
  // re-render when they're all settled. Useful for the editor's
  // on-mount prefetch loop, which would otherwise cascade N
  // re-renders as each leg resolved in sequence.
  const fetchPreviewsBatch = useCallback(
    async (
      triples: Array<{
        fromStopId: string;
        toStopId: string;
        mode: TransitionMode;
      }>,
    ) => {
      const fresh = triples.filter(
        (t) => !cacheRef.current.has(cacheKey(t.fromStopId, t.toStopId, t.mode)),
      );
      if (fresh.length === 0) return;
      for (const t of fresh) {
        cacheRef.current.set(
          cacheKey(t.fromStopId, t.toStopId, t.mode),
          "pending",
        );
      }
      const results = await Promise.allSettled(
        fresh.map((t) =>
          previewRoute({
            from_stop_id: t.fromStopId,
            to_stop_id: t.toStopId,
            mode: t.mode,
          }),
        ),
      );
      for (let i = 0; i < fresh.length; i++) {
        const t = fresh[i];
        const k = cacheKey(t.fromStopId, t.toStopId, t.mode);
        const r = results[i];
        if (r.status === "fulfilled" && r.value.ok) {
          cacheRef.current.set(k, r.value.value);
        } else {
          cacheRef.current.delete(k);
        }
      }
      force((n) => n + 1);
    },
    [],
  );

  const get = useCallback(
    (
      fromStopId: string,
      toStopId: string,
      mode: TransitionMode,
    ): RoutePreview | "pending" | null => {
      const entry = cacheRef.current.get(cacheKey(fromStopId, toStopId, mode));
      return entry ?? null;
    },
    [],
  );

  return { fetchPreview, fetchPreviewsBatch, get };
}

// useRoutePreviewsForPlaces — sibling hook for the brief, which has
// no stop ids (those are created on submit). Keys the cache on a
// stable representation of two PlaceSelection values so a re-render
// with the same picks reuses the prior fetch.
const placeCacheKey = (
  from: PlaceSelection | null,
  to: PlaceSelection | null,
  mode: TransitionMode,
): string => {
  const part = (p: PlaceSelection | null) =>
    p
      ? p.kind === "location"
        ? `L:${p.location_id}`
        : p.kind === "customer_site"
          ? `S:${p.customer_site_id}`
          : `C:${p.customer_id}`
      : "?";
  return `${part(from)}::${part(to)}::${mode}`;
};

export function useRoutePreviewsForPlaces() {
  const cacheRef = useRef<Map<string, RoutePreview | "pending">>(new Map());
  const [, force] = useState(0);

  const fetchPreview = useCallback(
    async (
      from: PlaceSelection | null,
      to: PlaceSelection | null,
      mode: TransitionMode,
    ) => {
      if (!from || !to) return;
      // Only saved-place pairs work — a free-text label hasn't been
      // resolved to a row yet, so coordinates aren't available
      // server-side. Silently skip rather than firing a doomed call.
      if (from.kind === "customer") return;
      if (to.kind === "customer") return;
      const k = placeCacheKey(from, to, mode);
      if (cacheRef.current.has(k)) return;
      cacheRef.current.set(k, "pending");
      const result = await previewRouteForPlaces({
        from_location_id:
          from.kind === "location" ? from.location_id : null,
        from_customer_site_id:
          from.kind === "customer_site" ? from.customer_site_id : null,
        to_location_id: to.kind === "location" ? to.location_id : null,
        to_customer_site_id:
          to.kind === "customer_site" ? to.customer_site_id : null,
        mode,
      });
      if (result.ok) {
        cacheRef.current.set(k, result.value);
      } else {
        cacheRef.current.delete(k);
      }
      force((n) => n + 1);
    },
    [],
  );

  const get = useCallback(
    (
      from: PlaceSelection | null,
      to: PlaceSelection | null,
      mode: TransitionMode,
    ): RoutePreview | "pending" | null => {
      if (!from || !to) return null;
      return cacheRef.current.get(placeCacheKey(from, to, mode)) ?? null;
    },
    [],
  );

  return { fetchPreview, get };
}

// Convenience: when an array of modes is given for one pair, fire a
// request for each one that isn't already cached. Useful for the
// editor's mode picker — opening the popover prefetches all eight
// candidate modes so the user sees hints immediately.
export function usePrefetchPairModes(
  api: ReturnType<typeof useRoutePreviews>,
  pair: { fromStopId: string; toStopId: string } | null,
  modes: TransitionMode[],
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled || !pair) return;
    for (const m of modes) {
      // fetchPreview is internally idempotent — already-cached entries
      // short-circuit.
      api.fetchPreview(pair.fromStopId, pair.toStopId, m);
    }
  }, [enabled, pair?.fromStopId, pair?.toStopId, modes, api, pair]);
}
