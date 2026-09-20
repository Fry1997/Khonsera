import { notFound } from "next/navigation";
import { VisualStyleGate } from "./visual-style-gate";

export default function VisualStyleGatePage() {
  if (process.env.VERCEL_ENV === "production") notFound();

  return <VisualStyleGate />;
}
