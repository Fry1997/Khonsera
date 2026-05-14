import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="paper-tex flex min-h-screen flex-col">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-10 px-6 py-16">
        <div className="brand-glyph">Journies</div>
        <div className="space-y-4">
          <h1 className="h0">
            Know whether you can actually{" "}
            <span className="text-terra">get there</span> — before you say yes.
          </h1>
          <p className="body max-w-xl text-base">
            Plan, book, calendar and navigate on-site business visits from door
            to door. Travel-aware feasibility, rail vs drive comparison, partner
            rail booking and travel-day guidance.
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/login" className="btn-terra">
            Sign in
          </Link>
          <Link href="/signup" className="btn-ghost">
            Create account
          </Link>
        </div>
      </div>
    </main>
  );
}
