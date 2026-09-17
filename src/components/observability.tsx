"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

let posthogStarted = false;

function PostHogInstrumentation() {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key || posthogStarted) return;

    posthog.init(key, {
      api_host:
        process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com",
      capture_pageview: "history_change",
      capture_pageleave: true,
      person_profiles: "identified_only",
    });

    posthogStarted = true;
  }, []);

  return null;
}

/**
 * Root-level telemetry that is safe to render in every environment.
 * Sentry is initialised through Next instrumentation files; PostHog remains
 * dormant until NEXT_PUBLIC_POSTHOG_KEY is supplied. Vercel's components are
 * no-ops when their platform features are not available.
 */
export function Observability() {
  return (
    <>
      <PostHogInstrumentation />
      <Analytics />
      <SpeedInsights />
    </>
  );
}
