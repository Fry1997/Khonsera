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
    <div className="khonsera-app">
      {/* Mobile / tablet — sticky command bar and safe-area-aware navigation. */}
      <div className="cc-app-mobile lg:hidden">
        <MobileAppbar
          email={ctx.email}
          firstName={firstName}
          initials={initials}
          isStaff={ctx.isStaff}
          mode={ctx.activeMode}
        />
        <main className="cc-mobile-main">{children}</main>
        <div className="cc-tabbar-wrap">
          <MobileTabbar mode={ctx.activeMode} />
        </div>
      </div>

      {/* Desktop — navigation rail and a full-width responsive work surface. */}
      <div className="cc-app-desktop hidden lg:block">
        <div className="cc-shell">
          <AppSidebar
            email={ctx.email}
            firstName={firstName}
            initials={initials}
            workspaceName={workspace?.name ?? "Personal"}
            mode={ctx.activeMode}
          />
          <div className="cc-shell-main">
            <div className="cc-shell-canvas">
              <main className="cc-shell-col">{children}</main>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
