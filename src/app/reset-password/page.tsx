import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { setNewPassword } from "./actions";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;

  // The /auth/callback should have exchanged the recovery code into a
  // session before redirecting here. If there's no user, the link expired
  // or was never used — send them back to start.
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    redirect("/forgot-password?error=Reset%20link%20expired%20or%20already%20used");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold">Set a new password</h1>
        <p className="text-sm text-muted-foreground">
          Signed in as {data.user.email}. Enter a new password to finish.
        </p>
      </div>
      <form action={setNewPassword} className="flex flex-col gap-3">
        <label className="text-sm">
          New password
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoFocus
            autoComplete="new-password"
            className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm">
          Confirm
          <input
            name="confirm"
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
          Save password
        </button>
      </form>
    </main>
  );
}
