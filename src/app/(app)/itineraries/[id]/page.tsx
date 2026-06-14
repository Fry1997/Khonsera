import { redirect } from "next/navigation";

// Coherence (Edition III P0): `/plan/[id]` is the single canonical itinerary
// surface (threaded spine + door-to-door map + home as a base). The legacy
// editor (`itinerary-editor.tsx`) is kept dormant in the tree; this route
// redirects so there is one detail view, not two.
export default async function LegacyItineraryRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/plan/${id}`);
}
