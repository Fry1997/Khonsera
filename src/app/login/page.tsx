import Link from "next/link";
import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const sp = await searchParams;
  return (
    <main className="paper-tex flex min-h-screen flex-col">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-7 px-6 py-12">
        <Link href="/" className="brand-glyph w-fit">
          Journies
        </Link>
        <div className="flex flex-col gap-1">
          <h1 className="h1">Sign in</h1>
          <p className="body">Welcome back.</p>
        </div>
        <form action={login} className="flex flex-col gap-4">
          <input type="hidden" name="next" value={sp.next ?? "/dashboard"} />
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
              autoComplete="current-password"
              className="input-base"
            />
          </label>
          {sp.error ? <p className="text-sm text-rust">{sp.error}</p> : null}
          <button type="submit" className="btn-terra">
            Sign in
          </button>
        </form>
        <div className="flex flex-col gap-1 text-sm">
          <a href="/forgot-password" className="text-ink-dim underline">
            Forgot password?
          </a>
          <p className="text-ink-dim">
            No account?{" "}
            <a href="/signup" className="underline">
              Create one
            </a>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
