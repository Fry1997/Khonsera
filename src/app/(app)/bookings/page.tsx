import { redirect } from "next/navigation";

// `/wallet` is the canonical place for held bookings + passes (Edition III P0).
export default function BookingsRedirect() {
  redirect("/wallet");
}
