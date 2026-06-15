import { readSharePosition } from "@/lib/actions/sharing";
import { SharedLocationView } from "./shared-view";

// Public recipient page (Phase 18) — the live-location GIFT. Top-level (outside the
// app shell): no auth, no nav. Shows ONLY the position + recipient label, ONLY while
// the share is active, via the anon-safe `share_position` RPC. The client polls.
export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const initial = await readSharePosition(token);
  return <SharedLocationView token={token} initial={initial} />;
}
