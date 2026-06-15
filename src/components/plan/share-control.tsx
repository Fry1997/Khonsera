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
            <span className="cc-share-dur">
              {[1, 2, 4, 8].map((h) => <button key={h} type="button" data-active={hours === h ? "true" : "false"} onClick={() => setHours(h)}>{h}h</button>)}
            </span>
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
