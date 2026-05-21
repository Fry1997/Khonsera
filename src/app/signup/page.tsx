import Link from "next/link";
import { signup } from "./actions";
import { KhonseraBrand } from "@/components/khonsera-brand";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  return (
    <main
      className="paper-tex"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--paper)",
      }}
    >
      <div
        style={{
          margin: "0 auto",
          width: "100%",
          maxWidth: 460,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 28,
          justifyContent: "center",
          padding: "48px 24px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center" }}>
          <KhonseraBrand size="md" href="/" />
        </div>

        <div style={{ textAlign: "center" }}>
          <h1
            className="display-i"
            style={{
              margin: 0,
              fontSize: 38,
              letterSpacing: "-0.02em",
              color: "var(--ink)",
            }}
          >
            Begin your <em style={{ color: "var(--gold)" }}>evening.</em>
          </h1>
          <p
            className="serif-i"
            style={{
              marginTop: 6,
              color: "var(--ink-dim)",
              fontSize: 15,
              maxWidth: "40ch",
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            A personal workspace is created for you. Add team members later
            from settings.
          </p>
        </div>

        <form action={signup} className="card" style={{ padding: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <label
              style={{ display: "flex", flexDirection: "column", gap: 6 }}
            >
              <span className="uc">Full name</span>
              <input name="full_name" required className="field" />
            </label>
            <label
              style={{ display: "flex", flexDirection: "column", gap: 6 }}
            >
              <span className="uc">Email</span>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                className="field"
              />
            </label>
            <label
              style={{ display: "flex", flexDirection: "column", gap: 6 }}
            >
              <span className="uc">Password</span>
              <input
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="field"
              />
            </label>
            {sp.error ? (
              <p style={{ fontSize: 13, color: "var(--rust)" }}>{sp.error}</p>
            ) : null}
            <button
              type="submit"
              className="btn btn-gold btn-full btn-lg"
              style={{ marginTop: 4 }}
            >
              Create account
            </button>
          </div>
        </form>

        <p
          style={{
            fontSize: 13,
            color: "var(--ink-dim)",
            textAlign: "center",
          }}
        >
          Already have an account?{" "}
          <Link
            href="/login"
            style={{ color: "var(--gold-2)", fontWeight: 600 }}
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
