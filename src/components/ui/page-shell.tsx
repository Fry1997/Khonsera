import { cn } from "@/lib/utils";

export function PageShell({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-9 md:px-10 md:py-12 md:gap-7",
        className,
      )}
    >
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="h1 text-3xl md:text-4xl">{title}</h1>
          {description ? <p className="body max-w-2xl">{description}</p> : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap gap-2">{actions}</div>
        ) : null}
      </header>
      <div className="flex flex-col gap-5">{children}</div>
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
    <div className="rounded-md border border-dashed border-rule bg-card-2 p-5">
      <p className="h3 mb-1">{feature} · coming soon</p>
      <p className="small">
        {detail ??
          "This area is reserved in the app shell. The data model and routes exist; functionality lands when the relevant integration is wired up."}
      </p>
    </div>
  );
}
