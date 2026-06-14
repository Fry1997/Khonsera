import Link from "next/link";
import type { Route } from "next";
import type { DayReview } from "@/lib/actions/review";

function clock(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(new Date(iso));
}

// P5 hero — the night-before review. Reassurance, not a dashboard (C16): lead
// with leave-by as the hero figure. Markup carries Design's Edition III contract
// (.cc-review[data-clear], leaveby .l/.v, rows .t/.who); skin in edition-iii.css.
export function DayReviewCard({ review, eyebrow }: { review: DayReview; eyebrow?: string }) {
  const clear = !review.fragile && review.readinessOpen === 0;
  return (
    <section className="cc-review" data-clear={clear ? "true" : "false"}>
      <span className="cc-review-eyebrow">{eyebrow ?? review.dateLabel}</span>
      <h2 className="cc-review-title">{review.title}</h2>

      {review.leaveBy ? (
        <div className="cc-review-leaveby">
          <span className="l">Leave by</span>
          <span className="v">{clock(review.leaveBy)}</span>
        </div>
      ) : null}

      <p className="cc-review-shape">
        {review.commitments.length > 0
          ? `${review.commitments.length} ${review.commitments.length === 1 ? "commitment" : "commitments"}`
          : "An open day"}
        {review.totalDurationLabel ? ` · ${review.totalDurationLabel} on the move` : ""}
        {review.legCount > 0 ? ` · ${review.legCount} ${review.legCount === 1 ? "leg" : "legs"}` : ""}
      </p>

      {review.commitments.length > 0 ? (
        <div className="cc-review-list">
          {review.commitments.map((c, i) => (
            <div key={i} className="cc-review-row">
              <span className="t">{c.timeLabel ?? "—"}</span>
              <span className="who">{c.label}</span>
            </div>
          ))}
        </div>
      ) : null}

      {review.fragile && review.fragileNote ? (
        <p className="cc-review-flag">{review.fragileNote} — add a buffer while you can.</p>
      ) : null}

      <div className="cc-review-foot">
        <span className="cc-review-verdict">{review.verdict}</span>
        <Link href={`/plan/${review.itineraryId}` as Route} className="cc-btn cc-btn-ghost">
          Open the plan
        </Link>
      </div>
    </section>
  );
}
