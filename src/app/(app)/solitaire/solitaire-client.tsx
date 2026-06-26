"use client";

import dynamic from "next/dynamic";

// The game owns non-deterministic state (a freshly shuffled deck), so
// server-rendering it would mismatch the client's first render (a reshuffle
// flash + a hydration warning). ssr:false skips the server pass entirely — the
// felt mounts once on the client. The route box stays dark underneath
// (solitaire-page.css) so there's no white flash while the chunk loads.
const SolitaireGame = dynamic(
  () => import("@/components/solitaire/solitaire-game").then((m) => m.SolitaireGame),
  { ssr: false },
);

export default function SolitaireClient() {
  return <SolitaireGame />;
}
