import { requestPasswordReset } from "./actions";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const sp = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold">Reset password</h1>
        <p className="text-sm text-muted-foreground">
          Enter your email and we'll send a link to set a new password.
        </p>
      </div>
      {sp.error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {sp.error}
        </div>
      ) : null}
      {sp.sent === "1" ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
          Check your inbox. If an account exists for that email, you'll get a
          reset link in the next minute or two.
        </div>
      ) : (
        <form action={requestPasswordReset} className="flex flex-col gap-3">
          <label className="text-sm">
            Email
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              autoFocus
              className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
            />
          </label>
          {sp.error ? (
            <p className="text-sm text-destructive">{sp.error}</p>
          ) : null}
          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Send reset link
          </button>
        </form>
      )}
      <p className="text-sm text-muted-foreground">
        <a href="/login" className="underline">
          Back to sign in
        </a>
      </p>
    </main>
  );
}
