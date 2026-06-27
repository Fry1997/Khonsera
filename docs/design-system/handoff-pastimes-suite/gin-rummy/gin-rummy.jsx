/* ════════════════════════════════════════════════════════════════════════
 * Khonsera · Gin Rummy — the table (hero) + app orchestration.
 * Felt surface. Real engine (window.GinEngine) drives play; a quiet AI is the
 * opponent. Every multiplayer/connection state is drawn. Reuses the cotton
 * playing-card asset (window.KhonseraCards.Card).
 * ════════════════════════════════════════════════════════════════════════ */
(function () {
  const R = window.React, h = R.createElement;
  const { useState, useEffect, useRef, useMemo, useCallback } = R;
  const G = window.GinEngine;
  const Ic = window.GinIcons;
  const { Card } = window.KhonseraCards;
  const { PlayersScreen, ConnectScreen, LobbyScreen, Avatar, Brand, HowToPlay } = window.GinFlow;

  const SUIT_CH = { S: "\u2660", H: "\u2665", D: "\u2666", C: "\u2663" };
  const SORT_LABEL = { meld: "Melds", suit: "Suit", rank: "Rank" };
  const isRed = (s) => s === "H" || s === "D";
  const eq = G.cardsEqual;
  const cid = G.cardId;

  /* ── mono card token (e.g. for reveal lines) ── */
  function CardTok({ c, size }) {
    return h("span", { className: "mono", style: { fontWeight: 600, fontSize: size || 12, color: isRed(c.suit) ? "#cf7d63" : "#d8d2c6" } },
      G.rankLabel(c.rank), h("span", { style: { marginLeft: 1 } }, SUIT_CH[c.suit]));
  }

  /* ── viewport sizing hook ── */
  function useViewport() {
    const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
    useEffect(() => {
      const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
      window.addEventListener("resize", on); window.addEventListener("orientationchange", on);
      return () => { window.removeEventListener("resize", on); window.removeEventListener("orientationchange", on); };
    }, []);
    return vp;
  }

  /* ── hand fan: even overlap, centred, last card always fully shown.
   *    No grouping, no meld detection — the player arranges their own hand by
   *    dragging, and spots their own melds. ── */
  function layoutFan(n, cw, avail) {
    let step = cw;
    if (n * cw > avail) step = (avail - cw) / (n - 1);
    step = Math.min(cw, Math.max(cw * 0.40, step));
    const span = step * (n - 1) + cw;
    const x0 = Math.max(0, (avail - span) / 2);
    return { step, x0, span };
  }

  /* ════════════════════════════════════════════════════════════════════
   * THE TABLE
   * ════════════════════════════════════════════════════════════════════ */
  function Table({ oppName, target, onExit }) {
    const vp = useViewport();
    const landscape = vp.w > vp.h && vp.w >= 620;
    const [state, setState] = useState(() => G.createGame({ seed: "khn-" + Math.floor(Math.random() * 1e6), target }));
    const [sel, setSel] = useState(null);            // selected hand card (discard phase)
    const [reveal, setReveal] = useState(null);      // opponent's last action line
    const [overlay, setOverlay] = useState(null);    // 'round' | 'game' | 'left'
    const [toast, setToast] = useState(null);        // connection toast
    const [menu, setMenu] = useState(false);
    const [htp, setHtp] = useState(false);
    const [order, setOrder] = useState([]);          // player's own card arrangement (card ids)
    const [dragId, setDragId] = useState(null);      // card being dragged
    const [dragX, setDragX] = useState(0);           // pointer x within hand rail
    const dragInfo = useRef(null);                   // { id, startClientX, moved }
    const handRef = useRef(null);
    const orderCommitRef = useRef([]);               // live render order, committed on drop
    const fanRef = useRef(null);                     // { step, x0 } for drop math
    const [busy, setBusy] = useState(false);         // AI animating / blocked
    const oppAct = useRef(null);
    const dealtKey = useRef(0);

    const YOU = 0, OPP = 1;
    const yourHand = state.hands[YOU];
    const yourTurn = state.turn === YOU && state.phase !== "roundOver" && state.phase !== "gameOver";

    /* sizing — bias toward legibility. Hand cards are large; the fan-overlap
       in layoutHand keeps every corner index readable. Landscape derives from
       height so the whole column always fits a short viewport. */
    let cw, ccw, ocw;
    if (landscape) {
      ccw = Math.max(56, Math.min(94, (vp.h - 148) / 3.4));
      cw = ccw * 0.82;
      ocw = ccw * 0.6;
    } else {
      cw = Math.max(62, Math.min(82, (vp.w - 24) / 5.4, vp.h * 0.165));
      ccw = Math.max(74, Math.min(90, vp.w / 4.5));
      ocw = ccw * 0.58;
    }
    const avail = vp.w - 28;

    /* overlay sync */
    useEffect(() => {
      if (state.phase === "gameOver") setOverlay("game");
      else if (state.phase === "roundOver") setOverlay("round");
    }, [state.phase, state.round]);

    /* ── AI driver ── */
    useEffect(() => {
      if (overlay === "left") return;
      if (state.phase === "roundOver" || state.phase === "gameOver") return;
      if (state.turn !== OPP) return;
      setBusy(true);
      const delay = (state.phase === "discard") ? 780 : 620;
      const t = setTimeout(() => {
        const mv = G.aiMove(state, OPP);
        if (!mv) { setBusy(false); return; }
        if (mv.type === "drawStock") oppAct.current = { src: "stock" };
        else if (mv.type === "drawDiscard") oppAct.current = { ...(oppAct.current || {}), src: "discard", took: state.discard[state.discard.length - 1] };
        else if (mv.type === "passUpcard") oppAct.current = { src: "pass" };
        const next = G.applyMove(state, OPP, mv);
        if (next.error) { setBusy(false); return; }
        if (mv.type === "discard" || mv.type === "knock") {
          const a = oppAct.current || {};
          setReveal({ ...a, discarded: mv.card, knocked: mv.type === "knock" });
          oppAct.current = null;
        } else if (mv.type === "passUpcard") {
          setReveal({ src: "pass" });
        }
        setState(next);
        if (next.turn === YOU || next.phase === "roundOver" || next.phase === "gameOver") setBusy(false);
      }, delay);
      return () => clearTimeout(t);
    }, [state, overlay]);

    /* ── your moves ── */
    const apply = useCallback((mv) => {
      const next = G.applyMove(state, YOU, mv);
      if (next.error) return;
      setSel(null);
      setState(next);
    }, [state]);

    function tapStock() { if (yourTurn && state.phase === "draw") apply({ type: "drawStock" }); }
    function tapDiscard() {
      if (!yourTurn) return;
      if (state.phase === "draw" || state.phase === "upcardNonDealer" || state.phase === "upcardDealer")
        apply({ type: "drawDiscard" });
    }
    function passUpcard() { if (yourTurn && (state.phase === "upcardNonDealer" || state.phase === "upcardDealer")) apply({ type: "passUpcard" }); }
    function tapHandCard(c) {
      if (!yourTurn || state.phase !== "discard") return;
      setSel((s) => (s && eq(s, c) ? null : c));
    }
    function doDiscard() { if (sel) apply({ type: "discard", card: sel }); }
    function doKnock() {
      if (!sel) return;
      const after = yourHand.filter((c) => !eq(c, sel));
      const gin = G.isGin(after);
      apply({ type: gin ? "knock" : "knock", card: sel });
    }
    function nextRound() {
      const n = G.startNextRound(state);
      if (!n.error) { setReveal(null); setOverlay(null); setSel(null); dealtKey.current++; setState(n); }
    }
    function rematch() {
      setReveal(null); setOverlay(null); setSel(null); dealtKey.current++;
      setState(G.createGame({ seed: "khn-" + Math.floor(Math.random() * 1e6), target }));
    }

    /* ── deadwood readout (contextual) ── */
    const dwInfo = useMemo(() => {
      if (state.phase === "discard" && state.turn === YOU) {
        if (sel) {
          const after = yourHand.filter((c) => !eq(c, sel));
          const v = G.deadwoodValueOf(after);
          return { value: v, canKnock: v <= 10, gin: v === 0, projected: true };
        }
        // best achievable this turn
        let best = 99;
        for (const c of yourHand) { const v = G.deadwoodValueOf(yourHand.filter((x) => !eq(x, c))); if (v < best) best = v; }
        return { value: best, canKnock: best <= 10, gin: best === 0, projected: true };
      }
      const v = G.deadwoodValueOf(yourHand);
      return { value: v, canKnock: false, gin: false, projected: false };
    }, [state, sel]);

    /* ── connection state sims ── */
    function sim(kind) {
      setMenu(false);
      if (kind === "selfReconnect") {
        setToast({ kind: "self", t1: "Reconnecting", t2: "Resuming your table…", spin: true });
        setTimeout(() => setToast({ kind: "resumed", t1: "Resumed", t2: "Back at the table", dot: true }), 2200);
        setTimeout(() => setToast(null), 4000);
      } else if (kind === "oppOffline") {
        setToast({ kind: "opp", t1: "Waiting for " + oppName.split(" ")[0], t2: "They dropped — their turn waits", spin: true });
        setTimeout(() => setToast(null), 4200);
      } else if (kind === "noSignal") {
        setToast({ kind: "stale", t1: "No signal", t2: "Your move is queued — we'll send it", dot: true });
        setTimeout(() => setToast(null), 4200);
      } else if (kind === "oppLeft") {
        setOverlay("left");
      } else if (kind === "concede") {
        const n = JSON.parse(JSON.stringify(state)); n.phase = "gameOver"; n.winner = OPP; setState(n); setOverlay("game");
      }
    }

    /* turn banner text */
    const banner = (() => {
      if (state.phase === "gameOver" || state.phase === "roundOver") return null;
      const opening = state.phase === "upcardNonDealer" || state.phase === "upcardDealer";
      if (state.turn === YOU) {
        if (opening) return { you: true, ph: "OPENING", msg: "Take the up-card, or pass", sub: null };
        if (state.phase === "draw") return { you: true, ph: "YOUR MOVE", msg: "Draw a card", sub: "Stock (unknown) or the up-card" };
        if (state.phase === "discard") return { you: true, ph: "YOUR MOVE", msg: sel ? "Discard, or knock if you can" : "Choose a card to discard", sub: null };
      }
      return { you: false, ph: "THEIR MOVE", msg: oppName.split(" ")[0] + " is playing", sub: revealLine(reveal) ? null : "—" };
    })();

    function revealLine(rv) {
      if (!rv) return null;
      if (rv.src === "pass") return [{ t: "passed the up-card" }];
      const parts = [];
      if (rv.src === "discard") parts.push({ t: "Took the up-card" });
      else if (rv.src === "stock") parts.push({ t: "Drew from stock" });
      if (rv.discarded) { parts.push({ t: (rv.knocked ? "knocked, discarding " : "discarded "), card: rv.discarded }); }
      return parts.length ? parts : null;
    }

    const stockEmpty = state.stock.length === 0;
    const top = state.discard[state.discard.length - 1];
    const litDiscard = yourTurn && (state.phase === "draw" || (state.phase === "upcardNonDealer" || state.phase === "upcardDealer"));
    const litStock = yourTurn && state.phase === "draw" && !stockEmpty;

    /* keep the player's manual arrangement in sync with the live hand:
       discarded cards drop out, drawn cards append at the right, the rest hold */
    useEffect(() => {
      const ids = yourHand.map(cid);
      setOrder((prev) => {
        const idset = new Set(ids);
        const kept = prev.filter((id) => idset.has(id));
        const keptSet = new Set(kept);
        const added = ids.filter((id) => !keptSet.has(id));
        if (kept.length === prev.length && added.length === 0) return prev;
        return kept.concat(added);
      });
    }, [yourHand]);

    const byId = useMemo(() => { const m = new Map(); yourHand.forEach((c) => m.set(cid(c), c)); return m; }, [yourHand]);
    const baseOrder = order.filter((id) => byId.has(id));
    const nH = baseOrder.length;
    const fan = layoutFan(nH, cw, avail);
    fanRef.current = fan;

    /* live render order incl. drag preview */
    let renderOrder = baseOrder;
    let draggedLeft = null;
    if (dragId != null && byId.has(dragId)) {
      const overIdx = Math.max(0, Math.min(nH - 1, Math.round((dragX - fan.x0 - cw / 2) / fan.step)));
      renderOrder = baseOrder.filter((id) => id !== dragId);
      renderOrder.splice(overIdx, 0, dragId);
      draggedLeft = Math.max(0, Math.min(fan.span - cw, dragX - cw / 2));
    }
    orderCommitRef.current = renderOrder;

    function onHandPointerDown(e, card) {
      if (!handRef.current) return;
      dragInfo.current = { id: cid(card), startClientX: e.clientX, moved: false };
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
      setDragX(e.clientX - handRef.current.getBoundingClientRect().left);
      setDragId(cid(card));
    }
    function onHandPointerMove(e) {
      if (!dragInfo.current || !handRef.current) return;
      if (Math.abs(e.clientX - dragInfo.current.startClientX) > 6) dragInfo.current.moved = true;
      setDragX(e.clientX - handRef.current.getBoundingClientRect().left);
    }
    function onHandPointerUp(e, card) {
      const info = dragInfo.current; dragInfo.current = null;
      const moved = info && info.moved;
      setDragId(null);
      if (!info) return;
      if (!moved) { tapHandCard(card); return; }
      setOrder(orderCommitRef.current.slice());
    }

    const youLead = state.scores[YOU] > state.scores[OPP];
    const oppLead = state.scores[OPP] > state.scores[YOU];

    /* opp fan */
    const oppCount = state.hands[OPP].length;
    const oppStep = Math.min(ocw * 0.5, (Math.min(avail, 280) - ocw) / Math.max(1, oppCount - 1));
    const oppSpan = oppStep * (oppCount - 1) + ocw;

    return h("div", { className: "felt" + (landscape ? " land" : "") },
      /* top bar */
      h("div", { className: "tbar" },
        h(Brand, null),
        h("div", { className: "scoreline" },
          h("div", { className: "sc" + (youLead ? " lead" : "") }, h("div", { className: "k" }, "YOU"), h("div", { className: "v" }, state.scores[YOU])),
          h("div", { className: "sc tgt" }, h("div", { className: "k" }, "TO"), h("div", { className: "v" }, target)),
          h("div", { className: "sc" + (oppLead ? " lead" : "") }, h("div", { className: "k" }, oppName.split(" ")[0].toUpperCase().slice(0, 5)), h("div", { className: "v" }, state.scores[OPP]))),
        h("button", { className: "ico-t", onClick: () => setMenu(true), title: "Connection & table" }, h(Ic.Sliders, { size: 17 }))),

      h("div", { className: "table" },
        /* opponent zone */
        h("div", { className: "opp", style: { "--ocw": ocw + "px" } },
          h("div", { className: "opp-id" },
            h("span", { className: "pres on" }),
            h("span", { className: "nm" }, oppName),
            h("span", { className: "mono", style: { fontSize: 10.5, color: "#737c86", letterSpacing: ".06em" } }, oppCount + " cards")),
          h("div", { className: "opp-fan", style: { width: oppSpan + "px", "--cw": ocw + "px" } },
            Array.from({ length: oppCount }).map((_, i) =>
              h("div", { key: i, className: "kc-card down", style: { left: (i * oppStep) + "px", "--cw": ocw + "px" } },
                h("div", { className: "kc-back" }, h("span", { className: "kc-back-field" }), h("span", { className: "kc-back-frame" }))))),
          h("div", { className: "opp-reveal" },
            (() => {
              const ln = revealLine(reveal);
              if (!ln) return h("span", { className: "ln", style: { opacity: .4 } }, "\u2014");
              return h("span", { className: "ln" }, ln.map((p, i) => h(R.Fragment, { key: i },
                i ? h("span", { style: { color: "#5a626c", margin: "0 6px" } }, "\u00B7") : null,
                p.t, p.card ? h("span", { style: { marginLeft: 1 } }, h(CardTok, { c: p.card, size: 12 })) : null)));
            })())),

        /* centre: piles + turn */
        h("div", { className: "centre" },
          h("div", { className: "piles", style: { "--ccw": ccw + "px" } },
            /* stock */
            h("div", { className: "pile" },
              h("div", { className: "lbl" }, "Stock"),
              h("div", { className: "pile-card" + (litStock ? " lit tap" : ""), onClick: tapStock, style: { "--cw": ccw + "px" } },
                stockEmpty
                  ? h("div", { className: "pile-empty" }, h("span", { className: "cnt" }, "0"))
                  : h(R.Fragment, null,
                      h("div", { className: "kc-card down", style: { "--cw": ccw + "px" } },
                        h("div", { className: "kc-back" }, h("span", { className: "kc-back-field" }), h("span", { className: "kc-back-frame" }))))),
              h("div", { className: "cap" }, state.stock.length + " left")),
            /* discard */
            h("div", { className: "pile" },
              h("div", { className: "lbl" }, "Discard"),
              h("div", { className: "pile-card" + (litDiscard ? " lit tap" : ""), onClick: tapDiscard, style: { "--cw": ccw + "px" } },
                top
                  ? h(Card, { rank: top.rank, suit: top.suit, style: { "--cw": ccw + "px" } })
                  : h("div", { className: "pile-empty" }, h("span", { className: "cnt" }, "\u2014"))),
              h("div", { className: "cap" }, litDiscard ? "take" : (state.phase === "discard" && state.turn === YOU ? "\u2014" : "\u00A0")))),
          /* turn banner */
          banner ? h("div", { className: "turn " + (banner.you ? "you" : "them") },
            h("div", { style: { display: "flex", alignItems: "center", gap: 7 } },
              banner.you ? h("span", { className: "dotline" }) : null,
              h("span", { className: "ph" }, banner.ph)),
            h("div", { className: "msg" }, banner.msg),
            (banner.you && (state.phase === "upcardNonDealer" || state.phase === "upcardDealer"))
              ? h("button", { onClick: passUpcard, style: { marginTop: 4, background: "none", border: 0, cursor: "pointer", font: '500 12px/1 "JetBrains Mono",monospace', letterSpacing: ".14em", textTransform: "uppercase", color: "#9099a3", textDecoration: "underline", textUnderlineOffset: 3 } }, "Pass")
              : (banner.sub ? h("div", { className: "sub" }, banner.sub) : null)) : null),

        /* your hand zone */
        h("div", { className: "hand-zone" },
          h("div", { className: "hand-meta" },
            h("div", { className: "dw" + (dwInfo.gin ? " gin" : dwInfo.canKnock ? " ready" : "") },
              h("span", { className: "k" }, dwInfo.projected ? "DEADWOOD →" : "DEADWOOD"),
              h("span", { className: "v" }, dwInfo.gin ? "0" : dwInfo.value),
              dwInfo.gin ? h("span", { className: "tag" }, "GIN") : dwInfo.canKnock ? h("span", { className: "tag" }, "CAN KNOCK") : null),
            /* knock / discard actions, else a quiet drag hint */
            (state.phase === "discard" && state.turn === YOU)
              ? h("div", { style: { display: "flex", gap: 8 } },
                  (sel && dwInfo.canKnock)
                    ? h("button", { className: "knock-btn", onClick: doKnock },
                        h("span", { className: "gl" }, dwInfo.gin ? "GIN" : "KNOCK"))
                    : null,
                  h("button", {
                    className: "knock-btn", onClick: doDiscard, disabled: !sel,
                    style: sel ? { background: "linear-gradient(180deg,#313c46,#232c34)", color: "#e6e0d4", boxShadow: "inset 0 1px 0 rgba(255,255,255,.1), inset 0 0 0 1px rgba(0,0,0,.4), 0 4px 10px rgba(0,0,0,.32)" } : {} },
                    h("span", null, "Discard")))
              : h("span", { className: "arrange-hint" }, h(Ic.Sort, { size: 13, className: "ic" }), "Drag to arrange")),
          /* the hand — player-arranged, drag to reorder */
          h("div", { className: "hand", ref: handRef, style: { "--hcw": cw + "px", height: (cw * 1.4 + 22) + "px" } },
            renderOrder.map((id, i) => {
              const c = byId.get(id);
              if (!c) return null;
              const dragging = id === dragId && draggedLeft != null;
              const left = dragging ? draggedLeft : (fan.x0 + i * fan.step);
              return h("div", {
                key: id + "-" + dealtKey.current,
                className: "hc" + (sel && eq(sel, c) ? " sel" : "") + (dragging ? " dragging" : ""),
                style: { left: left + "px", "--hcw": cw + "px", zIndex: dragging ? 60 : i, transition: dragging ? "none" : undefined },
                onPointerDown: (e) => onHandPointerDown(e, c),
                onPointerMove: onHandPointerMove,
                onPointerUp: (e) => onHandPointerUp(e, c),
                onPointerCancel: () => { dragInfo.current = null; setDragId(null); },
              }, h(Card, { rank: c.rank, suit: c.suit, style: { "--cw": cw + "px" } }));
            }))),

        /* connection toast */
        toast ? h("div", { className: "toast show" },
          toast.spin ? h("span", { className: "spin" }) : h("span", { className: "dotw" }),
          h("div", { className: "tx" }, h("span", { className: "t1" }, toast.t1), h("span", { className: "t2" }, toast.t2))) : null),

      /* states menu */
      h("div", { className: "sheetmenu" + (menu ? " show" : ""), onClick: () => setMenu(false) },
        h("div", { className: "panel", onClick: (e) => e.stopPropagation() },
          h("div", { className: "ph" }, "CONNECTION · DEMONSTRATE STATES"),
          h("button", { className: "row", onClick: () => { setMenu(false); setHtp(true); } },
            h(Ic.Help, { size: 18 }), h("span", { className: "lab" }, "How to play"), h("span", { className: "desc" }, "the rules")),
          [
            ["selfReconnect", Ic.Refresh, "You reconnecting", "dropped → resumed"],
            ["oppOffline", Ic.WifiOff, oppName.split(" ")[0] + " offline", "their turn waits"],
            ["noSignal", Ic.Wifi, "No signal on your turn", "move queued"],
            ["oppLeft", Ic.LogOut, oppName.split(" ")[0] + " left the table", "graceful exit"],
            ["concede", Ic.Flag, "Concede the game", "ends now"],
          ].map(([k, Icn, lab, desc]) =>
            h("button", { key: k, className: "row", onClick: () => sim(k) },
              h(Icn, { size: 18 }), h("span", { className: "lab" }, lab), h("span", { className: "desc" }, desc))),
          h("button", { className: "row", onClick: () => { setMenu(false); onExit(); }, style: { marginTop: 6 } },
            h(Ic.Back, { size: 18 }), h("span", { className: "lab" }, "Leave to Pastimes")))),

      /* round / game / left overlays */
      h(RoundOverlay, { show: overlay === "round", state, oppName, onNext: nextRound }),
      h(GameOverlay, { show: overlay === "game", state, oppName, target, onRematch: rematch, onExit }),
      h(LeftOverlay, { show: overlay === "left", oppName, onRematch: () => { setOverlay(null); rematch(); }, onExit }),
      h(HowToPlay, { show: htp, onClose: () => setHtp(false) }));
  }

  /* ════ round-over reveal ════ */
  function miniMeldRow(hand) {
    const md = G.meldsAndDeadwood(hand);
    const cwm = 30;
    const groups = [...md.melds.map((m) => ({ cards: m.slice().sort((a, b) => a.rank - b.rank), meld: true })),
      ...(md.deadwood.length ? [{ cards: md.deadwood.slice().sort((a, b) => G.cardValue(b) - G.cardValue(a)), meld: false }] : [])];
    return h("div", { style: { display: "flex", gap: 9, flexWrap: "wrap", justifyContent: "center" } },
      groups.map((g, gi) => h("div", { key: gi, style: { display: "flex" } },
        g.cards.map((c, i) => h("div", {
          key: cid(c), className: "kc-card" + (g.meld ? "" : ""),
          style: { "--cw": cwm + "px", marginLeft: i ? -cwm * 0.46 : 0, opacity: g.meld ? 1 : .9,
            filter: g.meld ? "none" : "saturate(.85)", borderRadius: cwm * 0.062 + "px",
            boxShadow: g.meld ? "0 1px 3px rgba(0,0,0,.25), 0 0 0 1px rgba(201,171,110,.5)" : "0 1px 3px rgba(0,0,0,.2)" },
        }, h(Card, { rank: c.rank, suit: c.suit, style: { "--cw": cwm + "px" } }))))));
  }

  function RoundOverlay({ show, state, oppName, onNext }) {
    const lr = state.lastRound;
    if (!lr) return h("div", { className: "ov" });
    const YOU = 0, OPP = 1;
    const wash = lr.kind === "wash";
    const youKnocked = lr.knocker === YOU;
    const scorer = lr.scorer === "knocker" ? lr.knocker : (1 - lr.knocker);
    const youScored = scorer === YOU;
    const kindLab = { knock: "KNOCK", gin: "GIN", undercut: "UNDERCUT", wash: "WASH" }[lr.kind];
    const kindColor = lr.kind === "gin" ? "#8a6d38" : lr.kind === "undercut" ? "#97331f" : "#565b64";
    let head;
    if (wash) head = "Stock ran out";
    else if (lr.kind === "gin") head = youKnocked ? "You went gin" : oppName.split(" ")[0] + " went gin";
    else if (lr.kind === "undercut") head = (youScored ? "You undercut" : oppName.split(" ")[0] + " undercut");
    else head = youKnocked ? "You knocked" : oppName.split(" ")[0] + " knocked";

    return h("div", { className: "ov" + (show ? " show" : "") },
      h("div", { className: "plate sheet", style: { padding: "24px 22px 20px" } },
        h("div", { className: "mk" }, h("span", { className: "dot", style: { width: 7, height: 7, borderRadius: "50%", background: "radial-gradient(circle at 38% 32%,#c8ab6e,#93753c 60%,#6f5827)" } }),
          h("span", { className: "word" }, "KHONSERA")),
        h("div", { className: "kind-eye eyebrow engr", style: { color: kindColor } }, kindLab),
        h("h2", { className: "engr" }, head),
        wash
          ? h("p", { style: { marginTop: 8 } }, "No one knocked in time. The hand is washed — deal again, scores unchanged.")
          : h(R.Fragment, null,
              h("p", { style: { marginTop: 8 } },
                (youScored ? "You score " : oppName.split(" ")[0] + " scores "),
                h("span", { className: "mono engr", style: { fontWeight: 600, color: "#26221a" } }, "+" + lr.points),
                lr.kind === "gin" ? " (deadwood + 25)" : lr.kind === "undercut" ? " (undercut + 25)" : " on the deadwood difference"),
              h("div", { className: "res" },
                h("div", null, h("div", { className: "k" }, youKnocked ? "YOUR DW" : "THEIR DW"), h("div", { className: "v" }, lr.knockerDeadwood)),
                h("div", null, h("div", { className: "k" }, youKnocked ? "THEIR DW" : "YOUR DW"), h("div", { className: "v" }, lr.opponentDeadwood)),
                h("div", null, h("div", { className: "k" }, "POINTS"), h("div", { className: "v gold" }, "+" + lr.points))),
              lr.laidOff && lr.laidOff.length
                ? h("p", { className: "mono", style: { fontSize: 11, color: "#8a8070", margin: "-6px 0 14px" } },
                    "Laid off: " + lr.laidOff.map((c) => G.rankLabel(c.rank) + SUIT_CH[c.suit]).join("  "))
                : null,
              h("div", { className: "eyebrow engr", style: { color: "#9b917c", margin: "4px 0 10px" } }, (lr.knocker === OPP ? oppName.split(" ")[0] : "Their") + " hand"),
              miniMeldRow(state.hands[lr.knocker === YOU ? OPP : YOU])),
        h("div", { style: { display: "flex", justifyContent: "center", gap: 34, margin: "20px 0 18px" } },
          h("div", { style: { textAlign: "center" } }, h("div", { className: "k mono", style: { fontSize: 9, letterSpacing: ".14em", color: "#a99e87" } }, "YOU"), h("div", { className: "mono engr", style: { fontSize: 22, fontWeight: 600, color: "#26221a", marginTop: 5 } }, state.scores[YOU])),
          h("div", { style: { textAlign: "center" } }, h("div", { className: "k mono", style: { fontSize: 9, letterSpacing: ".14em", color: "#a99e87" } }, oppName.split(" ")[0].toUpperCase()), h("div", { className: "mono engr", style: { fontSize: 22, fontWeight: 600, color: "#26221a", marginTop: 5 } }, state.scores[OPP]))),
        h("button", { className: "btn btn-ink", onClick: onNext }, h("span", { className: "lab" }, "Next hand"))));
  }

  /* ════ game-over ════ */
  function GameOverlay({ show, state, oppName, target, onRematch, onExit }) {
    const YOU = 0;
    const youWon = state.winner === YOU;
    return h("div", { className: "ov" + (show ? " show" : "") },
      h("div", { className: "plate sheet", style: { padding: "28px 24px 22px" } },
        h("div", { className: "mk" }, h("span", { className: "dot", style: { width: 7, height: 7, borderRadius: "50%", background: "radial-gradient(circle at 38% 32%,#c8ab6e,#93753c 60%,#6f5827)" } }),
          h("span", { className: "word" }, "KHONSERA")),
        h("div", { className: "kind-eye eyebrow engr", style: { color: "#8a6d38" } }, "GAME OVER"),
        h("h2", { className: "engr" }, youWon ? "You took the game" : oppName.split(" ")[0] + " took the game"),
        h("p", { style: { marginTop: 8 } }, "First to " + target + ". " + (youWon ? "Cleanly played." : "Well played — go again?")),
        h("div", { className: "res" },
          h("div", null, h("div", { className: "k" }, "YOU"), h("div", { className: "v" + (youWon ? " gold" : "") }, state.scores[YOU])),
          h("div", null, h("div", { className: "k" }, oppName.split(" ")[0].toUpperCase()), h("div", { className: "v" + (!youWon ? " gold" : "") }, state.scores[1]))),
        h("button", { className: "btn btn-ink", onClick: onRematch }, h(Ic.Refresh, { size: 16 }), h("span", { className: "lab" }, "Rematch")),
        h("button", { className: "btn btn-ghost", onClick: onExit, style: { marginTop: 10, height: 44 } }, h("span", { className: "lab" }, "Back to Pastimes"))));
  }

  /* ════ opponent-left ════ */
  function LeftOverlay({ show, oppName, onRematch, onExit }) {
    return h("div", { className: "ov" + (show ? " show" : "") },
      h("div", { className: "plate sheet", style: { padding: "28px 24px 22px" } },
        h("div", { className: "mk" }, h("span", { className: "dot", style: { width: 7, height: 7, borderRadius: "50%", background: "radial-gradient(circle at 38% 32%,#c8ab6e,#93753c 60%,#6f5827)" } }),
          h("span", { className: "word" }, "KHONSERA")),
        h("div", { className: "kind-eye eyebrow engr", style: { color: "#565b64" } }, "TABLE ENDED"),
        h("h2", { className: "engr" }, oppName.split(" ")[0] + " left the table"),
        h("p", { style: { marginTop: 8 } }, "The hand is closed. Nothing's lost — you can open a fresh table whenever they're back."),
        h("button", { className: "btn btn-ink", onClick: onRematch, style: { marginTop: 20 } }, h("span", { className: "lab" }, "Invite to a new game")),
        h("button", { className: "btn btn-ghost", onClick: onExit, style: { marginTop: 10, height: 44 } }, h("span", { className: "lab" }, "Back to Pastimes"))));
  }

  /* ════════════════════════════════════════════════════════════════════
   * APP — screen state machine
   * ════════════════════════════════════════════════════════════════════ */
  const PEOPLE = [
    { name: "Maya Levin", online: true, seen: "" },
    { name: "Daniel Roy", online: false, seen: "3h ago" },
  ];
  const CONN = {
    people: PEOPLE,
    incoming: { name: "Priya Shah", code: "KHN-7731" },
    outgoing: { name: "Omar Haddad" },
  };
  const MY_CODE = "KHN-4827";
  const TARGET = 100;

  function App() {
    const [screen, setScreen] = useState("players");
    const [opp, setOpp] = useState("Maya Levin");

    if (screen === "table")
      return h(Table, { oppName: opp, target: TARGET, onExit: () => setScreen("players") });
    if (screen === "connect")
      return h(ConnectScreen, { myCode: MY_CODE, onBack: () => setScreen("players"), onSend: () => setScreen("players") });
    if (screen === "lobby")
      return h(LobbyScreen, { you: "You", opp, target: TARGET, onBack: () => setScreen("players"), onCancel: () => setScreen("players"), onDeal: () => setScreen("table") });
    return h(PlayersScreen, { data: CONN, onInvite: (p) => { setOpp(p.name); setScreen("lobby"); }, onConnect: () => setScreen("connect") });
  }

  ReactDOM.createRoot(document.getElementById("root")).render(h(App));
})();
