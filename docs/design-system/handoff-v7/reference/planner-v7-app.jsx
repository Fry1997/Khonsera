/* ════════════════════════════════════════════════════════════════════════
 * Khonsera · Planner v6 — spine + app shell + render  ·  "Soft Widget"
 * ONE material language end to end: every card is a soft-extruded tile on the
 * calm ground; read-outs are pressed wells; wayfinding numbers are crisp
 * charcoal badges; charcoal is the punctuation, gold a single dot. The boarding
 * pass is the reference for credentials. No shiny gold buttons anywhere.
 * ════════════════════════════════════════════════════════════════════════ */
const { StatusBar, Header, NowHero, summarise, MODE_ICON, MODE_WORD, RISK, Badge, Field } = window.PlannerV6Chrome;
const W = window.W;

const RAIL = 33;          // x of the rail line within the spine
const NODE = 40;          // place node diameter
const PAD = 70;           // content indent clearing the rail

/* shared atoms ───────────────────────────────────────────────────────────── */
// embossed face — a convex swell (light top → darker bottom) with a bright inner
// top lip and a soft inner bottom shadow, so the card surface itself has relief
const tile = { position: "relative", background: "var(--widget)", border: "1px solid var(--line)", borderRadius: W.r.tile, boxShadow: "var(--lift)" };
const wellRow = { display: "flex", alignItems: "center", gap: 11, width: "100%", padding: "11px 13px", borderRadius: W.r.inner, background: "var(--well)", border: "1px solid var(--line-soft)", color: "var(--ink-2)", fontSize: 12.5, fontWeight: 500, cursor: "pointer", marginTop: 9, fontFamily: "var(--sans)", boxShadow: "var(--sink)" };
const optTile = { display: "flex", alignItems: "center", gap: 11, width: "100%", padding: "12px 13px", borderRadius: W.r.inner, background: "var(--widget)", border: "1px solid var(--line)", cursor: "pointer", fontFamily: "var(--sans)", boxShadow: "var(--lift-sm)" };
const tagWork = { fontFamily: "var(--mono)", fontSize: 8, fontWeight: 600, letterSpacing: "0.12em", color: "var(--slate-2)", background: "var(--slate-soft)", padding: "3px 6px", borderRadius: 6, flex: "none" };
const eyb = { fontFamily: "var(--mono)", fontSize: 8, fontWeight: 500, letterSpacing: "0.16em", textTransform: "uppercase" };

/* ── icon chip — soft-extruded mini tile; charcoal = emphasis ───────────── */
const CHIP = {
  soft: { bg: "var(--widget-2)", fg: "var(--ink-2)", lift: true },
  char: { bg: W.char, fg: W.cream, lift: false },
  gold: { bg: "var(--gold-tint)", fg: "var(--gold-2)", lift: true },
  slate: { bg: "var(--slate-soft)", fg: "var(--slate-2)", lift: true },
  sage: { bg: "var(--sage-soft)", fg: "var(--sage)", lift: true },
  rust: { bg: "var(--rust-soft)", fg: "var(--rust)", lift: true },
  plum: { bg: "var(--plum-soft)", fg: "var(--plum)", lift: true },
};
function Chip({ icon, tone = "soft", size = 36 }) {
  const t = CHIP[tone] || CHIP.soft;
  return <span style={{ display: "inline-grid", placeItems: "center", width: size, height: size, borderRadius: Math.round(size * 0.32), background: t.bg, color: t.fg, flex: "none",
    boxShadow: t.lift ? "var(--lift-sm)" : "inset 0 1px 0 rgba(255,255,255,0.1), 0 2px 5px rgba(28,22,14,0.3)" }}><Icon name={icon} size={Math.round(size * 0.5)} /></span>;
}

