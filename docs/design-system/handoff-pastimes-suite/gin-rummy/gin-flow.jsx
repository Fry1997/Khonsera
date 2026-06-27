/* ════════════════════════════════════════════════════════════════════════
 * Khonsera · Gin Rummy — Pastimes flow screens (paper surface):
 *   PlayersScreen · ConnectScreen · LobbyScreen
 * Calm, low-ceremony: two people who know each other. Presence is a quiet dot.
 * window.GinFlow = { PlayersScreen, ConnectScreen, LobbyScreen }
 * ════════════════════════════════════════════════════════════════════════ */
(function () {
  const R = window.React, h = R.createElement;
  const { useState, useEffect } = R;
  const Ic = window.GinIcons;

  const Brand = ({ tail }) =>
    h("div", { className: "brand" },
      h("span", { className: "dot" }),
      h("span", { className: "word engr" }, "KHONSERA"),
      tail ? h("span", { className: "eyebrow engr", style: { color: "#8a8070", marginLeft: 2 } }, "· " + tail) : null);

  const Avatar = ({ name, ink }) => {
    const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("");
    return h("div", {
      style: {
        width: 42, height: 42, borderRadius: 13, flex: "0 0 auto",
        display: "flex", alignItems: "center", justifyContent: "center",
        font: '500 15px/1 "Satoshi","Inter",sans-serif',
        color: ink ? "#ece7db" : "#4a4f57",
        background: ink ? "linear-gradient(158deg,#2a2f37,#1b1f25)" : "linear-gradient(158deg,#fcfbf7,#ece7db)",
        boxShadow: ink
          ? "inset 0 1px 0 rgba(255,255,255,.1), 0 0 0 .5px rgba(0,0,0,.5), 0 6px 12px -8px rgba(0,0,0,.5)"
          : "inset 0 1.5px 0 rgba(255,255,255,.9), 0 0 0 .5px rgba(40,44,52,.06), 0 6px 12px -8px rgba(34,30,24,.3)",
        textShadow: ink ? "0 -1px 0 rgba(0,0,0,.5)" : "0 1px 0 rgba(255,255,255,.8)",
      },
    }, initials);
  };

  /* ── a person row ── */
  function PersonRow({ p, onInvite }) {
    return h("div", {
      style: { display: "flex", alignItems: "center", gap: 13, padding: "13px 15px" },
    },
      h(Avatar, { name: p.name }),
      h("div", { style: { flex: 1, minWidth: 0 } },
        h("div", { className: "engr", style: { font: '500 15px/1.2 "Satoshi",sans-serif', color: "#262b33" } }, p.name),
        h("div", { style: { display: "flex", alignItems: "center", gap: 6, marginTop: 3 } },
          h("span", { className: "pres " + (p.online ? "on" : "off") }),
          h("span", { className: "mono", style: { fontSize: 11, color: "#6b7078", letterSpacing: ".02em" } },
            p.online ? "Online" : "Last seen " + p.seen))),
      onInvite
        ? h("button", {
            className: "btn-ink", onClick: () => onInvite(p),
            style: { width: "auto", height: 38, padding: "0 15px", borderRadius: 11, gap: 7, fontSize: 13 },
          },
            h(Ic.Spade, { size: 15 }),
            h("span", { className: "lab" }, "Invite"))
        : null);
  }

  const Divider = () => h("div", { style: { height: 1, margin: "0 15px", background: "linear-gradient(90deg,transparent,rgba(40,44,52,.1),transparent)" } });

  /* ════ HOW TO PLAY — rules window on a cotton sheet ════ */
  const HTP_RULES = [
    ["Objective", "Be first to " , "the target score (100). You earn points by forming your 10 cards into melds and catching your opponent with more leftover deadwood."],
    ["Melds", "", "A run is 3+ cards of one suit in sequence (e.g. 4-5-6 of hearts). A set is 3 or 4 of a kind. Aces are low. Drag your cards to arrange them however you like \u2014 line up your own runs and sets; everything left over is deadwood."],
    ["A turn", "", "Draw one card \u2014 the face-down stock, or the visible up-card \u2014 then discard one. That\u2019s it: draw, then discard."],
    ["Deadwood", "", "Your unmatched cards. Face cards count 10, aces 1, everything else its number. The running total shows above your hand."],
    ["Knock", "", "When your deadwood is 10 or less you may knock as you discard, ending the hand. Lower deadwood scores the difference."],
    ["Gin", "", "Knock with zero deadwood \u2014 all 10 cards melded \u2014 for a 25-point bonus. Nothing can be laid off against gin."],
    ["Undercut", "", "If the player who didn\u2019t knock ties or beats the knocker\u2019s deadwood, they undercut: they score the difference plus 25 instead."],
  ];

  function HowToPlay({ show, onClose }) {
    return h("div", { className: "ov" + (show ? " show" : ""), onClick: onClose },
      h("div", { className: "plate sheet", onClick: (e) => e.stopPropagation(),
        style: { width: "min(92vw,380px)", padding: "24px 22px 20px", textAlign: "left" } },
        h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 } },
          h("div", { className: "mk" },
            h("span", { className: "dot", style: { width: 7, height: 7, borderRadius: "50%", background: "radial-gradient(circle at 38% 32%,#c8ab6e,#93753c 60%,#6f5827)" } }),
            h("span", { className: "word" }, "KHONSERA")),
          h("button", { onClick: onClose, title: "Close",
            style: { WebkitAppearance: "none", appearance: "none", border: 0, cursor: "pointer", flex: "0 0 auto",
              width: 34, height: 34, borderRadius: 11, display: "inline-flex", alignItems: "center", justifyContent: "center",
              color: "#3a3f48", background: "linear-gradient(180deg,#fbfaf6,#efeade)",
              boxShadow: "inset 0 1.5px 0 rgba(255,255,255,.9), 0 0 0 .5px rgba(40,44,52,.05), 0 6px 12px -8px rgba(34,30,24,.3), 0 1.5px 3px rgba(34,30,24,.1)" } },
            h(Ic.Close, { size: 17 }))),
        h("div", { className: "kind-eye eyebrow engr", style: { color: "#8a6d38", marginTop: 14 } }, "HOW TO PLAY"),
        h("h2", { className: "engr", style: { margin: "5px 0 4px", font: '500 24px/1.1 "Satoshi","Inter",sans-serif', letterSpacing: "-.02em", color: "#26221a" } }, "Gin Rummy"),
        h("p", { style: { margin: "0 0 16px", color: "#7d7464", fontSize: 12.5, lineHeight: 1.5 } },
          "A two-player classic. Build a tidy hand, knock at the right moment, and don\u2019t get caught holding."),
        h("div", { style: { display: "flex", flexDirection: "column", gap: 13 } },
          HTP_RULES.map(([title, , body], i) =>
            h("div", { key: title, style: { display: "flex", gap: 13, alignItems: "flex-start" } },
              h("span", { className: "mono engr", style: { flex: "0 0 auto", marginTop: 1, fontSize: 10, fontWeight: 600, color: "#9b917c", letterSpacing: ".06em", minWidth: 16 } }, String(i + 1).padStart(2, "0")),
              h("div", null,
                h("div", { className: "engr", style: { font: '500 14px/1.2 "Satoshi","Inter",sans-serif', color: "#2a251c", marginBottom: 3 } }, title),
                h("div", { style: { color: "#776e5e", fontSize: 12.5, lineHeight: 1.5 } }, body))))),
        h("button", { className: "btn btn-ink", onClick: onClose, style: { marginTop: 20 } }, h("span", { className: "lab" }, "Got it"))));
  }

  /* ════ PLAYERS — the connections home ════ */
  function PlayersScreen({ data, onInvite, onConnect }) {
    const people = data.people;
    const [htp, setHtp] = useState(false);
    return h("div", { className: "paper" },
      h("div", { className: "pbar" },
        h(Brand, { tail: "PASTIMES" }),
        h("div", { style: { flex: 1 } }),
        h("button", {
          className: "ico-btn", onClick: () => setHtp(true), title: "How to play",
          style: { width: "auto", height: 34, padding: "0 12px", gap: 7, borderRadius: 11 },
        },
          h(Ic.Help, { size: 17 }),
          h("span", { className: "mono", style: { fontSize: 10.5, letterSpacing: ".1em", textTransform: "uppercase", color: "#3a3f48" } }, "How to play"))),
      h("div", { className: "pscroll" },
        h("div", { className: "eyebrow engr", style: { color: "#7a7f88", marginBottom: 7 } }, "GIN RUMMY"),
        h("h1", { className: "engr", style: { margin: "0 0 18px", font: '500 27px/1.1 "Satoshi",sans-serif', letterSpacing: "-.02em", color: "#22262d" } },
          "Play with someone you know"),

        /* incoming request */
        data.incoming ? h("div", { className: "sheet", style: { marginBottom: 12, padding: 15 } },
          h("div", { className: "eyebrow engr", style: { color: "#8a6d38", marginBottom: 11 } }, "WANTS TO CONNECT"),
          h("div", { style: { display: "flex", alignItems: "center", gap: 13 } },
            h(Avatar, { name: data.incoming.name }),
            h("div", { style: { flex: 1 } },
              h("div", { className: "engr", style: { font: '500 15px/1.2 "Satoshi",sans-serif', color: "#262b33" } }, data.incoming.name),
              h("div", { className: "mono", style: { fontSize: 11, color: "#6b7078", marginTop: 3 } }, "Code " + data.incoming.code)),
            h("div", { style: { display: "flex", gap: 8 } },
              h("button", { className: "ico-btn", title: "Ignore" }, h(Ic.Close, { size: 17 })),
              h("button", { className: "ico-btn", title: "Accept", style: { color: "#5f7150" } }, h(Ic.Check, { size: 18 }))))) : null,

        /* the list */
        h("div", { className: "sheet", style: { overflow: "hidden" } },
          h("div", { className: "eyebrow engr", style: { color: "#7a7f88", padding: "14px 15px 4px" } }, "YOUR PEOPLE"),
          people.map((p, i) => h(R.Fragment, { key: p.name },
            i ? h(Divider) : null,
            h(PersonRow, { p: { ...p, online: p.online, seen: p.seen }, onInvite }))),
          /* outgoing pending */
          data.outgoing ? h(R.Fragment, null, h(Divider),
            h("div", { style: { display: "flex", alignItems: "center", gap: 13, padding: "13px 15px", opacity: .72 } },
              h(Avatar, { name: data.outgoing.name }),
              h("div", { style: { flex: 1 } },
                h("div", { className: "engr", style: { font: '500 15px/1.2 "Satoshi",sans-serif', color: "#262b33" } }, data.outgoing.name),
                h("div", { className: "mono", style: { fontSize: 11, color: "#6b7078", marginTop: 3, display: "flex", alignItems: "center", gap: 6 } },
                  h(Ic.Hourglass, { size: 12 }), "Request sent")),
              h("span", { className: "mono", style: { fontSize: 10.5, color: "#9499a1", textTransform: "uppercase", letterSpacing: ".1em" } }, "Pending"))) : null),

        h("div", { style: { height: 16 } }),
        h("button", { className: "btn btn-ghost", onClick: onConnect, style: { gap: 9 } },
          h(Ic.UserPlus, { size: 18 }), h("span", { className: "lab" }, "Connect someone new")),
        h("p", { style: { textAlign: "center", color: "#8a8f97", fontSize: 11.5, marginTop: 13, lineHeight: 1.5 }, className: "mono" },
          "Turn-based · rejoin any time · survives patchy signal")),
      h(HowToPlay, { show: htp, onClose: () => setHtp(false) }));
  }

  /* ════ CONNECT — share your code / enter theirs ════ */
  function ConnectScreen({ myCode, onBack, onSend }) {
    const [code, setCode] = useState("");
    const [sent, setSent] = useState(false);
    const [copied, setCopied] = useState(false);
    const clean = code.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 7);
    const valid = clean.length >= 6;
    function copy() { setCopied(true); setTimeout(() => setCopied(false), 1400); }
    function send() { if (!valid) return; setSent(true); setTimeout(() => onSend(clean), 1100); }
    return h("div", { className: "paper" },
      h("div", { className: "pbar" },
        h("button", { className: "ico-btn", onClick: onBack, style: { marginRight: 2 } }, h(Ic.Back, { size: 19 })),
        h(Brand, { tail: "CONNECT" })),
      h("div", { className: "pscroll" },
        h("h1", { className: "engr", style: { margin: "4px 0 6px", font: '500 26px/1.12 "Satoshi",sans-serif', letterSpacing: "-.02em", color: "#22262d" } },
          "Connect with someone"),
        h("p", { style: { margin: "0 0 22px", color: "#6b7078", fontSize: 13.5, lineHeight: 1.5 } },
          "Share your code, or enter theirs. You only do this once — after that, either of you can open a table."),

        /* your code */
        h("div", { className: "sheet-ink", style: { padding: "18px 18px 16px", marginBottom: 22 } },
          h("div", { className: "eyebrow engr-d", style: { color: "#9aa3ad", marginBottom: 12 } }, "YOUR CODE"),
          h("div", { style: { display: "flex", alignItems: "center", gap: 12 } },
            h("div", { className: "mono engr-d", style: { flex: 1, fontSize: 30, fontWeight: 600, letterSpacing: ".08em", color: "#efe9dd" } }, myCode),
            h("button", { className: "ico-btn", onClick: copy, style: { background: "linear-gradient(180deg,#313a44,#232b33)", color: "#cdd3da", boxShadow: "inset 0 1px 0 rgba(255,255,255,.1), inset 0 0 0 1px rgba(0,0,0,.4)" } },
              copied ? h(Ic.Check, { size: 18 }) : h(Ic.Copy, { size: 17 })),
            h("button", { className: "ico-btn", style: { background: "linear-gradient(180deg,#313a44,#232b33)", color: "#cdd3da", boxShadow: "inset 0 1px 0 rgba(255,255,255,.1), inset 0 0 0 1px rgba(0,0,0,.4)" } },
              h(Ic.Share, { size: 17 })))),

        /* divider */
        h("div", { style: { display: "flex", alignItems: "center", gap: 12, margin: "2px 0 20px" } },
          h("div", { style: { flex: 1, height: 1, background: "rgba(40,44,52,.12)" } }),
          h("span", { className: "mono", style: { fontSize: 11, color: "#9499a1", letterSpacing: ".1em" } }, "OR"),
          h("div", { style: { flex: 1, height: 1, background: "rgba(40,44,52,.12)" } })),

        /* enter theirs */
        h("div", { className: "eyebrow engr", style: { color: "#7a7f88", marginBottom: 9 } }, "ENTER THEIR CODE"),
        h("input", {
          value: code, onChange: (e) => setCode(e.target.value), placeholder: "KHN-0000",
          inputMode: "text", autoCapitalize: "characters", spellCheck: false,
          style: {
            width: "100%", height: 56, borderRadius: 13, border: 0, outline: "none", padding: "0 18px",
            font: '600 22px/1 "JetBrains Mono",monospace', letterSpacing: ".08em", color: "#262b33",
            background: "linear-gradient(180deg,#ece7db,#f3efe6)",
            boxShadow: "inset 0 2px 4px rgba(40,36,28,.16), inset 0 1px 2px rgba(40,36,28,.1), inset 0 -1px 0 rgba(255,255,255,.7)",
          },
        }),
        h("div", { style: { height: 18 } }),
        h("button", { className: "btn btn-ink", disabled: !valid || sent, onClick: send },
          h("span", { className: "lab" }, sent ? "Sending…" : "Send request")),
        sent ? h("p", { className: "mono", style: { textAlign: "center", color: "#8a6d38", fontSize: 11.5, marginTop: 13 } },
          "Request on its way to " + clean) : null));
  }

  /* ════ LOBBY — table not yet started ════ */
  function LobbyScreen({ you, opp, target, onBack, onDeal, onCancel }) {
    const [ready, setReady] = useState(false);
    useEffect(() => { const t = setTimeout(() => setReady(true), 1500); return () => clearTimeout(t); }, []);
    return h("div", { className: "paper" },
      h("div", { className: "pbar" },
        h("button", { className: "ico-btn", onClick: onBack, style: { marginRight: 2 } }, h(Ic.Back, { size: 19 })),
        h(Brand, { tail: "TABLE" })),
      h("div", { className: "pscroll", style: { display: "flex", flexDirection: "column" } },
        h("div", { className: "eyebrow engr", style: { color: "#7a7f88", marginBottom: 8 } }, "GIN RUMMY · FIRST TO " + target),
        h("h1", { className: "engr", style: { margin: "0 0 22px", font: '500 26px/1.12 "Satoshi",sans-serif', letterSpacing: "-.02em", color: "#22262d" } },
          ready ? "Both ready" : "Waiting for " + opp.split(" ")[0]),

        /* the two seats */
        h("div", { className: "sheet", style: { padding: 6, marginBottom: 14 } },
          [{ name: you, host: true, rdy: true }, { name: opp, host: false, rdy: ready }].map((s, i) =>
            h(R.Fragment, { key: s.name },
              i ? h(Divider) : null,
              h("div", { style: { display: "flex", alignItems: "center", gap: 13, padding: "13px 12px" } },
                h(Avatar, { name: s.name, ink: i === 0 }),
                h("div", { style: { flex: 1 } },
                  h("div", { className: "engr", style: { font: '500 15px/1.2 "Satoshi",sans-serif', color: "#262b33", display: "flex", alignItems: "center", gap: 8 } },
                    s.name,
                    s.host ? h("span", { className: "mono", style: { fontSize: 9, color: "#fff", background: "linear-gradient(180deg,#2a2f37,#1b1f25)", padding: "3px 6px", borderRadius: 5, letterSpacing: ".1em" } }, "HOST") : null),
                  h("div", { style: { display: "flex", alignItems: "center", gap: 6, marginTop: 4 } },
                    s.rdy ? h(R.Fragment, null,
                      h("span", { className: "pres on" }),
                      h("span", { className: "mono", style: { fontSize: 11, color: "#5f7150", letterSpacing: ".02em" } }, "Ready"))
                      : h(R.Fragment, null,
                        h("span", { style: { width: 13, height: 13, borderRadius: "50%", border: "2px solid rgba(138,109,56,.3)", borderTopColor: "#8a6d38", display: "inline-block", animation: "spin 1s linear infinite" } }),
                        h("span", { className: "mono", style: { fontSize: 11, color: "#8a6d38", letterSpacing: ".02em" } }, "Joining\u2026")))))))),

        h("div", { style: { flex: 1 } }),
        h("div", { className: "sheet", style: { padding: "13px 15px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" } },
          h("span", { className: "eyebrow engr", style: { color: "#7a7f88" } }, "TARGET SCORE"),
          h("span", { className: "mono engr", style: { fontSize: 18, fontWeight: 600, color: "#262b33" } }, String(target))),
        h("button", { className: "btn btn-ink", disabled: !ready, onClick: onDeal },
          h(Ic.Spade, { size: 16, style: { opacity: .85 } }), h("span", { className: "lab" }, "Deal the first hand")),
        h("button", { className: "btn btn-ghost", onClick: onCancel, style: { marginTop: 10, height: 44 } },
          h("span", { className: "lab" }, "Leave table"))));
  }

  window.GinFlow = { PlayersScreen, ConnectScreen, LobbyScreen, Avatar, Brand, HowToPlay };
})();
