import type { ComponentPropsWithoutRef, CSSProperties, ElementType, ReactNode } from "react";

import { cn } from "@/lib/utils";

type AppScreenProps<T extends ElementType = "h1"> = ComponentPropsWithoutRef<"div"> & {
  eyebrow?: ReactNode;
  title: ReactNode;
  titleAs?: T;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  contentClassName?: string;
  headerClassName?: string;
  headerStyle?: CSSProperties;
};

export function AppScreen<T extends ElementType = "h1">({
  eyebrow,
  title,
  titleAs,
  description,
  actions,
  children,
  className,
  contentClassName,
  headerClassName,
  headerStyle,
  ...props
}: AppScreenProps<T>) {
  const Title = titleAs ?? "h1";

  return (
    <div className={cn("cc-screen", className)} {...props}>
      <header
        className={headerClassName}
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: "var(--space-4)",
          flexWrap: "wrap",
          ...headerStyle,
        }}
      >
        <div style={{ minWidth: 0 }}>
          {eyebrow ? <span className="cc-eyebrow">{eyebrow}</span> : null}
          <Title className="cc-screen-title" style={{ marginTop: eyebrow ? 6 : 0 }}>
            {title}
          </Title>
          {description ? (
            <p
              className="serif-i"
              style={{
                fontSize: 16,
                color: "var(--ink-dim)",
                margin: "8px 0 0",
                maxWidth: "60ch",
                lineHeight: 1.55,
              }}
            >
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {actions}
          </div>
        ) : null}
      </header>
      <div
        className={contentClassName}
        style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}
      >
        {children}
      </div>
    </div>
  );
}

export function PageShell({
  title,
  description,
  eyebrow,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("khonsera-page", className)}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 24,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 0 }}>
          {eyebrow ? (
            <span className="eyebrow" style={{ color: "var(--gold-2)" }}>
              {eyebrow}
            </span>
          ) : null}
          <h1
            className="desk-h1"
            style={{
              marginTop: eyebrow ? 6 : 0,
              fontSize: "clamp(28px, 4vw, 38px)",
            }}
          >
            {title}
          </h1>
          {description ? (
            <p
              className="serif-i"
              style={{
                fontSize: 16,
                color: "var(--ink-dim)",
                margin: "8px 0 0",
                maxWidth: "60ch",
                lineHeight: 1.55,
              }}
            >
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            {actions}
          </div>
        ) : null}
      </header>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {children}
      </div>
    </div>
  );
}

export function ComingSoon({
  feature,
  detail,
}: {
  feature: string;
  detail?: string;
}) {
  return (
    <div
      className="card-soft"
      style={{
        padding: 24,
        borderStyle: "dashed",
      }}
    >
      <p
        className="serif-i"
        style={{ fontSize: 18, color: "var(--ink)", marginBottom: 6 }}
      >
        {feature} · <em style={{ color: "var(--gold)" }}>coming soon</em>
      </p>
      <p style={{ fontSize: 13, color: "var(--ink-dim)" }}>
        {detail ??
          "This area is reserved in the app shell. The data model and routes exist; functionality lands when the relevant integration is wired up."}
      </p>
    </div>
  );
}
