import type { FeasibilityStatus } from "@/lib/types/domain";

const VERDICT = {
  recommended: { cls: "tag-ok", label: "Recommended" },
  tight: { cls: "tag-tight", label: "Possible but tight" },
  not_recommended: { cls: "tag-no", label: "Not recommended" },
  not_possible: { cls: "tag-no", label: "Not possible" },
} as const;

export function VerdictPill({
  verdict,
  solid = false,
}: {
  verdict: FeasibilityStatus;
  solid?: boolean;
}) {
  const v = VERDICT[verdict];
  return (
    <span
      className={`${v.cls} ${solid ? "solid" : ""} mono inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wider`}
    >
      <span
        aria-hidden
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: "currentColor" }}
      />
      {v.label}
    </span>
  );
}

export function Stat({
  label,
  value,
  sub,
  align = "left",
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <div
      className="flex flex-col gap-1"
      style={{ textAlign: align === "right" ? "right" : "left" }}
    >
      <div className="uc">{label}</div>
      <div
        className="mono text-[20px] font-medium text-ink"
        style={{ letterSpacing: "-0.01em" }}
      >
        {value}
      </div>
      {sub ? <div className="small">{sub}</div> : null}
    </div>
  );
}

export function Rule({ className }: { className?: string }) {
  return <hr className={`j-hr ${className ?? ""}`} />;
}
