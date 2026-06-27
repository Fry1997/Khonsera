"use client";

import dynamic from "next/dynamic";

// The game owns non-deterministic state (a freshly generated puzzle), so
// server-rendering it would mismatch the client's first render (a regenerate
// flash + a hydration warning). ssr:false skips the server pass entirely — the
// board mounts once on the client. The route box stays on the warm desk
// underneath (sudoku-page.css) so there's no white flash while the chunk loads.
const SudokuGame = dynamic(
  () => import("@/components/sudoku/sudoku-game").then((m) => m.SudokuGame),
  { ssr: false },
);

export default function SudokuClient() {
  return <SudokuGame />;
}
