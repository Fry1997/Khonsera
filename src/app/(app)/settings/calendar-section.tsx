"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { disconnectGoogleCalendar } from "@/lib/actions/calendar-connection";
import { feedbackFromError } from "@/lib/actions/_form";
import { FormError } from "@/components/ui/form";

export function CalendarSection({
  connection,
}: {
  connection: { id: string; provider_account_email: string | null } | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleDisconnect = () => {
    if (!window.confirm("Disconnect Google Calendar?")) return;
    startTransition(async () => {
      setError(null);
      const result = await disconnectGoogleCalendar();
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
          <h2 className="h3 mb-1">Google Calendar</h2>
          {connection ? (
            <p className="small">
              Connected as{" "}
              <span className="text-ink-2">
                {connection.provider_account_email ?? "google account"}
              </span>
              . Free/busy lookups and event creation use this account.
            </p>
          ) : (
            <p className="small">
              Connect to check calendar conflicts when planning visits and
              auto-create travel + meeting blocks when you confirm.
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
            {pending ? "Disconnecting…" : "Disconnect"}
          </button>
        ) : (
          <a href="/api/auth/google/connect" className="btn-terra">
            Connect Google Calendar
          </a>
        )}
      </div>
      <FormError message={error ?? undefined} />
    </div>
  );
}
