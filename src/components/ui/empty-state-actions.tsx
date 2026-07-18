import type { ReactNode } from "react";
import type { Route } from "next";
import { cn } from "@/lib/utils";

export type EmptyStateAction = {
  label: string;
  href: Route | `/api/${string}` | URL;
  variant?: "primary" | "secondary";
};

export function EmptyStateActions({
  title,
  description,
  actions = [],
  children,
  className,
  image = true,
}: {
  title: string;
  description: string;
  actions?: EmptyStateAction[];
  children?: ReactNode;
  className?: string;
  image?: boolean;
}) {
  return (
    <div className={cn("cc-empty", className)}>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/brand/mk-ink.png" alt="" />
      ) : null}
      <p className="cc-empty-title">{title}</p>
      <p className="cc-empty-sub">{description}</p>
      {children || actions.length > 0 ? (
        <div
          className="cc-empty-actions"
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "var(--space-2)",
            marginTop: "var(--space-3)",
          }}
        >
          {children}
          {actions.map((action) => {
            const href = action.href instanceof URL ? action.href.toString() : action.href;
            return (
              <a
                key={`${action.label}-${href}`}
                href={href}
                className={action.variant === "secondary" ? "cc-btn cc-btn-ghost" : "cc-btn cc-btn-gold"}
              >
                {action.label}
              </a>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
