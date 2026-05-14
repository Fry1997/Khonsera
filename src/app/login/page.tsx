import { login } from "./actions";

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  return <LoginInner searchParams={searchParams} />;
}

async function LoginInner({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const sp = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="text-sm text-muted-foreground">
          Welcome back to Journies.
        </p>
      </div>
      <form action={login} className="flex flex-col gap-3">
        <input type="hidden" name="next" value={sp.next ?? "/dashboard"} />
        <label className="text-sm">
          Email
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm">
          Password
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
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
          Sign in
        </button>
      </form>
      <p className="text-sm text-muted-foreground">
        <a href="/forgot-password" className="underline">
          Forgot password?
        </a>
      </p>
      <p className="text-sm text-muted-foreground">
        No account?{" "}
        <a href="/signup" className="underline">
          Create one
        </a>
        .
      </p>
    </main>
  );
}
