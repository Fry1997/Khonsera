"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createLocationShare, revokeLocationShare, pushSharePosition, type ShareVM } from "@/lib/actions/sharing";

// Sharing / comms / safety (Phase 18). Personal tier: live location as a revocable,
// time-bounded GIFT. Plus compose-a-message (handed to the OS share sheet) and a
// safety "arrived" note. The employer tier (status + ETA, never location) is a
// separate read surface — nothing here shares coordinates to a workspace.
export function ShareControl({ itineraryId, isWork, shares }: { itineraryId: string; isWork: boolean; shares: ShareVM[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [recipient, setRecipient] = useState("");
  const [hours, setHours] = useState(4);
  const [error, setError] = useState<string | null>(null);
  const [liveToken, setLiveToken] = useState<string | null>(null); // a share we're actively broadcasting to this session
  const watchId = useRef<number | null>(null);

  const active = shares.filter((s) => !s.revoked);

  // While broadcasting, post position to ALL active shares (one call covers them).
  useEffect(() => {
    if (!liveToken) return;
    if (!("geolocation" in navigator)) { setError("This device can't share its location."); return; }
    let last = 0;
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - last < 15_000) return; // throttle to ~every 15s
        last = now;
        void pushSharePosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => setError("Couldn't get a GPS fix — check location permission."),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    );
    return () => { if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current); };
  }, [liveToken]);

  function startShare() {
    setError(null);
    startTransition(async () => {
      const res = await createLocationShare({ itineraryId, recipient: recipient || undefined, hours });
      if (!res.ok || !res.token) return setError(res.error ?? "Couldn't start the share.");
      setLiveToken(res.token);
      setRecipient("");
      router.refresh();
    });
  }
  function revoke(id: string) {
    startTransition(async () => { await revokeLocationShare(id, itineraryId); if (active.length <= 1) setLiveToken(null); router.refresh(); });
  }
  function shareLink(token: string) {
    const url = `${location.origin}/share/${token}`;
    if (navigator.share) void navigator.share({ title: "My live location", text: "Following my journey on Khonsera:", url });
    else void navigator.clipboard?.writeText(url);
  }
  function compose(text: string) {
    if (navigator.share) void navigator.share({ text });
    else window.open(`sms:?&body=${encodeURIComponent(text)}`, "_blank");
  }

  return (
    <section className="cc-share" style={{ border: "1px solid var(--rule)", borderRadius: "var(--radius-lg, 12px)", padding: "var(--space-4)", background: "var(--card)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <span className="cc-eyebrow">Share &amp; tell</span>

      {/* Compose-message — handed to the OS share sheet */}
      <div className="cc-share-tell" style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
        <button type="button" className="cc-btn cc-btn-ghost" onClick={() => compose("Running about 15 minutes late — start without me, I'll be there as soon as I can.")}>Running late</button>
        <button type="button" className="cc-btn cc-btn-ghost" onClick={() => compose("Arrived safely.")}>Arrived safely</button>
        <button type="button" className="cc-btn cc-btn-ghost" onClick={() => compose("On my way — see you soon.")}>On my way</button>
      </div>

      {isWork ? (
        <p className="cc-share-employer" style={{ fontSize: "var(--fs-micro, 11px)", color: "var(--ink-dim)", margin: 0 }}>
          Your workspace sees this work trip&rsquo;s status and ETA — never your live location.
        </p>
      ) : null}

      {/* Personal tier — live location as a revocable, time-bounded gift */}
      <div className="cc-share-live" style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", alignItems: "center" }}>
        <input className="cc-field" placeholder="Share with (e.g. Mum)" value={recipient} onChange={(e) => setRecipient(e.target.value)} style={{ width: 150 }} />
        <select className="cc-field" value={hours} onChange={(e) => setHours(Number(e.target.value))}>{[1, 2, 4, 8].map((h) => <option key={h} value={h}>{h}h</option>)}</select>
        <button type="button" className="cc-btn cc-btn-gold" onClick={startShare} disabled={pending}>Share live location</button>
      </div>
      {error ? <p className="cc-share-error" style={{ color: "var(--rust)", fontSize: "var(--fs-label)" }}>{error}</p> : null}

      {active.length > 0 ? (
        <ul className="cc-share-list" style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
          {active.map((s) => (
            <li key={s.id} className="cc-share-row" style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
              <span style={{ color: "var(--ink)" }}>{s.recipient || "Anyone with the link"}</span>
              <span style={{ fontFamily: "var(--mono)", fontSize: "var(--fs-micro, 11px)", color: liveToken === s.token ? "var(--sage, var(--gold-2))" : "var(--ink-dim)" }}>
                {liveToken === s.token ? "broadcasting" : s.lastAt ? `last sent ${new Date(s.lastAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : "ready"} · until {new Date(s.expiresAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
              </span>
              <span style={{ marginLeft: "auto", display: "inline-flex", gap: 8 }}>
                <button type="button" className="cc-share-link" onClick={() => shareLink(s.token)} style={{ background: "none", border: "none", color: "var(--gold-2)", cursor: "pointer", fontSize: "var(--fs-micro, 11px)" }}>Send link</button>
                <button type="button" className="cc-share-revoke" onClick={() => revoke(s.id)} style={{ background: "none", border: "none", color: "var(--ink-dim)", cursor: "pointer", fontSize: "var(--fs-micro, 11px)" }}>Stop</button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
