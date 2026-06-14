import { redirect } from "next/navigation";

// Folded into the canonical `/plan/[id]` view (Edition III P0).
export default async function LegacyTimelineRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/plan/${id}`);
}
