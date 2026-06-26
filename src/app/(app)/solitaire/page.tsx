import type { Metadata } from "next";
import { requireUserContext } from "@/lib/auth";
import SolitaireClient from "./solitaire-client";
import "./solitaire-page.css";

// Solitaire (Klondike) — a self-contained in-app card game on the deep ink
// felt. Server component: gates on auth via the (app) shell, then hands off to
// the pure-client <SolitaireGame /> which owns all state (no backend). The
// felt fills the main content area with its own HUD. The literal felt/card
// colours live inside the game's own stylesheets — intentional game-local
// values, not app brand tokens (see the note in solitaire.css / playing-card.css).
export const metadata: Metadata = {
  title: "Solitaire",
};

export default async function SolitairePage() {
  // Keep the (app)-group auth/access gate applied.
  await requireUserContext();

  // The felt is height:100% of this fill box; the page CSS sizes the box to the
  // content region and breaks it out of the shell's padded/narrow column so the
  // table runs edge-to-edge. The responsive --cw calc fits the board to whatever
  // width the box ends up with (portrait + landscape).
  return (
    <div className="solitaire-page-fill">
      <SolitaireClient />
    </div>
  );
}
