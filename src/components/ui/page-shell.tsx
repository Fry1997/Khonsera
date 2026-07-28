import type {
  ComponentPropsWithoutRef,
  CSSProperties,
  ElementType,
  ReactNode,
} from "react";

import { cn } from "@/lib/utils";

type AppScreenProps<T extends ElementType = "h1"> =
  ComponentPropsWithoutRef<"div"> & {
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
        className={cn("cc-screen-head", headerClassName)}
        style={headerStyle}
      >
        <div className="cc-screen-copy">
          {eyebrow ? <span className="cc-eyebrow">{eyebrow}</span> : null}
          <Title
            className="cc-screen-title"
            data-has-eyebrow={eyebrow ? "true" : undefined}
          >
            {title}
          </Title>
          {description ? (
            <p className="cc-screen-description">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="cc-screen-actions">{actions}</div> : null}
      </header>
      <div className={cn("cc-screen-content", contentClassName)}>
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
    <div className={cn("khonsera-page cc-screen", className)}>
      <header className="cc-screen-head">
        <div className="cc-screen-copy">
          {eyebrow ? <span className="cc-eyebrow">{eyebrow}</span> : null}
          <h1
            className="cc-screen-title"
            data-has-eyebrow={eyebrow ? "true" : undefined}
          >
            {title}
          </h1>
          {description ? (
            <p className="cc-screen-description">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="cc-screen-actions">{actions}</div> : null}
      </header>
      <div className="cc-screen-content">{children}</div>
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
    <div className="card-soft cc-coming-soon">
      <p className="cc-coming-soon-title">
        {feature} · <em>coming soon</em>
      </p>
      <p className="cc-coming-soon-copy">
        {detail ??
          "This area is reserved in the app shell. The data model and routes exist; functionality lands when the relevant integration is wired up."}
      </p>
    </div>
  );
}
