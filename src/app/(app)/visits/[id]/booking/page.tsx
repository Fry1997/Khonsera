import { PageShell, ComingSoon } from "@/components/ui/page-shell";

export default async function BookingHandoffPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await params;
  return (
    <PageShell
      title="Book rail travel"
      description="Booking happens through a partner. The app preloads your selected outbound and return trains."
    >
      <ComingSoon
        feature="Partner rail booking module"
        detail="In the dream version this page renders an embedded Trainline (or similar) iframe with the journey pre-filled. The fallback is a branded deep-link with manual 'mark as booked' once the user returns."
      />
    </PageShell>
  );
}
