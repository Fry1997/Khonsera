import Link from "next/link";
import { login } from "./actions";
import { KhonseraBrand } from "@/components/khonsera-brand";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
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
          maxWidth: 420,
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
            Welcome <em style={{ color: "var(--gold)" }}>back.</em>
          </h1>
          <p
            className="serif-i"
            style={{
              marginTop: 6,
              color: "var(--ink-dim)",
              fontSize: 15,
            }}
          >
            The evening, kept.
          </p>
        </div>

        <form action={login} className="card" style={{ padding: 20 }}>
          <input type="hidden" name="next" value={sp.next ?? "/today"} />
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
                autoComplete="current-password"
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
              Sign in
            </button>
          </div>
        </form>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 13,
            color: "var(--ink-dim)",
            padding: "0 4px",
          }}
        >
          <Link href="/forgot-password" style={{ textDecoration: "underline" }}>
            Forgot password?
          </Link>
          <span>
            No account?{" "}
            <Link href="/signup" style={{ color: "var(--gold-2)", fontWeight: 600 }}>
              Create one
            </Link>
          </span>
        </div>
      </div>
    </main>
  );
}
