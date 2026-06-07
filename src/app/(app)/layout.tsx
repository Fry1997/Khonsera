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
      {/* Mobile / tablet — top bar + bottom tab bar. */}
      <div className="lg:hidden flex min-h-screen flex-col">
        <MobileTopbar email={ctx.email} isStaff={ctx.isStaff} mode={ctx.activeMode} />
        <main
          className="flex-1 paper-tex"
          style={{ padding: "20px 18px 24px" }}
        >
          {children}
        </main>
        <MobileTabbar />
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
