import type { ReactNode } from "react";
import Link from "next/link";
import type { Route } from "next";
import { cn } from "@/lib/utils";

type EmptyStateAction = {
  label: string;
  href: Route | URL;
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
      {children || actions.length ? (
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
          {actions.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className={action.variant === "secondary" ? "btn-ghost" : "btn-terra"}
            >
              {action.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
