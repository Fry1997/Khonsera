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

type GoogleSuggestion = {
  place_id: string;
  description: string;
  primary: string;
  secondary: string;
  types: string[];
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
    }
  | {
      key: string;
      kind: "google";
      label: string;
      sublabel?: string;
      google: GoogleSuggestion;
    };

const PLACE_KINDS: { value: LocationType; label: string }[] = [
  { value: "station", label: "Station" },
  { value: "hotel", label: "Hotel" },
  { value: "office", label: "Office" },
  { value: "home", label: "Home" },
  { value: "parking", label: "Parking" },
  { value: "other", label: "Other" },
];

// Generate a stable per-session token so Google bills autocomplete + the
// follow-up Place Details call as one session (cheaper).
function newSessionToken(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `s_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function PlacePicker({
  customers,
  customerSites,
  locations,
  value,
  onChange,
  disabled,
  placeholder = "Search anywhere — your places pin to the top",
  // When set, restrict Google autocomplete to a specific place type
  // ("train_station", "airport", "lodging", "establishment", "geocode", …).
  googleTypes,
  // When the picker is being used to *replace* a place rather than tag a
  // record (e.g. arrival station), customers/sites can be hidden.
  showCustomers = true,
  // Override the location type used when adding a brand-new place from text.
  defaultNewType = "other",
}: {
  customers: PlacePickerCustomer[];
  customerSites: PlacePickerCustomerSite[];
  locations: PlacePickerLocation[];
  value: PlaceSelection | null;
  onChange: (selection: PlaceSelection | null) => void;
  disabled?: boolean;
  placeholder?: string;
  googleTypes?: string;
  showCustomers?: boolean;
  defaultNewType?: LocationType;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [creating, setCreating] = useState<
    | null
    | {
        name: string;
        // Optional Google place to materialise into a location. When set, we
        // use Place Details server-side; the form just confirms the type.
        google?: GoogleSuggestion;
      }
  >(null);
  const [newType, setNewType] = useState<LocationType>(defaultNewType);
  const [newAddress, setNewAddress] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleSuggestions, setGoogleSuggestions] = useState<GoogleSuggestion[]>([]);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleConfigured, setGoogleConfigured] = useState<boolean | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const sessionTokenRef = useRef<string>(newSessionToken());

  const customerById = useMemo(() => {
    const m = new Map<string, PlacePickerCustomer>();
    for (const c of customers) m.set(c.id, c);
    return m;
  }, [customers]);

  const allLocalRows = useMemo<Row[]>(() => {
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
    if (showCustomers) {
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
    }
    return rows;
  }, [locations, customerSites, customers, customerById, showCustomers]);

  const filteredLocal = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allLocalRows.slice(0, 12);
    return allLocalRows
      .filter((r) =>
        (r.label + " " + (("sublabel" in r && r.sublabel) || ""))
          .toLowerCase()
          .includes(q),
      )
      .slice(0, 12);
  }, [allLocalRows, query]);

  const googleRows = useMemo<Row[]>(() => {
    return googleSuggestions.map((g) => ({
      key: `g-${g.place_id}`,
      kind: "google",
      label: g.primary,
      sublabel: g.secondary,
      google: g,
    }));
  }, [googleSuggestions]);

  // Debounced Google Places autocomplete fetch. Fires only when the query is
  // long enough and the picker is open.
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setGoogleSuggestions([]);
      return;
    }
    let cancelled = false;
    setGoogleLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const url = new URL("/api/maps/places/autocomplete", window.location.origin);
        url.searchParams.set("q", q);
        url.searchParams.set("session", sessionTokenRef.current);
        if (googleTypes) url.searchParams.set("types", googleTypes);
        const res = await fetch(url.toString());
        if (!res.ok) return;
        const data = (await res.json()) as {
          suggestions: GoogleSuggestion[];
          configured: boolean;
        };
        if (cancelled) return;
        setGoogleConfigured(data.configured);
        setGoogleSuggestions(data.suggestions ?? []);
      } catch (e) {
        console.error("places autocomplete failed", e);
      } finally {
        if (!cancelled) setGoogleLoading(false);
      }
    }, 160);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query, open, googleTypes]);

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

  const handleGooglePick = async (g: GoogleSuggestion) => {
    setOpen(false);
    // Promote into our locations table immediately so the picker always
    // returns a location_id (downstream code can keep treating it like a
    // regular saved place).
    setPending(true);
    setError(null);
    const result = await createInlineLocation({
      name: g.primary || g.description,
      type: inferTypeFromGoogleTypes(g.types) ?? defaultNewType,
      google_place_id: g.place_id,
      google_session_token: sessionTokenRef.current,
    });
    // New session token for the next pick — Google's billing recommendation.
    sessionTokenRef.current = newSessionToken();
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
    setQuery("");
    setGoogleSuggestions([]);
  };

  const pick = (row: Row) => {
    if (row.kind === "google") {
      void handleGooglePick(row.google);
      return;
    }
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
    setCreating({ name: query.trim() });
    setNewType(defaultNewType);
    setOpen(false);
  };

  const submitCreate = async () => {
    if (!creating) return;
    setPending(true);
    setError(null);
    const result = await createInlineLocation({
      name: creating.name,
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
    setNewType(defaultNewType);
    setQuery("");
  };

  const cancelCreate = () => {
    setCreating(null);
    setNewAddress("");
    setNewType(defaultNewType);
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
          New place: <span className="font-medium">{creating.name}</span>
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
                  ? "border-gold bg-gold-soft text-gold-2"
                  : "border-rule",
              )}
              disabled={pending}
              style={
                newType === k.value
                  ? {
                      borderColor: "var(--gold)",
                      background: "var(--gold-soft)",
                      color: "var(--gold-2)",
                    }
                  : undefined
              }
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
            className="btn-gold"
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

  const trimmed = query.trim();
  const showCreate = trimmed.length >= 2;
  const totalRows = filteredLocal.length + googleRows.length;
  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <input
          className="input-base pr-9"
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
            const total = totalRows + (showCreate ? 1 : 0);
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlight((h) => Math.min(total - 1, h + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => Math.max(0, h - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              const combined = [...filteredLocal, ...googleRows];
              if (highlight < combined.length) {
                pick(combined[highlight]);
              } else if (showCreate) {
                startCreate();
              }
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          disabled={disabled || pending}
          autoComplete="off"
        />
        {pending || googleLoading ? (
          <span
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs"
            style={{ color: "var(--ink-faint)" }}
          >
            …
          </span>
        ) : null}
      </div>
      {open ? (
        <div
          className="absolute z-20 mt-1 max-h-80 w-full overflow-auto rounded-md border border-rule bg-card-2 shadow-lg"
          role="listbox"
        >
          {filteredLocal.length === 0 && googleRows.length === 0 && !showCreate ? (
            <p className="small p-3 text-center">
              Start typing — your saved places, Google search and "add new"
              all appear here.
            </p>
          ) : null}

          {filteredLocal.length > 0 ? (
            <div className="pp-section">
              <p className="pp-section-title">Your places</p>
              {filteredLocal.map((row, i) => (
                <PickerRow
                  key={row.key}
                  row={row}
                  active={i === highlight}
                  onHover={() => setHighlight(i)}
                  onClick={() => pick(row)}
                />
              ))}
            </div>
          ) : null}

          {googleRows.length > 0 ? (
            <div className="pp-section">
              <p className="pp-section-title">
                <span>From Google</span>
                <GooglePoweredBy />
              </p>
              {googleRows.map((row, i) => {
                const idx = filteredLocal.length + i;
                return (
                  <PickerRow
                    key={row.key}
                    row={row}
                    active={idx === highlight}
                    onHover={() => setHighlight(idx)}
                    onClick={() => pick(row)}
                  />
                );
              })}
            </div>
          ) : null}

          {googleConfigured === false && trimmed.length >= 2 ? (
            <p className="small px-3 py-2" style={{ color: "var(--ink-faint)" }}>
              Google Maps key not configured — local results only.
            </p>
          ) : null}

          {showCreate ? (
            <button
              type="button"
              onMouseEnter={() => setHighlight(totalRows)}
              onClick={startCreate}
              className={cn(
                "flex w-full items-center gap-2 border-t border-rule/60 px-3 py-2 text-left text-sm",
                highlight === totalRows ? "bg-gold-soft" : "",
              )}
              style={
                highlight === totalRows
                  ? { background: "var(--gold-soft)" }
                  : undefined
              }
            >
              <span style={{ color: "var(--gold-2)" }}>+</span>
              <span>
                Add as a new place:{" "}
                <span className="font-medium">{trimmed}</span>
              </span>
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function PickerRow({
  row,
  active,
  onHover,
  onClick,
}: {
  row: Row;
  active: boolean;
  onHover: () => void;
  onClick: () => void;
}) {
  const icon =
    row.kind === "google" ? (
      <GoogleIcon />
    ) : row.kind === "customer" ? (
      <Glyph>★</Glyph>
    ) : row.kind === "customer_site" ? (
      <Glyph>◊</Glyph>
    ) : (
      <Glyph>•</Glyph>
    );
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      onMouseEnter={onHover}
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-2 border-b border-rule/40 px-3 py-2 text-left last:border-b-0",
        active ? "bg-gold-soft" : "",
      )}
      style={active ? { background: "var(--gold-soft)" } : undefined}
    >
      <span
        className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center"
        style={{ color: "var(--ink-faint)" }}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">
          {row.label}
          {row.kind === "location" ? (
            <span className="uc ml-2">
              {labelForLocationType(row.location.type)}
            </span>
          ) : row.kind === "customer_site" ? (
            <span className="uc ml-2">site</span>
          ) : row.kind === "customer" ? (
            <span className="uc ml-2">customer</span>
          ) : null}
        </span>
        {"sublabel" in row && row.sublabel ? (
          <span className="small block truncate">{row.sublabel}</span>
        ) : null}
      </span>
    </button>
  );
}

function Glyph({ children }: { children: React.ReactNode }) {
  return <span style={{ fontSize: 13 }}>{children}</span>;
}

function GoogleIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M21.6 12.227c0-.709-.064-1.39-.182-2.045H12v3.868h5.382a4.604 4.604 0 0 1-1.996 3.018v2.509h3.232c1.891-1.741 2.982-4.305 2.982-7.35Z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.7 0 4.965-.895 6.618-2.423l-3.232-2.509c-.895.6-2.04.955-3.386.955-2.605 0-4.81-1.759-5.6-4.123H3.064v2.59A9.997 9.997 0 0 0 12 22Z"
        fill="#34A853"
      />
      <path
        d="M6.4 13.9a5.996 5.996 0 0 1 0-3.8V7.51H3.064a10.005 10.005 0 0 0 0 8.98L6.4 13.9Z"
        fill="#FBBC04"
      />
      <path
        d="M12 5.977c1.468 0 2.787.505 3.823 1.495l2.868-2.868C16.96 3.063 14.695 2 12 2 8.066 2 4.69 4.336 3.064 7.51L6.4 10.1c.791-2.364 2.995-4.123 5.6-4.123Z"
        fill="#EA4335"
      />
    </svg>
  );
}

function GooglePoweredBy() {
  return (
    <span
      className="uc inline-flex items-center gap-1"
      style={{ color: "var(--ink-faint)" }}
    >
      <GoogleIcon />
      <span>Google</span>
    </span>
  );
}

function inferTypeFromGoogleTypes(types: string[]): LocationType | null {
  if (
    types.includes("train_station") ||
    types.includes("subway_station") ||
    types.includes("transit_station") ||
    types.includes("airport")
  )
    return "station";
  if (types.includes("lodging")) return "hotel";
  if (types.includes("parking")) return "parking";
  return null;
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
