"use client";

import dynamic from "next/dynamic";

// The game owns non-deterministic state (a freshly shuffled deal, seeded at
// mount), so server-rendering it would mismatch the client's first render
// (a reshuffle flash + a hydration warning). ssr:false skips the server pass
// entirely — the table mounts once on the client. The route box stays on the
// ink felt underneath (gin-rummy-page.css) so there's no flash while the chunk
// loads.
const GinRummyGame = dynamic(
  () => import("@/components/gin-rummy/gin-rummy-game").then((m) => m.GinRummyGame),
  { ssr: false },
);

export default function GinRummyClient() {
  return <GinRummyGame />;
}
