"use client";

import { useEffect, useMemo, useState } from "react";
import type { SpineAnchor } from "./spine-model";
import { LiveDay as CoreLiveDay } from "./live-day";
import { loadEndContextForStop } from "@/lib/actions/today-bookend";

export function LiveDay({
  anchors,
  sub,
  base,
}: {
  anchors: SpineAnchor[];
  sub?: string;
  base?: { lat: number; lng: number } | null;
}) {
  const [endContext, setEndContext] = useState<SpineAnchor | null>(null);
  const finalVisibleId = anchors[anchors.length - 1]?.id ?? null;

  useEffect(() => {
    let active = true;
    setEndContext(null);
    if (!finalVisibleId) return () => { active = false; };
    void loadEndContextForStop(finalVisibleId).then((context) => {
      if (active) setEndContext(context);
    });
    return () => { active = false; };
  }, [finalVisibleId]);

  const resolvedAnchors = useMemo(() => {
    if (!endContext || anchors.some((anchor) => anchor.id === endContext.id)) return anchors;
    return [...anchors, endContext];
  }, [anchors, endContext]);

  return <CoreLiveDay anchors={resolvedAnchors} sub={sub} base={base} />;
}
