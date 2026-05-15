"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { createInlineLocation } from "@/lib/actions/locations";
import { feedbackFromError } from "@/lib/actions/_form";
import type { LocationType } from "@/lib/types/domain";

export type PlacePickerCustomer = { id: string; name: string };
export type PlacePickerCustomerSite = {
  id: string;
  customer_id: string;
  name: string | null;
  address: string | null;
};
export type PlacePickerLocation = {
  id: string;
  name: string;
  type: LocationType;
  address: string | null;
};

// What the picker hands back when the user makes a choice.
export type PlaceSelection =
  | {
      kind: "location";
      location_id: string;
      label: string;
      sublabel?: string;
      location_type: LocationType;
    }
  | {
      kind: "customer_site";
      customer_id: string;
      customer_site_id: string;
      label: string;
      sublabel?: string;
    }
  | {
      kind: "customer";
      customer_id: string;
      label: string;
    };

type Row =
  | {
      key: string;
      kind: "location";
      label: string;
      sublabel?: string;
      location: PlacePickerLocation;
    }
  | {
      key: string;
      kind: "customer_site";
      label: string;
      sublabel?: string;
      site: PlacePickerCustomerSite;
      customer_name: string;
    }
  | {
      key: string;
      kind: "customer";
      label: string;
      customer: PlacePickerCustomer;
    };

const PLACE_KINDS: { value: LocationType; label: string }[] = [
  { value: "station", label: "Station" },
  { value: "hotel", label: "Hotel" },
  { value: "office", label: "Office" },
  { value: "home", label: "Home" },
  { value: "parking", label: "Parking" },
  { value: "other", label: "Other" },
];

