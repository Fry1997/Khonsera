"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

type Bucket = "all" | "rail" | "flights" | "stays" | "cars";

export function BookingsFilter({
  active,
  counts,
  labels,
}: {
  active: Bucket;
  counts: Record<Bucket, number>;
  labels: Record<Bucket, string>;
}) {
  const buckets: Bucket[] = ["all", "rail", "flights", "stays", "cars"];
  return (
    <div className="bookings-filter">
      {buckets.map((b) => (
        <Link
          key={b}
          href={b === "all" ? "/bookings" : `/bookings?filter=${b}`}
          className={cn("filter-pill")}
          data-active={active === b}
        >
          <span>{labels[b]}</span>
          {counts[b] > 0 ? (
            <span className="filter-pill-count">{counts[b]}</span>
          ) : null}
        </Link>
      ))}
    </div>
  );
}
