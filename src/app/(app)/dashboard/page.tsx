import { redirect } from "next/navigation";

// `/today` is the canonical home surface (Edition III P0). The legacy dashboard
// is folded in; its week-calendar component is retained for later reuse.
export default function DashboardRedirect() {
  redirect("/today");
}
