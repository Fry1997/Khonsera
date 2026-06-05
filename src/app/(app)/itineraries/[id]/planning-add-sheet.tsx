"use client";

// The consolidated "+" add sheet for the planning view (Phase 5 follow-up).
// Re-mounts the preserved booking/import forms behind one affordance: add a
// stop, add a transport booking, add accommodation, or import from Gmail. Each
// inner form owns its own submission; the sheet just routes between them and
// closes + refreshes on done.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, MapPin, Train, BedDouble, Mail } from "lucide-react";
import { createStop } from "@/lib/actions/stops";
import { AddStopForm } from "./add-stop-form";
import { AddTransportBookingForm } from "./add-transport-booking-form";
import { AddAccommodationBookingForm } from "./add-accommodation-booking-form";
import { GmailImportPanel } from "./gmail-import-panel";
import type {
  PlacePickerCustomer,
  PlacePickerCustomerSite,
  PlacePickerLocation,
} from "@/components/place-picker";

export type Pickers = {
  customers: PlacePickerCustomer[];
  customerSites: PlacePickerCustomerSite[];
  locations: PlacePickerLocation[];
  contacts: { id: string; customer_id: string; name: string }[];
  gmailConnected: boolean;
};

type Pane = "menu" | "stop" | "transport" | "accommodation" | "gmail";

export function AddSheet({
  itineraryId,
  pickers,
  lastStopId,
  lastStopLabel,
  onClose,
}: {
  itineraryId: string;
  pickers: Pickers;
  lastStopId: string | null;
  lastStopLabel: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pane, setPane] = useState<Pane>("menu");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function done() {
    onClose();
    router.refresh();
  }

  const menu: { id: Pane; label: string; icon: React.ReactNode; need?: string }[] = [
    { id: "stop", label: "Add a stop", icon: <MapPin size={18} /> },
    {
      id: "transport",
      label: "Add transport booking",
      icon: <Train size={18} />,
      need: lastStopId ? undefined : "Add a stop first",
    },
    {
      id: "accommodation",
      label: "Add accommodation",
      icon: <BedDouble size={18} />,
    },
    {
      id: "gmail",
      label: "Import from Gmail",
      icon: <Mail size={18} />,
      need: pickers.gmailConnected ? undefined : "Connect Gmail in Settings",
    },
  ];

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(30,24,18,0.34)", zIndex: 50, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "6vh 16px 40px" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 520, background: "var(--paper)", borderRadius: 12, border: "1px solid var(--rule)", boxShadow: "0 24px 60px -24px rgba(30,24,18,0.5)", overflow: "hidden" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid var(--rule)" }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--ink-dim)" }}>
            {pane === "menu" ? "Add to this trip" : menu.find((m) => m.id === pane)?.label}
          </span>
          <button onClick={onClose} title="Close" style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--ink-dim)", display: "inline-flex" }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: 16 }}>
          {pane === "menu" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {menu.map((m) => (
                <button
                  key={m.id}
                  disabled={!!m.need}
                  onClick={() => setPane(m.id)}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 14px", borderRadius: 9, border: "1px solid var(--rule)", background: "var(--card)", cursor: m.need ? "not-allowed" : "pointer", opacity: m.need ? 0.55 : 1, textAlign: "left", color: "var(--ink)" }}
                >
                  <span style={{ color: "var(--ink-2)" }}>{m.icon}</span>
                  <span style={{ fontFamily: "var(--sans)", fontSize: 14, fontWeight: 500 }}>{m.label}</span>
                  {m.need && <span style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-dim)" }}>{m.need}</span>}
                </button>
              ))}
            </div>
          )}

          {pane === "stop" && (
            <>
              {error && <ErrorLine>{error}</ErrorLine>}
              <AddStopForm
                itineraryId={itineraryId}
                customers={pickers.customers}
                customerSites={pickers.customerSites}
                locations={pickers.locations}
                contacts={pickers.contacts}
                pending={pending}
                onCancel={() => setPane("menu")}
                onSubmit={(values) => {
                  setError(null);
                  startTransition(async () => {
                    const res = await createStop(values);
                    if (!res.ok) {
                      setError("Couldn't add the stop");
                      return;
                    }
                    done();
                  });
                }}
              />
            </>
          )}

          {pane === "transport" && lastStopId && (
            <AddTransportBookingForm
              fromStopId={lastStopId}
              fromStopLabel={lastStopLabel}
              customers={pickers.customers}
              customerSites={pickers.customerSites}
              locations={pickers.locations}
              onCancel={() => setPane("menu")}
              onDone={done}
            />
          )}

          {pane === "accommodation" && (
            <AddAccommodationBookingForm
              afterStopId={lastStopId ?? undefined}
              afterStopLabel={lastStopLabel}
              customers={pickers.customers}
              customerSites={pickers.customerSites}
              locations={pickers.locations}
              onCancel={() => setPane("menu")}
              onDone={done}
            />
          )}

          {pane === "gmail" && (
            <GmailImportPanel
              itineraryId={itineraryId}
              lastStopId={lastStopId}
              lastStopLabel={lastStopLabel}
              onClose={() => setPane("menu")}
              onImported={done}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ErrorLine({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12, padding: "8px 12px", borderRadius: 6, background: "var(--rust-2)", color: "var(--rust)", fontFamily: "var(--sans)", fontSize: 12 }}>{children}</div>
  );
}