/* ── labelled facts grid — boarding-pass read-outs ──────────────────────── */
function StubGrid({ cells, pad = "13px 18px 15px", cols }) {
  const n = cols || cells.length;
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${n}, 1fr)`, gap: 9, padding: pad }}>
      {cells.map(([label, v, badge], i) => (
        <div key={i} style={{ minWidth: 0 }}>
          <div style={{ ...eyb, color: "var(--ink-faint)", marginBottom: 5 }}>{label}</div>
          {badge
            ? <Badge>{v || "—"}</Badge>
            : <div className="mono engr" style={{ fontSize: 14, fontWeight: 600, color: v ? "var(--ink)" : "var(--ink-faint)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v || "—"}</div>}
        </div>
      ))}
    </div>
  );
}

/* ── perforation with notch cut-outs — only on real credentials ─────────── */
function Perf({ m = 0 }) {
  return (
    <div style={{ position: "relative", height: 1, margin: `0 ${m}px` }}>
      <div style={{ position: "absolute", left: 14, right: 14, top: 0, borderTop: "1.5px dashed var(--line)" }} />
      <div style={{ position: "absolute", top: -8, left: -8, width: 16, height: 16, borderRadius: 999, background: "var(--screen)", boxShadow: "var(--sink)" }} />
      <div style={{ position: "absolute", top: -8, right: -8, width: 16, height: 16, borderRadius: 999, background: "var(--screen)", boxShadow: "var(--sink)" }} />
    </div>
  );
}

/* ── right-aligned time block (card header) ─────────────────────────────── */
function TimeBlock({ w }) {
  if (!w) return null;
  let label = null, time = null, gold = false;
  if (w.leaveBy) { label = "LEAVE BY"; time = w.leaveBy; gold = true; }
  else if (w.from && w.to) { label = "SHIFT"; time = w.from + "\u2009\u2013\u2009" + w.to; }
  else if (w.arrive && w.leave) { return null; }
  else if (w.arrive) { label = "ARRIVE"; time = w.arrive; }
  if (!time) return null;
  return (
    <div style={{ textAlign: "right", flex: "none" }}>
      <div style={{ ...eyb, color: "var(--ink-faint)", marginBottom: 3 }}>{label}</div>
      <div className="mono engr" style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--ink)" }}>{time}</div>
    </div>
  );
}

/* ── rail node — charcoal punctuation for places, soft tile for transit ─── */
function Node({ icon, kind }) {
  const filled = kind === "place";
  const sz = filled ? NODE : 30;
  return (
    <div style={{
      position: "absolute", left: RAIL - sz / 2, top: 15, width: sz, height: sz, borderRadius: 999,
      display: "grid", placeItems: "center", zIndex: 2,
      background: filled ? "linear-gradient(168deg, #2b2f38, #1b1e24)" : "var(--well)",
      color: filled ? "#f3efe6" : "var(--ink-dim)",
      border: filled ? "3px solid var(--screen)" : "1px solid var(--line)",
      boxShadow: filled
        ? "inset 0 2px 5px rgba(0,0,0,0.55), inset 0 -1px 0 rgba(255,255,255,0.08)"
        : "inset 2px 3px 6px rgba(54,44,30,0.16), inset -2px -2px 5px rgba(255,255,255,0.7)",
    }}>
      <Icon name={icon} size={filled ? 19 : 15} />
    </div>
  );
}

const PersonalDot = () => <span title="Personal" style={{ width: 6, height: 6, borderRadius: 999, background: "var(--plum)", flex: "none", display: "inline-block" }} />;
const compactSeat = s => s ? s.replace(/coach\s*/i, "").replace(/\s*·\s*/, "·") : s;

/* ════════════════════════════════ TASK ROW ════════════════════════════════ */
const TASK_META = {
  call: { icon: "phone", tone: "gold", verb: "Call" },
  video: { icon: "video", tone: "gold", verb: "Join" },
  prep: { icon: "file", tone: "slate" },
  errand: { icon: "gift", tone: "slate" },
  note: { icon: "receipt", tone: "soft" },
  scan: { icon: "scan", tone: "gold" },
  walk: { icon: "walk", tone: "soft" },
};
function TaskRow({ t, view, onTicket }) {
  const [done, setDone] = useState(false);
  if (view === "work" && t.scope === "personal") return null;
  const m = TASK_META[t.type] || { icon: "check", tone: "soft" };
  const auto = t.auto || (t.tag && /auto|required|barrier/i.test(t.tag));
  const actionable = (t.type === "call" || t.type === "video") && !done;

  // auto/required task — a system fact in a pressed well with a scan affordance
  if (auto) {
    return (
      <button onClick={() => onTicket && onTicket({ kind: t.credentialKind || "Pass", ref: t.ref || "—", lines: t.lines || [t.label], code: t.code || "qr" })}
        style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", padding: "10px 11px", marginTop: 9, borderRadius: 13, background: "var(--well)", border: "1px solid var(--line-soft)", boxShadow: "var(--sink)", cursor: "pointer", fontFamily: "var(--sans)" }}>
        <Chip icon={m.icon === "check" ? "shieldCheck" : m.icon} tone="char" size={30} />
        <div style={{ minWidth: 0, flex: 1, textAlign: "left" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.label}</div>
          <div style={{ ...eyb, color: "var(--ink-dim)", marginTop: 3 }}>AUTO · REQUIRED</div>
        </div>
        <span className="mono" style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: "0.08em", color: "var(--ink-dim)", flex: "none" }}>SCAN</span>
      </button>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 2px", borderTop: "1px solid var(--line-soft)" }}>
      <button onClick={() => setDone(d => !d)} style={{
        width: 21, height: 21, borderRadius: 7, flex: "none", cursor: "pointer", padding: 0,
        border: done ? "none" : "1.5px solid var(--line)", background: done ? "var(--sage)" : "var(--widget)",
        color: "#fff", display: "grid", placeItems: "center",
        boxShadow: done ? "none" : "var(--sink)",
      }}>{done && <Icon name="check" size={12} sw={2.6} />}</button>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontSize: 13.5, fontWeight: 450, letterSpacing: "-0.005em", color: done ? "var(--ink-faint)" : "var(--ink-2)", textDecoration: done ? "line-through" : "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.label}</span>
          {t.scope === "personal" && <PersonalDot />}
        </div>
        {t.tag && <div className="mono" style={{ fontSize: 9.5, color: "var(--ink-faint)", marginTop: 2, letterSpacing: "0.02em" }}>{t.tag}</div>}
      </div>
      {actionable
        ? <button className="pg-d" style={joinBtn}><Icon name={m.icon} size={12} />{m.verb}</button>
        : t.at ? <span className="mono" style={{ fontSize: 11.5, color: "var(--ink-dim)", flex: "none" }}>{t.at}</span>
        : <span style={{ color: "var(--ink-faint)", flex: "none" }}><Icon name={m.icon} size={13} /></span>}
    </div>
  );
}
const joinBtn = { display: "inline-flex", alignItems: "center", gap: 5, height: 28, padding: "0 12px", borderRadius: 9, border: "none", background: W.char, color: W.cream, fontSize: 11.5, fontWeight: 600, cursor: "pointer", flex: "none", fontFamily: "var(--sans)", boxShadow: "0 1px 3px rgba(28,22,14,0.3)" };
const navBtn = { display: "inline-flex", alignItems: "center", gap: 5, height: 30, padding: "0 12px", borderRadius: 10, border: "none", background: "var(--char)", color: W.cream, fontSize: 12, fontWeight: 600, letterSpacing: "0.01em", cursor: "pointer", flex: "none", fontFamily: "var(--sans)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12), 0 1px 2px rgba(28,22,14,0.3), 0 4px 10px -3px rgba(28,22,14,0.4)" };

function TaskList({ todos, view, onTicket, label = "TASKS HERE" }) {
  if (!todos.length) return null;
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ ...eyb, color: "var(--ink-faint)", margin: "12px 0 3px" }}>{label}</div>
      {todos.map((t, i) => <TaskRow key={i} t={t} view={view} onTicket={onTicket} />)}
    </div>
  );
}

/* ════════════════════════════════ PLACE ════════════════════════════════ */
function PlaceCard({ stop, view, dimmed, onTicket }) {
  const [open, setOpen] = useState(false);
  const todos = (stop.todos || []).filter(t => view === "work" ? t.scope !== "personal" : true);
  const hasDetail = todos.length || stop.transit || stop.stay || stop.credential;
  const work = stop.scope === "work" || stop.role === "work";
  const w = stop.window;
  const stopDur = w && w.arrive && w.leave ? diff(w.arrive, w.leave) : null;
  return (
    <div style={{ position: "relative", paddingLeft: PAD, paddingBottom: 15, opacity: dimmed ? 0.5 : 1 }}>
      <Node icon={stop.icon} kind="place" />
      <div className="pg" style={{ ...tile, overflow: "hidden" }}>
        <div onClick={() => hasDetail && setOpen(o => !o)} style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "15px 16px", cursor: hasDetail ? "pointer" : "default" }}>
          <Chip icon={stop.icon} tone={work ? "slate" : "soft"} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.024em", color: "var(--ink)", lineHeight: 1.15 }}>{stop.name}</div>
            <div style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 4, lineHeight: 1.35 }}>{stop.area}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flex: "none" }}>
            <TimeBlock w={w} />
            {work && <span style={tagWork}>WORK</span>}
            {hasDetail && <span style={{ color: "var(--ink-faint)" }}><Icon name="chevron" size={15} sw={2} /></span>}
          </div>
        </div>
        {stopDur ? (
          <div style={{ margin: "0 16px 15px", display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", borderRadius: 13, background: "var(--well)", boxShadow: "var(--sink)" }}>
            <div style={{ textAlign: "left", flex: "none" }}>
              <div className="mono engr" style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--ink)" }}>{w.arrive}</div>
              <div style={{ ...eyb, color: "var(--ink-faint)", marginTop: 3 }}>ARRIVE</div>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, minWidth: 0 }}>
              <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--ink-dim)", whiteSpace: "nowrap", letterSpacing: "0.01em" }}>{stopDur} here</span>
              <div style={{ width: "100%", height: 1, background: "linear-gradient(90deg, transparent, var(--line), var(--line), transparent)" }}></div>
            </div>
            <div style={{ textAlign: "right", flex: "none" }}>
              <div className="mono engr" style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--ink)" }}>{w.leave}</div>
              <div style={{ ...eyb, color: "var(--ink-faint)", marginTop: 3 }}>DEPART</div>
            </div>
          </div>
        ) : stop.protected && (
          <div style={{ margin: "0 16px 15px", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 13, background: "var(--well)", boxShadow: "var(--sink)" }}>
            <span style={{ color: "var(--ink-dim)" }}><Icon name="clock" size={15} /></span>
            <span style={{ fontSize: 11.5, fontWeight: 500, color: "var(--ink-2)", flex: 1 }}>{stop.protected.mins} min before {stop.protected.covers}</span>
          </div>
        )}
        {open && hasDetail && (
          <>
            <Perf />
            <div style={{ padding: "13px 16px 15px", animation: "fadeIn .2s ease" }}>
              {stopDur && <StubGrid pad="0 0 13px" cells={[["ARRIVE", w.arrive], ["LEAVE", w.leave], ["ON SITE", stopDur]]} />}
              {stop.transit && stop.transit.ticket && (
                <CredButton icon="ticket" title={`${stop.transit.ticket.class} · ${stop.transit.ticket.from}→${stop.transit.ticket.to}`} meta={stop.transit.platform ? `Plat ${stop.transit.platform}` : null}
                  onClick={() => onTicket({ kind: "Ticket", ref: stop.transit.ticket.ref || "—", lines: [stop.transit.ticket.class, `${stop.transit.ticket.from} → ${stop.transit.ticket.to}`].filter(Boolean), code: "qr" })} />
              )}
              {stop.stay && <StayActions stay={stop.stay} onTicket={onTicket} cred={stop.credential} />}
              {stop.credential && !stop.stay && (
                <CredButton icon="ticket" title={`${stop.credential.kind} · ${stop.credential.ref}`}
                  onClick={() => onTicket({ kind: stop.credential.kind, ref: stop.credential.ref, lines: stop.credential.lines, code: stop.credential.code || "qr" })} />
              )}
              <TaskList todos={todos} view={view} onTicket={onTicket} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function CredButton({ icon, title, meta, onClick }) {
  return (
    <button onClick={onClick} style={wellRow}>
      <Chip icon={icon} tone="char" size={30} />
      <span style={{ flex: 1, textAlign: "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "var(--ink)", fontWeight: 600 }}>{title}</span>
      {meta && <span className="mono" style={{ fontSize: 11, color: "var(--ink-dim)", flex: "none" }}>{meta}</span>}
      <span style={{ color: "var(--ink-faint)", flex: "none" }}><Icon name="chevron" size={14} /></span>
    </button>
  );
}

function StayActions({ stay, onTicket, cred }) {
  return (
    <div>
      {cred && <CredButton icon="bed" title={`${cred.kind} · ${cred.ref}`} onClick={() => onTicket({ kind: cred.kind, ref: cred.ref, lines: cred.lines, code: cred.code || "qr" })} />}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginTop: 9 }}>
        {stay.actions.map((a, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 11px", borderRadius: 14, background: "var(--widget-2)", border: "1px solid var(--line-soft)", boxShadow: "var(--lift-sm)" }}>
            <Chip icon={a.icon} tone={a.state === "available" ? "gold" : "soft"} size={28} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.label}</div>
              <div className="mono" style={{ fontSize: 9, color: "var(--ink-faint)", marginTop: 1 }}>{a.when}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════ TRANSIT ═════════════════════════════════ */
function TransitCard({ leg, kind, view, onTicket }) {
  const [open, setOpen] = useState(false);
  const rail = kind === "rail", flight = kind === "flight";
  const icon = rail ? "train" : flight ? "plane" : (MODE_ICON[leg.mode] || "walk");
  const todos = (leg.todos || []).filter(t => view === "work" ? t.scope !== "personal" : true);
  const big = rail || flight;

  if (!big) {
    // walk / drive / taxi — a JOURNEY leg. A crisp, defined tile (not the old
    // low-contrast connector): mode + duration headline, the destination it
    // delivers you to, and a charcoal Navigate pill — the affordance every
    // journey earns. Tasks done en route expand beneath.
    const expandable = todos.length > 0;
    const modeWord = MODE_WORD[leg.mode] || "Go";
    const dest = leg.to || (leg.label || "").replace(/^(walk|drive|taxi|coach|go)\s+(to|back to)\s+/i, "");
    return (
      <div style={{ position: "relative", paddingLeft: PAD, paddingBottom: 12 }}>
        <Node icon={icon} kind="transit" />
        <div className="pg" style={{ ...tile, overflow: "hidden" }}>
          <div onClick={() => expandable && setOpen(o => !o)} style={{ display: "flex", alignItems: "center", gap: 13, padding: "13px 14px", cursor: expandable ? "pointer" : "default" }}>
            <Chip icon={icon} tone="soft" size={38} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 9, flexWrap: "nowrap" }}>
                <span style={{ fontSize: 14.5, fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.015em", flex: "none" }}>{modeWord}</span>
                <span className="mono" style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ink-dim)", whiteSpace: "nowrap", flex: "none" }}>{durLabel(leg.mins)}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 3, fontSize: 12, color: "var(--ink-dim)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                <span style={{ color: "var(--ink-faint)", flex: "none" }}><Icon name="arrowRight" size={11} sw={2.2} /></span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{dest}</span>
              </div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); }} className="pg-d" style={navBtn}><Icon name="navigation" size={12} />Navigate</button>
          </div>
          {open && todos.length > 0 && (
            <div style={{ padding: "0 14px 12px 16px", animation: "fadeIn .2s ease" }}>
              <TaskList todos={todos} view={view} onTicket={onTicket} label="WHILE ON THE MOVE" />
            </div>
          )}
        </div>
      </div>
    );
  }

  // rail / flight — the boarding-pass credential
  const fromCode = leg.fromCode || leg.from, toCode = leg.toCode || leg.to;
  const pass = leg.pass, ticket = leg.ticket;
  const cells = flight
    ? [["DEPART", leg.from], ["BOARDS", leg.boarding], ["GATE", leg.gate, true], ["SEAT", leg.seat, true]]
    : [["DEPART", leg.from], ["ARRIVE", leg.to], ["PLATFORM", leg.platform, true], ["SEAT", compactSeat(leg.seat), true]];
  return (
    <div style={{ position: "relative", paddingLeft: PAD, paddingBottom: 15 }}>
      <Node icon={icon} kind="transit" />
      <div className="pg" style={{ ...tile, overflow: "hidden" }}>
        <div onClick={() => setOpen(o => !o)} style={{ cursor: "pointer" }}>
          {/* charcoal operator strip */}
          <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", background: "linear-gradient(168deg, #2b2f38, #1f2228)", color: W.cream, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 10px -3px rgba(28,22,14,0.4)" }}>
            <span style={{ display: "inline-grid", placeItems: "center", width: 24, height: 24, borderRadius: 8, background: "rgba(243,239,230,0.1)", color: W.cream, flex: "none" }}><Icon name={icon} size={14} /></span>
            <span style={{ ...eyb, fontSize: 9, letterSpacing: "0.22em", flex: "none", color: W.cream }}>{flight ? "FLIGHT" : "RAIL"}</span>
            <span style={{ flex: 1, textAlign: "right", fontSize: 10.5, color: W.creamDim, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{leg.line || leg.airline}</span>
          </div>
          {/* code endpoints */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "18px 18px 15px" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 36, fontWeight: 300, letterSpacing: "0.01em", color: "var(--ink)", lineHeight: 0.9, textShadow: "0 1px 0 rgba(255,255,255,0.9)" }}>{fromCode}</div>
              <div style={{ fontSize: 11, color: "var(--ink-dim)", marginTop: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textShadow: "0 1px 0 rgba(255,255,255,0.85)" }}>{leg.fromName}</div>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, paddingTop: 12 }}>
              <span style={{ color: "var(--ink-faint)", filter: "drop-shadow(0 1px 0 rgba(255,255,255,0.9))" }}><Icon name="arrowRight" size={17} /></span>
              <span className="mono" style={{ fontSize: 9.5, color: "var(--ink-faint)", letterSpacing: "0.06em" }}>{durLabel(leg.mins)}</span>
            </div>
            <div style={{ minWidth: 0, textAlign: "right" }}>
              <div style={{ fontSize: 36, fontWeight: 300, letterSpacing: "0.01em", color: "var(--ink)", lineHeight: 0.9, textShadow: "0 1px 0 rgba(255,255,255,0.9)" }}>{toCode}</div>
              <div style={{ fontSize: 11, color: "var(--ink-dim)", marginTop: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textShadow: "0 1px 0 rgba(255,255,255,0.85)" }}>{leg.toName}</div>
            </div>
          </div>
          <Perf />
          <StubGrid cells={cells} />
        </div>
        {open && (
          <div style={{ padding: "0 16px 15px", animation: "fadeIn .2s ease" }}>
            {(pass || ticket) && (
              <CredButton icon="scan" title={`${flight ? "Boarding pass" : "Show ticket"} · ${(pass || ticket).ref}`}
                onClick={() => onTicket(flight
                  ? { kind: "Boarding pass", ref: pass.ref, fromCode, toCode, fromName: leg.fromName, toName: leg.toName, lines: [`Seat ${pass.seat}`, `Gate ${pass.gate}`, `Boards ${pass.boarding}`, pass.class], code: "bar" }
                  : { kind: "Ticket", ref: ticket.ref, fromCode, toCode, fromName: leg.fromName, toName: leg.toName, lines: [ticket.class, leg.platform ? `Platform ${leg.platform}` : null].filter(Boolean), code: "qr" })} />
            )}
            {leg.offline && <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 11, fontSize: 10.5, color: "var(--ink-dim)" }}><Icon name="check" size={12} /> Saved for offline</div>}
            <TaskList todos={todos} view={view} onTicket={onTicket} label="WHILE ABOARD" />
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════ CHANGEOVER ══════════════════════════════
 * A soft tile with a single tinted accent edge — states the changeover time
 * and which platform you arrive into vs depart from. No "need/have" maths. */
function Changeover({ co }) {
  const r = RISK[co.risk] || RISK.tight;
  const tone = co.risk === "comfortable" ? "sage" : co.risk === "risky" ? "rust" : "gold";
  return (
    <div style={{ position: "relative", paddingLeft: PAD, paddingBottom: 13 }}>
      <div style={{ position: "absolute", left: RAIL - 10, top: 13, width: 20, height: 20, borderRadius: 999, background: "var(--widget)", border: `3px solid ${r.c}`, zIndex: 2, boxShadow: "var(--lift-sm)" }} />
      <div className="pg" style={{ ...tile, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 15px" }}>
          <Chip icon="swap" tone={tone} size={32} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.01em" }}>Change at {co.at}</div>
            <div style={{ ...eyb, color: r.c, marginTop: 3 }}>{r.label}</div>
          </div>
          <div style={{ textAlign: "right", flex: "none" }}>
            <div className="mono" style={{ fontSize: 19, fontWeight: 600, color: r.c, lineHeight: 1 }}>{co.available}m</div>
            <div style={{ ...eyb, color: "var(--ink-faint)", marginTop: 3 }}>TO CHANGE</div>
          </div>
        </div>
        <div style={{ borderTop: "1px solid var(--line-soft)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, padding: "12px 15px 13px" }}>
          <div><div style={{ ...eyb, color: "var(--ink-faint)", marginBottom: 5 }}>ARRIVE INTO</div><Badge>{co.from}</Badge></div>
          <div><div style={{ ...eyb, color: "var(--ink-faint)", marginBottom: 5 }}>DEPART FROM</div><Badge>{co.to}</Badge></div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════ GAP ═════════════════════════════════
 * A soft tile, distinguished as "open time" by a dashed rail spur and a tinted
 * chip — not a heavy colour band. Options are soft sub-tiles. */
const GAP_TONE = {
  spare: ["var(--gold-2)", "gold", "sparkle"], risky: ["var(--rust)", "rust", "alert"],
  usable: ["var(--sage)", "sage", "zap"], waiting: ["var(--slate)", "slate", "clock"],
  idle: ["var(--ink-dim)", "soft", "clock"], detour: ["var(--gold-2)", "gold", "compass"],
  open: ["var(--ink-dim)", "soft", "clock"], route: ["var(--slate)", "slate", "route"],
};
function GapBand({ gap }) {
  const tone = GAP_TONE[gap.type] || GAP_TONE.open;
  const isRoute = gap.type === "route" || (gap.options && !gap.type);
  return (
    <div style={{ position: "relative", paddingLeft: PAD, paddingBottom: 14 }}>
      <div style={{ position: "absolute", left: RAIL - 0.75, top: 0, bottom: 8, width: 1.5, background: `repeating-linear-gradient(var(--line) 0 4px, transparent 4px 9px)` }} />
      <div className="pg" style={{ padding: "14px 15px", borderRadius: W.r.tile, background: "var(--widget-2)", border: "1px dashed var(--line)", boxShadow: "var(--lift-sm)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Chip icon={isRoute ? "route" : tone[2]} tone={tone[1]} size={32} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ ...eyb, color: tone[0] }}>{isRoute ? "UNPLACED CONNECTION" : ((gap.type || "GAP") + (gap.where ? " · " + gap.where : "")).toUpperCase()}</div>
            <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 5, lineHeight: 1.35, textWrap: "pretty" }}>{gap.note}</div>
          </div>
          {gap.mins && <span className="mono" style={{ fontSize: 15, fontWeight: 600, color: tone[0], flex: "none" }}>{durLabel(gap.mins)}</span>}
        </div>
        {gap.options && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 13 }}>
            {gap.options.map((o, i) => (
              <button key={i} style={optTile}>
                <Chip icon={o.icon} tone="soft" size={30} />
                <span style={{ flex: 1, textAlign: "left", fontSize: 13, fontWeight: 600, color: "var(--ink)", minWidth: 0 }}>{o.label}<span style={{ color: "var(--ink-dim)", fontWeight: 400 }}> · {o.sub}</span></span>
                <span className="mono" style={{ fontSize: 11.5, color: "var(--ink-dim)", flex: "none" }}>{durLabel(o.mins)}{o.cost ? ` · ${o.cost}` : ""}</span>
              </button>
            ))}
            <button style={{ ...optTile, justifyContent: "center", borderStyle: "dashed", boxShadow: "none", background: "transparent", color: "var(--ink-dim)", fontSize: 12, fontWeight: 600 }}>Another way…</button>
          </div>
        )}
        {gap.stay && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 13 }}>
            {gap.stay.map((o, i) => (
              <button key={i} style={optTile}>
                <Chip icon={o.icon} tone="soft" size={28} />
                <span style={{ flex: 1, textAlign: "left", fontSize: 12.5, color: "var(--ink-2)", minWidth: 0 }}>{o.label}<span style={{ color: "var(--ink-faint)" }}> · {o.sub}</span></span>
                {o.fromUnplaced && <span className="mono" style={{ fontSize: 8.5, fontWeight: 600, color: "var(--gold-2)", background: "var(--gold-tint)", padding: "3px 7px", borderRadius: 6, flex: "none" }}>FROM INBOX</span>}
              </button>
            ))}
          </div>
        )}
        {gap.cta && <button style={{ ...optTile, justifyContent: "center", marginTop: 11, color: tone[0], fontWeight: 600, fontSize: 12.5, background: "transparent", boxShadow: "none", borderStyle: "dashed" }}>{gap.cta}</button>}
      </div>
    </div>
  );
}

/* ════════════════════════════ CONTAINER ═══════════════════════════════ */
function Container({ c, view, onTicket }) {
  return (
    <div style={{ position: "relative", paddingLeft: 14, paddingBottom: 15 }}>
      <div className="pg" style={{ borderRadius: 26, border: "1px solid var(--line)", background: "var(--widget-2)", padding: "15px 12px 7px", boxShadow: "var(--lift)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "0 4px 13px" }}>
          <Chip icon="briefcase" tone="char" />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.022em", color: "var(--ink)" }}>{c.name}</div>
            <div style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 4 }}>{c.area}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flex: "none" }}>
            <TimeBlock w={c.window} />
            <span style={tagWork}>WORK</span>
          </div>
        </div>
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", left: RAIL, top: 15, bottom: 8, width: 1.5, background: "var(--line)" }} />
          {c.children.map((ch, i) => ch.place
            ? <PlaceCard key={i} stop={ch.place} view={view} onTicket={onTicket} />
            : <TransitCard key={i} leg={ch.move[0]} kind={ch.move[0].mode === "rail" ? "rail" : "move"} view={view} onTicket={onTicket} />)}
        </div>
        {c.generates && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, padding: "11px 4px 5px", borderTop: "1px solid var(--line-soft)" }}>
            {c.generates.map((g, i) => <span key={i} className="mono" style={{ fontSize: 9.5, color: "var(--ink-dim)", background: "var(--well)", padding: "5px 10px", borderRadius: 8, boxShadow: "var(--sink)" }}>{g}</span>)}
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════ SPINE ═══════════════════════════════ */
function Spine({ day, view, onTicket }) {
  return (
    <div style={{ position: "relative", padding: "2px 16px 20px" }}>
      <div style={{ position: "absolute", left: 16 + RAIL - 0.75, top: 26, bottom: 30, width: 1.5, background: "var(--line)", zIndex: 0 }} />
      {day.stops.map((s, i) => {
        const dim = day.nowAfter != null && i < day.nowAfter;
        if (s.container) return <Container key={i} c={s.container} view={view} onTicket={onTicket} />;
        if (s.move) return s.move.map((leg, j) => <TransitCard key={i + "-" + j} leg={leg} kind="move" view={view} onTicket={onTicket} />);
        if (s.rail) return <TransitCard key={i} leg={s.rail} kind="rail" view={view} onTicket={onTicket} />;
        if (s.flight) return <TransitCard key={i} leg={s.flight} kind="flight" view={view} onTicket={onTicket} />;
        if (s.changeover) return <Changeover key={i} co={s.changeover} />;
        if (s.gap) return <GapBand key={i} gap={s.gap} />;
        return <PlaceCard key={i} stop={s} view={view} dimmed={dim} onTicket={onTicket} />;
      })}
    </div>
  );
}

/* ════════════════════════════ TICKET SHEET ════════════════════════════ */
function TicketSheet({ data, onClose }) {
  const code = data.code || "qr";
  const hasCodes = data.fromCode && data.toCode;
  return (
    <div onClick={onClose} style={{ position: "absolute", inset: 0, zIndex: 60, background: "rgba(20,16,12,0.5)", backdropFilter: "blur(3px)", display: "flex", alignItems: "flex-end" }}>
      <div onClick={e => e.stopPropagation()} className="pg-d" style={{ width: "100%", background: "var(--char)", borderRadius: "20px 20px 0 0", padding: "10px 0 26px", animation: "sheetUp .32s cubic-bezier(.2,.8,.2,1)" }}>
        <div style={{ width: 38, height: 4, borderRadius: 999, background: "rgba(243,239,230,0.2)", margin: "0 auto 16px" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px 16px" }}>
          <span style={{ ...eyb, fontSize: 9.5, letterSpacing: "0.22em", color: W.creamDim }}>{data.kind}</span>
          <span className="mono" style={{ fontSize: 11, color: W.creamDim }}>{data.ref}</span>
        </div>
        {hasCodes && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "0 24px 18px" }}>
            <div style={{ minWidth: 0 }}>
              <div className="engr-d" style={{ fontSize: 40, fontWeight: 300, color: W.cream, lineHeight: 0.9 }}>{data.fromCode}</div>
              <div style={{ fontSize: 11, color: W.creamDim, marginTop: 6 }}>{data.fromName}</div>
            </div>
            <div style={{ flex: 1, display: "flex", justifyContent: "center", paddingTop: 14, color: W.creamDim }}><Icon name="arrowRight" size={18} /></div>
            <div style={{ minWidth: 0, textAlign: "right" }}>
              <div className="engr-d" style={{ fontSize: 40, fontWeight: 300, color: W.cream, lineHeight: 0.9 }}>{data.toCode}</div>
              <div style={{ fontSize: 11, color: W.creamDim, marginTop: 6 }}>{data.toName}</div>
            </div>
          </div>
        )}
        <div style={{ position: "relative", height: 1, margin: "0 18px" }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: 0, borderTop: "1.5px dashed rgba(243,239,230,0.22)" }} />
          <div style={{ position: "absolute", top: -9, left: -33, width: 18, height: 18, borderRadius: 999, background: "var(--ground)" }} />
          <div style={{ position: "absolute", top: -9, right: -33, width: 18, height: 18, borderRadius: 999, background: "var(--ground)" }} />
        </div>
        <div style={{ background: "#f3efe6", borderRadius: 18, padding: 22, margin: "18px 24px", display: "grid", placeItems: "center" }}>
          {code === "bar"
            ? <div style={{ display: "flex", gap: 2, height: 84, alignItems: "stretch" }}>{Array.from({ length: 46 }).map((_, i) => <div key={i} style={{ width: (i % 5 === 0 ? 3.5 : i % 3 === 0 ? 1.2 : 2), background: "#1b1e24" }} />)}</div>
            : <div style={{ width: 128, height: 128, background: "repeating-conic-gradient(#1b1e24 0% 25%, #f3efe6 0% 50%)", backgroundSize: "13px 13px", borderRadius: 10, position: "relative" }}><div style={{ position: "absolute", inset: "38%", background: "#f3efe6" }} /></div>}
        </div>
        <div style={{ padding: "0 24px" }}>
          {data.lines && data.lines.map((l, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderTop: i ? "1px solid rgba(243,239,230,0.08)" : "none", fontSize: 13, color: W.cream }}>{l}</div>
          ))}
          <button onClick={onClose} style={{ width: "100%", height: 47, marginTop: 16, borderRadius: 15, background: W.cream, color: W.char, border: "none", fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "var(--sans)" }}>Done</button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════ TABS ════════════════════════════════ */
const TABS = [["today", "compass", "Today"], ["prepare", "check", "Prepare"], ["wallet", "wallet", "Wallet"], ["trips", "route", "Trips"]];
function TabBar({ tab, setTab }) {
  return (
    <div style={{ flex: "none", display: "flex", padding: "9px 14px 14px", gap: 4, background: "rgba(239,235,226,0.9)", backdropFilter: "blur(18px) saturate(1.3)", borderTop: "1px solid var(--line-soft)" }}>
      {TABS.map(([id, ic, label]) => {
        const on = tab === id;
        return (
          <button key={id} onClick={() => setTab(id)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "7px 0", borderRadius: 14, background: on ? "var(--widget)" : "transparent", boxShadow: on ? "var(--lift-sm)" : "none", border: "none", cursor: "pointer", color: on ? "var(--ink)" : "var(--ink-faint)", fontFamily: "var(--sans)" }}>
            <Icon name={ic} size={20} />
            <span style={{ fontSize: 9.5, fontWeight: on ? 600 : 500, letterSpacing: "0.01em" }}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

function SoonTab({ icon, title, note }) {
  return (
    <div style={{ display: "grid", placeItems: "center", minHeight: 420, textAlign: "center", padding: 30 }}>
      <div>
        <div style={{ margin: "0 auto 18px", width: "fit-content" }}><Chip icon={icon} tone="soft" size={62} /></div>
        <div style={{ fontSize: 17, fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.02em" }}>{title}</div>
        <div style={{ fontSize: 13, color: "var(--ink-dim)", marginTop: 7, maxWidth: "26ch", lineHeight: 1.45 }}>{note}</div>
      </div>
    </div>
  );
}

/* ════════════════════════ SHARED PAGE HEAD ════════════════════════════ */
const iconChip2 = { width: 36, height: 36, borderRadius: 999, display: "grid", placeItems: "center", border: "none", background: "var(--widget)", color: "var(--ink-dim)", cursor: "pointer", boxShadow: "var(--lift-sm)", fontFamily: "var(--sans)" };
function PageHead({ eyebrow, title, sub, icon }) {
  return (
    <div style={{ padding: "2px 8px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 2, paddingBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 7, height: 7, borderRadius: 999, background: "var(--gold-2)", boxShadow: "0 0 0 3px var(--gold-tint)" }} />
          <span className="eyebrow" style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.34em", color: "var(--ink)" }}>KHONSERA</span>
        </div>
        <button style={iconChip2}><Icon name={icon} size={16} /></button>
      </div>
      <div className="eyebrow" style={{ fontSize: 9.5, letterSpacing: "0.2em", color: "var(--ink-faint)", marginBottom: 12 }}>{eyebrow}</div>
      <h1 style={{ margin: 0, fontSize: 25, fontWeight: 600, letterSpacing: "-0.035em", lineHeight: 1.05, color: "var(--ink)" }}>{title}</h1>
      {sub && <div style={{ marginTop: 7, fontSize: 13.5, color: "var(--ink-dim)", lineHeight: 1.4 }}>{sub}</div>}
    </div>
  );
}

/* ════════════════════ WALLET — derive every credential ════════════════ */
const stripStn = n => (n || "").replace(/\s*Station$/i, "");
function collectWallet(stops, out) {
  out = out || [];
  (stops || []).forEach(s => {
    if (s.container) collectWallet(s.container.children.map(ch => ch.place).filter(Boolean), out);
    if (s.rail) {
      const r = s.rail, tk = r.ticket || {};
      out.push({ group: "Travel", kind: "Rail ticket", icon: "train", title: `${r.fromCode} → ${r.toCode}`, sub: r.line, ref: tk.ref || "—",
        sheet: { kind: "Ticket", ref: tk.ref || "—", fromCode: r.fromCode, toCode: r.toCode, fromName: r.fromName, toName: r.toName, lines: [tk.class, r.platform ? `Platform ${r.platform}` : null, r.seat ? `Seat ${r.seat}` : null].filter(Boolean), code: tk.code || "qr" } });
    }
    if (s.flight) {
      const f = s.flight, p = f.pass || {};
      out.push({ group: "Travel", kind: "Boarding pass", icon: "plane", title: `${f.fromCode} → ${f.toCode}`, sub: f.airline, ref: p.ref || f.airline,
        sheet: { kind: "Boarding pass", ref: p.ref || "—", fromCode: f.fromCode, toCode: f.toCode, fromName: f.fromName, toName: f.toName, lines: [`Seat ${p.seat || f.seat}`, `Gate ${p.gate || f.gate}`, `Boards ${p.boarding || f.boarding}`, p.class].filter(Boolean), code: "bar" } });
    }
    if (s.credential) {
      const c = s.credential;
      const g = /hotel|booking|bed/i.test(c.kind) ? "Stays" : /reserv|table|theatre|seat|tickets/i.test(c.kind) ? "Tables & seats" : "Passes";
      out.push({ group: g, kind: c.kind, icon: s.icon || "ticket", title: s.name, sub: s.area, ref: c.ref,
        sheet: { kind: c.kind, ref: c.ref, lines: c.lines, code: c.code || "qr" } });
    }
  });
  return out;
}
function dayDocs(day) {
  const all = collectWallet(day.stops);
  const seen = new Set(), out = [];
  all.forEach(d => { const k = d.kind + "|" + d.ref; if (!seen.has(k)) { seen.add(k); out.push(d); } });
  return out;
}

function WalletCard({ d, onTicket }) {
  return (
    <button onClick={() => onTicket(d.sheet)} className="pg" style={{ ...tile, display: "flex", alignItems: "center", gap: 13, padding: "13px 14px", width: "100%", cursor: "pointer", textAlign: "left" }}>
      <Chip icon={d.icon} tone="char" size={40} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ ...eyb, color: "var(--ink-faint)", marginBottom: 4 }}>{d.kind}</div>
        <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.015em", color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.title}</div>
        <div style={{ fontSize: 11.5, color: "var(--ink-dim)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.sub}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 9, flex: "none" }}>
        <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-dim)" }}>{d.ref}</span>
        <span style={{ color: "var(--ink-faint)" }}><Icon name="chevron" size={15} /></span>
      </div>
    </button>
  );
}
function WalletPage({ day, onTicket }) {
  const docs = day.noWallet ? [] : dayDocs(day);
  if (!docs.length) return <SoonTab icon="wallet" title="Wallet" note="Tickets, passes and confirmations gather here, surfaced at the moment you need them. This day carries none." />;
  const groups = {};
  docs.forEach(d => (groups[d.group] = groups[d.group] || []).push(d));
  const order = ["Travel", "Stays", "Tables & seats", "Passes"];
  return (
    <div style={{ padding: "2px 16px 24px" }}>
      <PageHead eyebrow="Saved · offline-ready" title="Wallet" sub={`${docs.length} credential${docs.length > 1 ? "s" : ""} for this day`} icon="wallet" />
      {order.filter(g => groups[g]).map(g => (
        <div key={g} style={{ marginBottom: 18 }}>
          <div className="flank left" style={{ margin: "2px 2px 12px" }}>{g}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {groups[g].map((d, i) => <WalletCard key={i} d={d} onTicket={onTicket} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ════════════════════════ PREPARE — night before ══════════════════════ */
function PrepCheck({ t, first }) {
  const [done, setDone] = useState(false);
  return (
    <button onClick={() => setDone(d => !d)} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "11px 2px", borderTop: first ? "none" : "1px solid var(--line-soft)", background: "none", border: "none", borderTopStyle: first ? "none" : "solid", cursor: "pointer", fontFamily: "var(--sans)", textAlign: "left" }}>
      <span style={{ width: 22, height: 22, borderRadius: 7, flex: "none", display: "grid", placeItems: "center", border: done ? "none" : "1.5px solid var(--line)", background: done ? "var(--sage)" : "var(--widget)", color: "#fff", boxShadow: done ? "none" : "var(--sink)" }}>{done && <Icon name="check" size={12} sw={2.6} />}</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 450, color: done ? "var(--ink-faint)" : "var(--ink-2)", textDecoration: done ? "line-through" : "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.label}</span>
      {t.scope === "personal" && <PersonalDot />}
      <span style={{ color: "var(--ink-faint)", flex: "none" }}><Icon name={t.icon || "check"} size={15} /></span>
    </button>
  );
}
function PreparePage({ day, onTicket }) {
  const s = summarise(day);
  const docs = day.noWallet ? [] : dayDocs(day);
  const bag = (day.stops[0] && day.stops[0].todos) ? day.stops[0].todos : [];
  const eng = day.engineLeaveBy;
  const anchorTime = (eng && eng.anchor) || (s.action && s.action.dep) || s.leaveBy;
  const anchorLabel = (eng && eng.anchorLabel) || (s.action ? `${s.action.verb}${s.action.to ? " to " + stripStn(s.action.to) : ""}` : "First move");
  const wake = s.leaveBy ? fromMin(toMin(s.leaveBy) - 60) : null;
  if (!s.leaveBy && !docs.length && !bag.length) return <SoonTab icon="moon" title="Nothing to prepare" note="This day has no early start, go-bag or documents to gather the night before." />;
  return (
    <div style={{ padding: "2px 16px 24px" }}>
      <PageHead eyebrow="Tonight · Prepare" title="Ready for tomorrow" sub={day.title} icon="moon" />
      {s.leaveBy && (
        <div className="pg" style={{ ...tile, padding: "18px 18px", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "stretch", gap: 16 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ ...eyb, fontSize: 9.5, letterSpacing: "0.26em", color: "var(--ink-faint)", marginBottom: 10 }}>WAKE BY</div>
              <div className="mono engr" style={{ fontSize: 46, fontWeight: 300, letterSpacing: "-0.04em", color: "var(--ink)", lineHeight: 0.86 }}>{wake}</div>
              <div style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 11 }}>Leave by <span className="mono" style={{ color: "var(--ink)", fontWeight: 600 }}>{s.leaveBy}</span></div>
            </div>
            <div className="pg-d" style={{ width: 122, flex: "none", borderRadius: 14, padding: "13px 14px", display: "flex", flexDirection: "column", background: "var(--char)" }}>
              <div style={{ ...eyb, fontSize: 8, letterSpacing: "0.2em", color: "rgba(244,240,231,0.55)" }}>FIRST ANCHOR</div>
              <div className="mono engr-deep" style={{ fontSize: 25, fontWeight: 400, color: "#f4f0e7", marginTop: 7, lineHeight: 1 }}>{anchorTime}</div>
              <div style={{ fontSize: 10, color: "rgba(244,240,231,0.6)", marginTop: "auto", paddingTop: 12, lineHeight: 1.3 }}>{anchorLabel}</div>
            </div>
          </div>
          <button className="pg-d" style={{ marginTop: 15, width: "100%", height: 46, borderRadius: 13, border: "none", background: "var(--char)", color: "#f3efe6", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "var(--sans)", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Icon name="bell" size={15} />Set the alarm</button>
        </div>
      )}
      {bag.length > 0 && (
        <div className="pg" style={{ ...tile, padding: "15px 16px", marginBottom: 14 }}>
          <div style={{ ...eyb, fontSize: 9, color: "var(--ink-faint)", marginBottom: 4 }}>GO-BAG · BEFORE YOU LEAVE</div>
          {bag.map((t, i) => <PrepCheck key={i} t={t} first={i === 0} />)}
        </div>
      )}
      {docs.length > 0 && (
        <div className="pg" style={{ ...tile, padding: "15px 16px", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
            <div style={{ ...eyb, fontSize: 9, color: "var(--ink-faint)" }}>DOCUMENTS</div>
            <span className="mono" style={{ fontSize: 9.5, color: "var(--sage)", display: "inline-flex", alignItems: "center", gap: 5, letterSpacing: "0.04em" }}><Icon name="check" size={12} sw={2.4} />SAVED OFFLINE</span>
          </div>
          {docs.map((d, i) => (
            <button key={i} onClick={() => onTicket(d.sheet)} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "11px 2px", borderTop: i ? "1px solid var(--line-soft)" : "none", background: "none", border: "none", borderTopStyle: i ? "solid" : "none", cursor: "pointer", fontFamily: "var(--sans)", textAlign: "left" }}>
              <Chip icon={d.icon} tone="soft" size={32} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.title}</div>
                <div style={{ ...eyb, color: "var(--ink-dim)", marginTop: 3 }}>{d.kind}</div>
              </div>
              <span style={{ color: "var(--ink-faint)", flex: "none" }}><Icon name="chevron" size={14} /></span>
            </button>
          ))}
        </div>
      )}
      {(day.unplaced || []).length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div className="flank left" style={{ margin: "2px 2px 12px" }}>Still to settle</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {day.unplaced.map((u, i) => (
              <div key={i} className="pg" style={{ padding: "12px 14px", borderRadius: W.r.tile, background: "var(--widget-2)", border: "1px dashed var(--line)", boxShadow: "var(--lift-sm)", display: "flex", alignItems: "center", gap: 12 }}>
                <Chip icon={u.icon} tone={u.kind === "booking" ? "gold" : "soft"} size={32} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.label}</span>
                    {u.scope === "personal" && <PersonalDot />}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--ink-dim)", marginTop: 2 }}>{u.note}</div>
                </div>
                <span style={{ color: "var(--ink-faint)", flex: "none" }}><Icon name="plus" size={16} sw={2} /></span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════ TRIPS — the arc ═════════════════════════ */
function tripGlyph(d) {
  for (const st of d.stops) { if (st.flight) return "plane"; if (st.rail) return "train"; if (st.container) return "briefcase"; }
  for (const st of d.stops) if (st.move) return MODE_ICON[st.move[0].mode] || "route";
  return "route";
}
function TripCard({ d, active, onOpen }) {
  const s = summarise(d);
  const parts = (d.eyebrow || "").split(" · ");
  const title = d.title || "";
  const dash = title.indexOf(" — ");
  const primary = dash >= 0 ? title.slice(0, dash) : title;
  const desc = dash >= 0 ? title.slice(dash + 3) : (d.shape || "");
  const route = primary.split(" → ");
  const isRoute = route.length === 2;
  return (
    <button onClick={onOpen} className="pg" style={{ ...tile, padding: "15px 16px", width: "100%", textAlign: "left", cursor: "pointer", borderColor: active ? "var(--ink)" : "var(--line)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        <Chip icon={tripGlyph(d)} tone={active ? "char" : "soft"} size={42} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ ...eyb, fontSize: 9, color: "var(--ink-faint)" }}>{parts[0]}</span>
            {active && <span className="mono" style={{ fontSize: 8, fontWeight: 600, letterSpacing: "0.1em", color: W.cream, background: W.char, padding: "3px 6px", borderRadius: 6 }}>VIEWING</span>}
          </div>
          {isRoute ? (
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", fontSize: 17, letterSpacing: "-0.022em", lineHeight: 1.1 }}>
              <span style={{ fontWeight: 600, color: "var(--ink)" }}>{route[0]}</span>
              <span style={{ color: "var(--ink-dim)", flex: "none", alignSelf: "center" }}><Icon name="arrowRight" size={13} /></span>
              <span style={{ fontWeight: 400, color: "var(--ink-dim)" }}>{route[1]}</span>
            </div>
          ) : (
            <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.022em", color: "var(--ink)", lineHeight: 1.1 }}>{primary}</div>
          )}
          <div style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{desc}</div>
        </div>
        {s.leaveBy && (
          <div style={{ textAlign: "right", flex: "none" }}>
            <div style={{ ...eyb, color: "var(--ink-faint)", marginBottom: 3 }}>LEAVE</div>
            <div className="mono engr" style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{s.leaveBy}</div>
          </div>
        )}
      </div>
    </button>
  );
}
function TripsPage({ days, si, setSi, setTab }) {
  const trips = days.map((d, i) => ({ d, i })).filter(({ d }) => !d.noWallet);
  return (
    <div style={{ padding: "2px 16px 24px" }}>
      <PageHead eyebrow="Your journeys" title="Trips" sub={`${trips.length} planned days`} icon="route" />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {trips.map(({ d, i }) => <TripCard key={d.id} d={d} active={i === si} onOpen={() => { setSi(i); setTab("today"); }} />)}
      </div>
    </div>
  );
}

/* ════════════════════════════════ APP ═════════════════════════════════ */
function App() {
  const [si, setSi] = useState(0);
  const [tab, setTab] = useState("today");
  const [sheet, setSheet] = useState(null);
  const [view, setView] = useState("personal");
  const day = window.KH_DAYS[si];

  useEffect(() => {
    const host = document.getElementById("scenarios");
    if (!host) return;
    host.innerHTML = "";
    window.KH_DAYS.forEach((d, i) => {
      const b = document.createElement("button");
      b.className = "scn" + (i === si ? " on" : "");
      b.textContent = d.label;
      b.onclick = () => setSi(i);
      host.appendChild(b);
    });
  }, [si]);

  const lens = day.canWork && tab === "today";

  return (
    <div className="phone">
      <div className="screen" data-screen-label={day.label}>
        <StatusBar />
        <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
          {tab === "today" && <>
            <Header day={day} />
            {view === "work" && (
              <div style={{ margin: "0 16px 12px", padding: "12px 14px", borderRadius: 16, background: "var(--plum-soft)", border: "1px solid var(--plum)", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ color: "var(--plum)" }}><Icon name="lock" size={15} /></span>
                <span style={{ fontSize: 11.5, color: "var(--plum)", lineHeight: 1.35 }}>Previewing what your workplace sees · personal items and your location are never shared.</span>
              </div>
            )}
            <NowHero day={day} onShowTicket={setSheet} />
            <Spine day={day} view={view} onTicket={setSheet} />
          </>}
          {tab === "prepare" && <PreparePage day={day} onTicket={setSheet} />}
          {tab === "wallet" && <WalletPage day={day} onTicket={setSheet} />}
          {tab === "trips" && <TripsPage days={window.KH_DAYS} si={si} setSi={setSi} setTab={setTab} />}
        </div>
        {lens && (
          <button onClick={() => setView(v => v === "work" ? "personal" : "work")} style={{ position: "absolute", right: 16, bottom: 90, zIndex: 30, height: 40, padding: "0 15px", borderRadius: 999, border: "none", background: "var(--widget)", boxShadow: "var(--lift)", display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", fontFamily: "var(--sans)" }}>
            <Icon name={view === "work" ? "user" : "lock"} size={14} />
            <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ink)" }}>{view === "work" ? "Your day" : "Preview work view"}</span>
          </button>
        )}
        <TabBar tab={tab} setTab={setTab} />
        {sheet && <TicketSheet data={sheet} onClose={() => setSheet(null)} />}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
