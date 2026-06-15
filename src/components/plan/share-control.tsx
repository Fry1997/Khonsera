"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createLocationShare, revokeLocationShare, pushSharePosition, type ShareVM } from "@/lib/actions/sharing";

// Sharing / comms / safety (Phase 18). Personal tier: live location as a revocable,
// time-bounded GIFT. Plus compose-a-message (handed to the OS share sheet) and a
// safety "arrived" note. The employer tier (status + ETA, never location) is a
// separate read surface — nothing here shares coordinates to a workspace.
// A share is tied to THIS journey, not a free-floating timer (deep review
// 2026-06-15). The user picks a SCOPE — until they arrive, for the rest of today,
// or for the whole trip — and we derive the hours the backend still wants. A
// custom-hours fallback stays for the off-journey case.
type ShareScope = "arrive" | "today" | "trip" | "custom";

function hoursUntil(iso: string): number {
  const h = Math.ceil((new Date(iso).getTime() - Date.now()) / 3_600_000);
  return Math.min(72, Math.max(1, h));
}
function hoursUntilEndOfToday(): number {
  const end = new Date();
  end.setHours(23, 59, 0, 0);
  return Math.min(72, Math.max(1, Math.ceil((end.getTime() - Date.now()) / 3_600_000)));
}

export function ShareControl({
  itineraryId,
  isWork,
  shares,
  arriveIso,
  multiDay,
}: {
  itineraryId: string;
  isWork: boolean;
  shares: ShareVM[];
  arriveIso?: string | null; // the day's/trip's final stop — "until I arrive"
  multiDay?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [recipient, setRecipient] = useState("");
  const [scope, setScope] = useState<ShareScope>(arriveIso ? "arrive" : "today");
  const [customHours, setCustomHours] = useState(4);
  const [error, setError] = useState<string | null>(null);

  // Resolve the chosen scope to the hours the share lasts + a human label.
  function scopeHours(s: ShareScope): number {
    if (s === "arrive" && arriveIso) return hoursUntil(arriveIso);
    if (s === "trip" && arriveIso) return hoursUntil(arriveIso);
    if (s === "today") return hoursUntilEndOfToday();
    return customHours;
  }
  const hours = scopeHours(scope);
  const [liveToken, setLiveToken] = useState<string | null>(null); // a share we're actively broadcasting to this session
  const watchId = useRef<number | null>(null);

  const active = shares.filter((s) => !s.revoked);
  const broadcastingShare = liveToken ? active.find((s) => s.token === liveToken) ?? null : null;
  const broadcasting = !!broadcastingShare;

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
    <section className="cc-share">
      <div className="cc-share-head"><span className="cc-eyebrow">Share &amp; tell</span></div>

      {/* Compose-message — handed to the OS share sheet */}
      <div className="cc-share-tell">
        <button type="button" onClick={() => compose("Running about 15 minutes late — start without me, I'll be there as soon as I can.")}>Running late</button>
        <button type="button" data-tone="safe" onClick={() => compose("Arrived safely.")}>Arrived safely</button>
        <button type="button" onClick={() => compose("On my way — see you soon.")}>On my way</button>
      </div>

      {/* The trust anchor — kept visible, never collapsed */}
      <p className="cc-share-employer">
        {isWork ? <>Your workspace sees this work trip&rsquo;s status and ETA — <strong>never</strong> your <span className="never">live location</span>.</>
                : <>Your live location is <strong>yours</strong> — shared only with whom you choose, <span className="never">never a workspace</span>.</>}
      </p>

      {/* Personal tier — live location as a revocable, time-bounded gift */}
      <div className="cc-share-live" data-broadcasting={broadcasting ? "true" : "false"}>
        <span className="cc-share-live-eyebrow">Share live location</span>
        <span className="cc-share-live-note">A revocable, time-bounded gift to someone you choose.</span>
        {broadcasting ? (
          <div className="cc-share-broadcast">
            <span className="cc-share-broadcast-status">Broadcasting · <span className="who">{broadcastingShare?.recipient || "your link"}</span> <span className="until">until {broadcastingShare ? new Date(broadcastingShare.expiresAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : ""}</span></span>
            <button type="button" className="cc-share-sendlink" onClick={() => broadcastingShare && shareLink(broadcastingShare.token)}>Send link</button>
            <button type="button" className="cc-share-stop" onClick={() => broadcastingShare && revoke(broadcastingShare.id)}>Stop</button>
          </div>
        ) : (
          <div className="cc-share-live-form">
            <input className="cc-field" placeholder="Share with (e.g. Mum)" value={recipient} onChange={(e) => setRecipient(e.target.value)} />
            {/* Scope — tied to this journey, not a bare timer */}
            <span className="cc-share-scope">
              {arriveIso ? (
                <button type="button" data-active={scope === "arrive" ? "true" : "false"} onClick={() => setScope("arrive")}>Until I arrive</button>
              ) : null}
              <button type="button" data-active={scope === "today" ? "true" : "false"} onClick={() => setScope("today")}>For today</button>
              {multiDay && arriveIso ? (
                <button type="button" data-active={scope === "trip" ? "true" : "false"} onClick={() => setScope("trip")}>For the trip</button>
              ) : null}
              <button type="button" data-active={scope === "custom" ? "true" : "false"} onClick={() => setScope("custom")}>Set hours</button>
            </span>
            {scope === "custom" ? (
              <span className="cc-share-dur">
                {[1, 2, 4, 8].map((h) => <button key={h} type="button" data-active={customHours === h ? "true" : "false"} onClick={() => setCustomHours(h)}>{h}h</button>)}
              </span>
            ) : null}
            <span className="cc-share-scope-note">Ends {scope === "arrive" || scope === "trip" ? "when you arrive" : scope === "today" ? "end of today" : `in ${customHours}h`} · about {hours}h. You can stop it any time.</span>
            <button type="button" className="cc-share-go" onClick={startShare} disabled={pending}>Share live location</button>
          </div>
        )}
      </div>
      {error ? <p className="cc-share-error">{error}</p> : null}

      {active.length > 0 ? (
        <ul className="cc-share-list">
          {active.map((s) => (
            <li key={s.id} className="cc-share-row">
              <span className="cc-share-row-who">{s.recipient || "Anyone with the link"}</span>
              <span className="cc-share-row-meta">
                {liveToken === s.token ? "broadcasting" : s.lastAt ? `last sent ${new Date(s.lastAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : "ready"} · until {new Date(s.expiresAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
              </span>
              <button type="button" className="cc-share-link" onClick={() => shareLink(s.token)}>Send link</button>
              <button type="button" className="cc-share-revoke" onClick={() => revoke(s.id)}>Stop</button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