export function PlacePicker({
  customers,
  customerSites,
  locations,
  value,
  onChange,
  disabled,
  placeholder = "Where? (saved place, customer, or new place)",
}: {
  customers: PlacePickerCustomer[];
  customerSites: PlacePickerCustomerSite[];
  locations: PlacePickerLocation[];
  value: PlaceSelection | null;
  onChange: (selection: PlaceSelection | null) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [creating, setCreating] = useState<string | null>(null); // pending query → new place form
  const [newType, setNewType] = useState<LocationType>("other");
  const [newAddress, setNewAddress] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const customerById = useMemo(() => {
    const m = new Map<string, PlacePickerCustomer>();
    for (const c of customers) m.set(c.id, c);
    return m;
  }, [customers]);

  const allRows = useMemo<Row[]>(() => {
    const rows: Row[] = [];
    for (const l of locations) {
      rows.push({
        key: `loc-${l.id}`,
        kind: "location",
        label: l.name,
        sublabel: `${labelForLocationType(l.type)}${l.address ? " · " + l.address : ""}`,
        location: l,
      });
    }
    for (const s of customerSites) {
      const cust = customerById.get(s.customer_id);
      if (!cust) continue;
      rows.push({
        key: `site-${s.id}`,
        kind: "customer_site",
        label: `${cust.name}${s.name ? " — " + s.name : ""}`,
        sublabel: s.address ?? "Customer site",
        site: s,
        customer_name: cust.name,
      });
    }
    for (const c of customers) {
      rows.push({
        key: `cust-${c.id}`,
        kind: "customer",
        label: c.name,
        customer: c,
      });
    }
    return rows;
  }, [locations, customerSites, customers, customerById]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allRows.slice(0, 30);
    return allRows
      .filter((r) =>
        (r.label + " " + (("sublabel" in r && r.sublabel) || ""))
          .toLowerCase()
          .includes(q),
      )
      .slice(0, 30);
  }, [allRows, query]);

  // Close dropdown on outside click.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const pick = (row: Row) => {
    setOpen(false);
    setQuery("");
    if (row.kind === "location") {
      onChange({
        kind: "location",
        location_id: row.location.id,
        label: row.location.name,
        sublabel: row.sublabel,
        location_type: row.location.type,
      });
    } else if (row.kind === "customer_site") {
      onChange({
        kind: "customer_site",
        customer_id: row.site.customer_id,
        customer_site_id: row.site.id,
        label: row.label,
        sublabel: row.sublabel,
      });
    } else {
      onChange({
        kind: "customer",
        customer_id: row.customer.id,
        label: row.label,
      });
    }
  };

  const startCreate = () => {
    setCreating(query.trim());
    setOpen(false);
  };

  const submitCreate = async () => {
    if (!creating) return;
    setPending(true);
    setError(null);
    const result = await createInlineLocation({
      name: creating,
      type: newType,
      address: newAddress.trim() || null,
    });
    setPending(false);
    if (!result.ok) {
      setError(feedbackFromError(result.error).message);
      return;
    }
    const loc = result.value;
    onChange({
      kind: "location",
      location_id: loc.id,
      label: loc.name,
      sublabel: loc.address ?? labelForLocationType(loc.type),
      location_type: loc.type,
    });
    setCreating(null);
    setNewAddress("");
    setNewType("other");
    setQuery("");
  };

  const cancelCreate = () => {
    setCreating(null);
    setNewAddress("");
    setNewType("other");
    setError(null);
  };

  if (value && !creating) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-rule bg-card-2 px-3 py-2">
        <div className="min-w-0">
          <p className="font-medium leading-tight">
            {value.label}
            {value.kind === "customer" ? (
              <span className="uc ml-2">customer</span>
            ) : value.kind === "customer_site" ? (
              <span className="uc ml-2">site</span>
            ) : (
              <span className="uc ml-2">
                {labelForLocationType(value.location_type)}
              </span>
            )}
          </p>
          {"sublabel" in value && value.sublabel ? (
            <p className="small truncate">{value.sublabel}</p>
          ) : null}
        </div>
        <button
          type="button"
          className="text-xs text-rust hover:underline disabled:opacity-50"
          onClick={() => onChange(null)}
          disabled={disabled}
        >
          Change
        </button>
      </div>
    );
  }

  if (creating) {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-rule bg-card-2 p-3">
        <p className="small">
          New place: <span className="font-medium">{creating}</span>
        </p>
        <div className="flex flex-wrap gap-1">
          {PLACE_KINDS.map((k) => (
            <button
              type="button"
              key={k.value}
              onClick={() => setNewType(k.value)}
              className={cn(
                "rounded-full border px-2 py-0.5 text-xs",
                newType === k.value
                  ? "border-rust bg-rust-2/40 text-rust"
                  : "border-rule",
              )}
              disabled={pending}
            >
              {k.label}
            </button>
          ))}
        </div>
        <input
          className="input-base"
          placeholder="Address (optional — helps Google find it)"
          value={newAddress}
          onChange={(e) => setNewAddress(e.target.value)}
          disabled={pending}
        />
        {error ? <p className="text-xs text-rust">{error}</p> : null}
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-terra"
            style={{ padding: "6px 12px", fontSize: 13 }}
            onClick={submitCreate}
            disabled={pending}
          >
            {pending ? "Saving…" : "Save place"}
          </button>
          <button
            type="button"
            className="btn-ghost"
            style={{ padding: "6px 12px", fontSize: 13 }}
            onClick={cancelCreate}
            disabled={pending}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const showCreate = query.trim().length >= 2;
  return (
    <div ref={wrapperRef} className="relative">
      <input
        className="input-base"
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!open) return;
          const total = filtered.length + (showCreate ? 1 : 0);
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => Math.min(total - 1, h + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => Math.max(0, h - 1));
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (highlight < filtered.length) {
              pick(filtered[highlight]);
            } else if (showCreate) {
              startCreate();
            }
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        disabled={disabled}
        autoComplete="off"
      />
      {open ? (
        <div
          className="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded-md border border-rule bg-card-2 shadow-lg"
          role="listbox"
        >
          {filtered.length === 0 && !showCreate ? (
            <p className="small p-3 text-center">No matches. Type a name to add a new place.</p>
          ) : null}
          {filtered.map((row, i) => (
            <button
              key={row.key}
              type="button"
              role="option"
              aria-selected={i === highlight}
              onMouseEnter={() => setHighlight(i)}
              onClick={() => pick(row)}
              className={cn(
                "flex w-full flex-col items-start gap-0 border-b border-rule/50 px-3 py-2 text-left last:border-b-0",
                i === highlight ? "bg-rust-2/30" : "",
              )}
            >
              <span className="text-sm">
                {row.label}
                {row.kind === "location" ? (
                  <span className="uc ml-2">
                    {labelForLocationType(row.location.type)}
                  </span>
                ) : row.kind === "customer_site" ? (
                  <span className="uc ml-2">site</span>
                ) : (
                  <span className="uc ml-2">customer</span>
                )}
              </span>
              {"sublabel" in row && row.sublabel ? (
                <span className="small truncate">{row.sublabel}</span>
              ) : null}
            </button>
          ))}
          {showCreate ? (
            <button
              type="button"
              onMouseEnter={() => setHighlight(filtered.length)}
              onClick={startCreate}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                highlight === filtered.length ? "bg-rust-2/30" : "",
              )}
            >
              <span className="text-rust">+</span>
              <span>
                Add new place: <span className="font-medium">{query.trim()}</span>
              </span>
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function labelForLocationType(t: LocationType): string {
  switch (t) {
    case "home":
      return "Home";
    case "office":
      return "Office";
    case "station":
      return "Station";
    case "hotel":
      return "Hotel";
    case "customer_site":
      return "Customer site";
    case "parking":
      return "Parking";
    case "other":
      return "Place";
  }
}
