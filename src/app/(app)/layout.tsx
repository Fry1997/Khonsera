import { requireUserContext } from "@/lib/auth";
import { BrandHeader } from "@/components/brand-header";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireUserContext();

  return (
    <div className="min-h-screen bg-paper paper-tex">
      <BrandHeader email={ctx.email} isStaff={ctx.isStaff} />
      <main className="mx-auto max-w-[1240px]">{children}</main>
    </div>
  );
}
