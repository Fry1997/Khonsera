"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

let posthogStarted = false;

function PostHogInstrumentation() {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
    if (!key || !host || posthogStarted) return;

    posthog.init(key, {
      api_host: host,
      capture_pageview: "history_change",
      capture_pageleave: true,
      autocapture: true,
      person_profiles: "identified_only",
      session_recording: {
        maskAllInputs: true,
      },
    });

    posthogStarted = true;
  }, []);

  return null;
}

/**
 * Root-level telemetry that is safe to render in every environment.
 * Sentry is initialised through Next instrumentation files; PostHog remains
 * dormant until both NEXT_PUBLIC_POSTHOG_KEY and NEXT_PUBLIC_POSTHOG_HOST are
 * supplied. Vercel's components are no-ops when their platform features are
 * not available.
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
