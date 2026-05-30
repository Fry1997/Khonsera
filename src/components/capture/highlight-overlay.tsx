"use client";

import { buildOverlaySegments, type OverlaySpan } from "./draft-model";

const TINT_CLASS: Record<string, string> = {
  bound: "mk mk-bound",
  ambiguous: "mk mk-ambiguous",
  unknown: "mk mk-unknown",
  temporal: "mk mk-temporal",
  amount: "mk mk-amount",
};

// The painted mirror that sits BEHIND the transparent-text textarea. It renders
// the same text, tinting each recognised span by type so words "light up" in
// place as the user types. Purely decorative (pointer-events: none); the real
// caret + selection live in the textarea on top. A trailing newline is added so
// the mirror's last line height matches the textarea (textareas reserve it).
export function HighlightMirror({
  text,
  spans,
  hoverRange,
}: {
  text: string;
  spans: OverlaySpan[];
  hoverRange: { start: number; end: number } | null;
}) {
  const segments = buildOverlaySegments(text, spans);
  let offset = 0;
  return (
    <div className="capture-mirror" aria-hidden>
      {segments.map((seg, i) => {
        const start = offset;
        offset += seg.text.length;
        if (seg.kind === "text") return <span key={i}>{seg.text}</span>;
        const hovered = hoverRange && hoverRange.start <= start && hoverRange.end >= offset;
        return (
          <span key={i} className={`${TINT_CLASS[seg.tint] ?? "mk"}${hovered ? " mk-hover" : ""}`}>
            {seg.text}
          </span>
        );
      })}
      {"\n"}
    </div>
  );
}
