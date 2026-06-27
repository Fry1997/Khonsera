import type { Metadata } from "next";
import { requireUserContext } from "@/lib/auth";
import SudokuClient from "./sudoku-client";
import "./sudoku-page.css";

// Sudoku — a self-contained in-app number game on the warm paper desk. Server
// component: gates on auth via the (app) shell, then hands off to the
// pure-client <SudokuGame /> which owns all state (no backend). The desk fills
// the main content area with its own HUD. The board's game-local literals (cell
// ink tints, charcoal foil) live inside the game's own stylesheet — intentional
// game values, not app brand tokens (see the note in sudoku.css), exactly as
// Solitaire does for its felt/card colours.
export const metadata: Metadata = {
  title: "Sudoku",
};

export default async function SudokuPage() {
  // Keep the (app)-group auth/access gate applied.
  await requireUserContext();

  // The desk is height:100% of this fill box; the page CSS sizes the box to the
  // content region and breaks it out of the shell's padded/narrow column so the
  // surface runs edge-to-edge. The board's own --bs calc fits it to whatever
  // width the box ends up with (portrait + landscape).
  return (
    <div className="sudoku-page-fill">
      <SudokuClient />
    </div>
  );
}
