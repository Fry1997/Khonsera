import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-8 px-6 py-16">
      <div className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Journies
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">
          Know whether you can actually get there — before you say yes.
        </h1>
        <p className="text-lg text-muted-foreground">
          Plan, book, calendar and navigate on-site business visits from door to
          door. Travel-aware feasibility, rail vs drive comparison, partner rail
          booking and travel-day guidance.
        </p>
      </div>
      <div className="flex gap-3">
        <Link
          href="/login"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Sign in
        </Link>
        <Link
          href="/signup"
          className="rounded-md border border-border px-4 py-2 text-sm font-medium"
        >
          Create account
        </Link>
      </div>
    </main>
  );
}
