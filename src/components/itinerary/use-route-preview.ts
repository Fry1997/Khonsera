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
import { previewRoute } from "@/lib/actions/transitions";
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

export function useRoutePreviews() {
  // Map<key, RoutePreview | 'pending' | 'error'>. Stored in a ref so
  // concurrent calls don't reset state; the public Map is mirrored
  // into useState only on resolution to trigger re-renders.
  const cacheRef = useRef<Map<string, RoutePreview | "pending">>(new Map());
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
