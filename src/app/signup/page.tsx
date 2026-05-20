import Link from "next/link";
import { signup } from "./actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  return (
    <main className="paper-tex flex min-h-screen flex-col">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-7 px-6 py-12">
        <Link href="/" className="brand-lockup w-fit">
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
            <path
              d="M14.5 3.3a9 9 0 1 0 6.2 12.1A7 7 0 0 1 14.5 3.3Z"
              fill="currentColor"
              style={{ color: "var(--gold)" }}
            />
          </svg>
          <span>
            Khonser<span style={{ color: "var(--gold)" }}>a</span>
          </span>
        </Link>
        <div className="flex flex-col gap-1">
          <h1 className="h1">Create account</h1>
          <p className="body">
            A personal workspace is created automatically. You can add team
            members later.
          </p>
        </div>
        <form action={signup} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="uc">Full name</span>
            <input name="full_name" required className="input-base" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="uc">Email</span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="input-base"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="uc">Password</span>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="input-base"
            />
          </label>
          {sp.error ? <p className="text-sm text-rust">{sp.error}</p> : null}
          <button type="submit" className="btn-gold">
            Create account
          </button>
        </form>
        <p className="text-sm text-ink-dim">
          Already have an account?{" "}
          <a href="/login" className="underline">
            Sign in
          </a>
        </p>
      </div>
    </main>
  );
}
