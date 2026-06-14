import Link from "next/link";
import type { Route } from "next";
import type { DayReview } from "@/lib/actions/review";

function clock(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(new Date(iso));
}

// The night-before review (Phase 5). Reassurance, not a dashboard (C16): lead with
// the one time that matters (leave-by), then the shape of the day and the verdict.
export function DayReviewCard({ review, eyebrow }: { review: DayReview; eyebrow?: string }) {
  return (
    <section className="cc-review">
      <span className="cc-review-eyebrow">{eyebrow ?? review.dateLabel}</span>
      <h2 className="cc-review-title">{review.title}</h2>

      {review.leaveBy ? (
        <div className="cc-review-leaveby">
          <span className="cc-review-leaveby-label">Leave by</span>
          <span className="cc-review-leaveby-time">{clock(review.leaveBy)}</span>
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
        <ul className="cc-review-list">
          {review.commitments.map((c, i) => (
            <li key={i} className="cc-review-row">
              <span className="cc-review-row-time">{c.timeLabel ?? "—"}</span>
              <span className="cc-review-row-label">{c.label}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {review.fragile && review.fragileNote ? (
        <p className="cc-review-flag">{review.fragileNote} — add a buffer while you can.</p>
      ) : null}

      <div className="cc-review-foot">
        <span className="cc-review-verdict" data-clear={!review.fragile && review.readinessOpen === 0 ? "true" : "false"}>
          {review.verdict}
        </span>
        <Link href={`/plan/${review.itineraryId}` as Route} className="cc-btn cc-btn-ghost">
          Open the plan
        </Link>
      </div>
    </section>
  );
}
