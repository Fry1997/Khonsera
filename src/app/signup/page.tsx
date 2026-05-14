import { signup } from "./actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold">Create account</h1>
        <p className="text-sm text-muted-foreground">
          A personal workspace is created automatically. You can add team
          members later.
        </p>
      </div>
      <form action={signup} className="flex flex-col gap-3">
        <label className="text-sm">
          Full name
          <input
            name="full_name"
            required
            className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
          />
        </label>
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
            minLength={8}
            autoComplete="new-password"
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
          Create account
        </button>
      </form>
      <p className="text-sm text-muted-foreground">
        Already have an account?{" "}
        <a href="/login" className="underline">
          Sign in
        </a>
        .
      </p>
    </main>
  );
}
