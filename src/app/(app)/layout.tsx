import { requireUserContext } from "@/lib/auth";
import { AppSidebar } from "@/components/app-sidebar";
import { MobileTopbar } from "@/components/mobile-topbar";
import { MobileTabbar } from "@/components/mobile-tabbar";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireUserContext();
  const supabase = await createClient();
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("name")
    .eq("id", ctx.workspaceId)
    .maybeSingle();

  return (
    <div
      className="khonsera-app"
      style={{ minHeight: "100vh", background: "var(--paper)" }}
    >
      {/* Mobile / tablet — sticky top bar + FIXED bottom tab bar. */}
      <div className="lg:hidden">
        <MobileTopbar email={ctx.email} isStaff={ctx.isStaff} mode={ctx.activeMode} />
        <main
          className="paper-tex"
          style={{ padding: "16px 16px 96px", minHeight: "100vh" }}
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

      {/* Desktop — sidebar shell. */}
      <div className="hidden lg:grid desk-shell">
        <AppSidebar
          email={ctx.email}
          workspaceName={workspace?.name ?? "Personal"}
          mode={ctx.activeMode}
        />
        <div className="desk-main">
          <main className="desk-content">{children}</main>
        </div>
      </div>
    </div>
  );
}
