import type { Metadata } from "next";
import { OfflineWallet } from "@/components/offline/offline-wallet";

// Top-level (NOT under the authed (app) group) so it boots with zero server work
// — the service worker precaches it and serves it when a navigation can't reach
// the network. It reads the on-device ticket snapshot and renders the Aztec.
export const metadata: Metadata = { title: "Khonsera — your tickets, offline" };

// Static: nothing server-side to render, so it precaches cleanly.
export const dynamic = "force-static";

export default function OfflinePage() {
  return <OfflineWallet />;
}
