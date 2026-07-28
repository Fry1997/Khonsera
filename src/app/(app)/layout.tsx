import { redirect } from "next/navigation";
import { requireUserContext } from "@/lib/auth";
import { isApproved } from "@/lib/access";
import { MobileAppbar } from "@/components/shell/mobile-appbar";
import { MobileTabbar } from "@/components/mobile-tabbar";

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
    <div className="khonsera-app khonsera-app--unified">
      <MobileAppbar
        email={ctx.email}
        firstName={firstName}
        initials={initials}
        isStaff={ctx.isStaff}
        mode={ctx.activeMode}
      />
      <main className="cc-app-main">{children}</main>
      <div className="cc-tabbar-wrap">
        <MobileTabbar mode={ctx.activeMode} />
      </div>
    </div>
  );
}
