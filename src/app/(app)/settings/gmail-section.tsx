"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { disconnectGmail } from "@/lib/actions/gmail";
import { feedbackFromError } from "@/lib/actions/_form";
import { FormError } from "@/components/ui/form";

export function GmailSection({
  connection,
}: {
  connection: {
    id: string;
    provider_account_email: string | null;
    last_scan_at: string | null;
  } | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleDisconnect = () => {
    if (!window.confirm("Disconnect Gmail? Imported bookings won't be removed.")) return;
    startTransition(async () => {
      setError(null);
      const result = await disconnectGmail();
      if (!result.ok) {
        setError(feedbackFromError(result.error).message);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="j-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="h3 mb-1">Gmail Import</h2>
          {connection ? (
            <>
              <p className="small">
                Connected as{" "}
                <span className="text-ink-2">
                  {connection.provider_account_email ?? "google account"}
                </span>
                . Scan for booking confirmation emails from Trainline, LNER,
                airlines, Booking.com, and more.
              </p>
              {connection.last_scan_at ? (
                <p className="tiny mt-1" style={{ color: "var(--ink-dim)" }}>
                  Last scanned{" "}
                  {new Date(connection.last_scan_at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              ) : null}
            </>
          ) : (
            <p className="small">
              Connect your Gmail to automatically find booking confirmations
              from Trainline, LNER, Avanti, airlines, Booking.com, and other
              providers. Read-only access — Khonsera never sends or modifies
              your email.
            </p>
          )}
        </div>
        {connection ? (
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={pending}
            className="btn-destructive"
          >
            {pending ? "Disconnecting..." : "Disconnect"}
          </button>
        ) : (
          <a href="/api/auth/gmail/connect" className="btn-terra">
            Connect Gmail
          </a>
        )}
      </div>
      <FormError message={error ?? undefined} />
    </div>
  );
}
