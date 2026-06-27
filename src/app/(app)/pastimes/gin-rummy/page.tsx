import type { Metadata } from "next";
import { requireUserContext } from "@/lib/auth";
import GinRummyClient from "./gin-rummy-client";
import "./gin-rummy-page.css";

// Gin Rummy — a self-contained, single-player-vs-bot card game on the ink felt.
// Server component: gates on auth via the (app) shell, then hands off to the
// pure-client <GinRummyGame /> which owns all state (no backend) and drives a
// heuristic bot opponent. The felt fills the main content area edge-to-edge.
// The table's game-local felt/card literals live in the game's own stylesheet
// (intentional Pastimes-hero values, not app brand tokens) — exactly as
// Solitaire and Sudoku do for their surfaces.
export const metadata: Metadata = {
  title: "Gin Rummy",
};

export default async function GinRummyPage() {
  // Keep the (app)-group auth/access gate applied.
  await requireUserContext();

  // The felt is height:100% of this fill box; the page CSS sizes the box to the
  // content region and breaks it out of the shell's padded/narrow column so the
  // surface runs edge-to-edge (portrait + landscape).
  return (
    <div className="gin-page-fill">
      <GinRummyClient />
    </div>
  );
}
