// Editorial atoms — the deck-style language ported into reusable React.
// These are zero-logic: they exist so feature screens (dashboard, itinerary
// list, landing) can speak the same language as the Journeys story deck
// without each page re-declaring the same markup.
//
// The two-word vocabulary:
//   • Masthead         large serif italic title + standfirst, with optional
//                      chapter-number eyebrow and ink-dark variant.
//   • StatGroup        n-up row of stat columns (large serif italic numeric
//                      value over a mono uppercase label).
//
// Both are server-safe — no client hooks.

import { cn } from "@/lib/utils";

export function FlankEyebrow({
  children,
  align = "both",
  className,
}: {
  children: React.ReactNode;
  align?: "both" | "left" | "right";
  className?: string;
}) {
  return (
    <div className={cn("flank-eyebrow", align !== "both" ? align : "", className)}>
      <span>{children}</span>
    </div>
  );
}

export function ChapterNumber({
  value,
  size = "md",
  className,
}: {
  value: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span className={cn("chapter-number", size === "lg" && "lg", size === "sm" && "sm", className)}>
      {value}
    </span>
  );
}

// A magazine masthead: optional chapter eyebrow, a serif-italic title with a
// terra-emphasised fragment, and an optional standfirst paragraph. The `em`
// is a string that's pulled out and rendered in terra italic — pass the
// destination, the customer name, the verb that matters.
//
//   <Masthead
//     eyebrow="Next up · Tue 14:43"
//     title="On site at"
//     em="Pride Park"
//     standfirst="Tue 14:43 boss asks · Thu 14:44 booked & shared."
//   />
//
export function Masthead({
  eyebrow,
  chapter,
  title,
  em,
  trailing,
  standfirst,
  actions,
  dark,
  children,
  className,
}: {
  eyebrow?: React.ReactNode;
  chapter?: string;
  title: React.ReactNode;
  em?: React.ReactNode;
  trailing?: React.ReactNode;
  standfirst?: React.ReactNode;
  actions?: React.ReactNode;
  dark?: boolean;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex flex-col gap-4",
        dark && "editorial-dark",
        className,
      )}
    >
      {eyebrow ? (
        typeof eyebrow === "string" ? (
          <FlankEyebrow align="left">{eyebrow}</FlankEyebrow>
        ) : (
          eyebrow
        )
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex min-w-0 flex-1 items-start gap-5">
          {chapter ? <ChapterNumber value={chapter} /> : null}
          <h1 className="masthead-title">
            {title}
            {em ? (
              <>
                {" "}
                <em>{em}</em>
              </>
            ) : null}
            {trailing ? (
              <>
                {" "}
                {trailing}
              </>
            ) : null}
          </h1>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>

      {standfirst ? <p className="standfirst">{standfirst}</p> : null}
      {children}
    </section>
  );
}

export function StatGroup({
  up = 3,
  compact,
  className,
  children,
}: {
  up?: 2 | 3 | 4;
  compact?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "stat-grid",
        up === 3 && "three",
        up === 4 && "four",
        compact && "compact",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Stat({
  value,
  label,
  className,
}: {
  value: React.ReactNode;
  label: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("stat-col", className)}>
      <span className="v">{value}</span>
      <span className="l">{label}</span>
    </div>
  );
}
