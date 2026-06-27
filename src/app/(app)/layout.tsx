import { redirect } from "next/navigation";
import { requireUserContext } from "@/lib/auth";
import { isApproved } from "@/lib/access";
import { AppSidebar } from "@/components/app-sidebar";
import { MobileAppbar } from "@/components/shell/mobile-appbar";
import { MobileTabbar } from "@/components/mobile-tabbar";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireUserContext();

  // Access gate (landing+waitlist brief §4): every app route is guarded here.
  // A signed-in but not-yet-approved account is bounced to `/`, which renders
  // the gated thank-you screen. The single chokepoint — widen `isApproved`
  // when we open the doors.
  if (!isApproved(ctx)) {
    redirect("/");
  }
  const supabase = await createClient();
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("name")
    .eq("id", ctx.workspaceId)
    .maybeSingle();

  const nameSource = ctx.fullName ?? ctx.email.split("@")[0];
  const firstName = nameSource.split(" ")[0] || "there";
  const initials =
    nameSource
      .split(/\s+/)
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || ctx.email[0]!.toUpperCase();

  return (
    <div
      className="khonsera-app"
      style={{ minHeight: "100vh", background: "var(--paper)" }}
    >
      {/* Mobile / tablet — sticky top bar + FIXED bottom tab bar. */}
      <div className="lg:hidden">
        <MobileAppbar
          email={ctx.email}
          firstName={firstName}
          initials={initials}
          isStaff={ctx.isStaff}
        />
        <main
          className="paper-tex"
          style={{
            // Bottom padding clears the FIXED tab bar (~96px) PLUS the
            // home-indicator inset so the last items are never hidden behind it.
            padding: "16px 16px calc(96px + env(safe-area-inset-bottom))",
            minHeight: "100vh",
          }}
        >
          {children}
        </main>
        <div
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 20,
            paddingBottom: "env(safe-area-inset-bottom)",
            background: "var(--card)",
          }}
        >
          <MobileTabbar mode={ctx.activeMode} />
        </div>
      </div>

      {/* Desktop — the rail shell (Design Round 2 .cc-shell). */}
      <div className="hidden lg:block" style={{ height: "100vh" }}>
        <div className="cc-shell">
          <AppSidebar
            email={ctx.email}
            firstName={firstName}
            initials={initials}
            workspaceName={workspace?.name ?? "Personal"}
            mode={ctx.activeMode}
          />
          <div className="cc-shell-main">
            <div className="cc-shell-canvas" style={{ overflowY: "auto" }}>
              <main className="cc-shell-col">{children}</main>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
