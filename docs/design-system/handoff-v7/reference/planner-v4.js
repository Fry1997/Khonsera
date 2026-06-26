// Planner playground — the V1 place-based day model, extended to every
// modality. One renderer, many day SHAPES (scenarios): a rail commute, a
// business flight day, an evening out. Each is a spine of typed elements:
//   place · {move:[legs]} · {rail} · {flight} · {gap}
// Knowns are placed; gaps are unresolved connections you resolve in-app.
window.KH_DAYS = [

/* ════════════════════════ 1 · RAIL COMMUTE (home→home) ════════════════════ */
{ id: "commute", label: "Rail commute", shape: "Home → Home",
  title: "Wellingborough → Harpenden", eyebrow: "Tue 17 Jun · Plan", canWork: true, nowAfter: 1,
  // Known to the plan but not yet positioned on the spine — the planner's
  // inbox. Constraints + actions waiting for a home in the day.
  unplaced: [
    { icon: "ticket", label: "Return ticket", note: "EMR · LUT → WEL · buy before 17:00", kind: "booking" },
    { icon: "phone", label: "Call Priya", note: "debrief · any quiet 10 min", kind: "action", scope: "personal" },
    { icon: "gift", label: "Pick up flowers", note: "for Sarah · near a station", kind: "errand", scope: "personal" },
    { icon: "car", label: "Station parking pass", note: "Wellingborough · activate on arrival", kind: "pass" },
  ],
  // The product brain: a dependency cascade the engine runs when the day slips.
  // P11/P16 — the leave-by ENGINE: a backward chain of elastic segments to the
  // first hard anchor, each a distribution (min/typical/p90), so leave-by is
  // computed at a confidence level, not a cheerful constant.
  engineLeaveBy: {
    anchor: "07:15", anchorLabel: "easyJet U2 8461 departs", origin: "Home",
    chain: [
      { label: "Walk to the station", mode: "walk", min: 10, typical: 12, p90: 16 },
      { label: "Platform buffer", mode: "buffer", min: 5, typical: 7, p90: 7 },
      { label: "Rail · WEL → LUT", mode: "rail", min: 25, typical: 25, p90: 28 },
      { label: "Luton change", mode: "changeover", min: 4, typical: 6, p90: 11 },
      { label: "Rail · LUT → HPD", mode: "rail", min: 9, typical: 9, p90: 11 },
    ],
    binding: "the 07:15 departure",
  },
  live: {
    calm: { headline: "Day holds", note: "All buffers green · 2 connections held" },
    delay: {
      trigger: "EMR 06:40 now running 12 min late",
      affectsStopId: "luton",
      protects: "the 07:11 to Harpenden",
      cascade: [
        { label: "Wellingborough buffer absorbs 8 of 12 min", tone: "sage", icon: "shieldCheck" },
        { label: "Luton change drops to 0 min — the 07:11 connection is missed", tone: "rust", icon: "alert" },
        { label: "Office arrival (09:00) now at risk", tone: "amber", icon: "clock" },
      ],
      fallback: { title: "Next Thameslink · 07:26 from Platform 4", note: "Reaches Cardinal House 08:54 — the 09:00 still holds", action: "Switch to this route" },
      fixed: { headline: "Re-planned · day holds again", note: "Fallback applied · arriving 08:54, 6 min spare" },
    },
    // WS8 — the engine spec: from a live slip the cascade & ranked fallbacks
    // are COMPUTED, not authored. Buffer absorbs, the change breaks past slack,
    // fallbacks are ranked by arrival with tie / infeasible behaviour defined.
    engine: {
      slipLabel: "the 06:40 EMR",
      lutonArrive: 425,          // 07:05 in minutes
      bufferCap: 8,              // Wellingborough protected buffer
      changeSlack: 6,            // the 07:11 connection's slack
      commitment: 540,           // 09:00 office arrival
      connection: "the 07:11 to Harpenden",
      // later departures you could fall back to (depart / arrive, in minutes)
      fallbacks: [
        { title: "07:26 Thameslink · Plat 4", depart: 446, arrive: 534 },
        { title: "07:29 EMR · Plat 2", depart: 449, arrive: 538 },
        { title: "07:41 Thameslink · Plat 4", depart: 461, arrive: 548 },
      ],
    },
  },
  stops: [
    { id: "home", role: "start", icon: "home", name: "Home", area: "Wellingborough",
      window: { leaveBy: "06:10" },
      todos: [
        { label: "Grab the go-bag", icon: "luggage" },
        { label: "Let the dog out", icon: "check", scope: "personal" },
      ] },
    { move: [ { mode: "walk", mins: 12, label: "Walk to the station", to: "Wellingborough Station",
        todos: [ { label: "Prompt-code the parser fix", icon: "code", tag: "hands-free" } ] } ] },
    { id: "welly", role: "hub", icon: "train", name: "Wellingborough Station", area: "Platform 2",
      window: { arrive: "06:22", leave: "06:40" }, protected: { mins: 8, covers: "the 06:40 departure" },
      transit: { ticket: { ref: "EMR-7F2K9", from: "WEL", to: "LUT", class: "Off-peak return" }, platform: "2" },
      todos: [ { label: "Grab a coffee", icon: "coffee" } ] },
    { rail: { line: "EMR · towards London St Pancras", mins: 25, from: "06:40", to: "07:05",
        fromCode: "WEL", fromName: "Wellingborough", toCode: "LUT", toName: "Luton",
        platform: "2", seat: "Coach C · 24", ticket: { ref: "EMR-7F2K9", class: "Off-peak return", code: "qr" },
        todos: [ { label: "Review the board deck", icon: "file" }, { label: "Clear the inbox", icon: "mail" } ] } },
    { changeover: { at: "Luton Station", from: "Platform 2", to: "Platform 4", mode: "rail→rail",
        available: 6, needed: 4, risk: "tight", protects: "the 07:11 to Harpenden" } },
    { rail: { line: "Thameslink · towards St Albans City", mins: 9, from: "07:11", to: "07:20",
        fromCode: "LUT", fromName: "Luton", toCode: "HPD", toName: "Harpenden",
        platform: "4", ticket: { ref: "TL-3R8X1", class: "Off-peak return", code: "qr" } } },
    { move: [ { mode: "walk", mins: 9, label: "Walk to the office", to: "Cardinal House" } ] },
    { id: "office", role: "work", icon: "building", name: "The Office", area: "Cardinal House, Harpenden",
      window: { from: "09:00", to: "17:00" }, shift: true, scope: "work", addedByWork: true,
      todos: [
        { label: "Team stand-up", at: "09:15", icon: "play", type: "video", scope: "work", notes: "Daily 15-min sync. Share the Lumen progress." },
        { label: "Client video call — Lumen", at: "11:00", icon: "video", type: "video", tag: "45 min", scope: "work", notes: "Q3 platform review. Élodie + CFO on the call." },
        { label: "Call the vet — dog’s booster", at: "12:30", icon: "phone", type: "call", scope: "personal", notes: "Booster due. Ask about the kennel cough jab too." },
        { label: "Lunch", at: "13:00", icon: "coffee", scope: "personal" },
        { label: "Board-deck prep", at: "15:00", icon: "file", type: "prep", scope: "work" },
      ] },
    { move: [ { mode: "walk", mins: 9, label: "Walk back to the station", to: "Harpenden Station",
        todos: [
          { label: "Call Priya — debrief", icon: "phone", type: "call", notes: "Run through how the client meeting landed." },
          { label: "Pick up flowers for Sarah", icon: "gift", type: "errand", scope: "personal" },
        ] } ] },
    { id: "harpenden", role: "hub", icon: "train", name: "Harpenden Station", area: "Platform 1",
      window: { arrive: "17:24", leave: "17:32" }, protected: { mins: 6, covers: "the 17:32 departure" },
      transit: { ticket: { ref: "EMR-7F2K9", from: "HPD", to: "WEL", class: "Off-peak return" }, platform: "1" }, todos: [] },
    { rail: { line: "Thameslink · towards Luton", mins: 8, from: "17:32", to: "17:40",
        fromCode: "HPD", fromName: "Harpenden", toCode: "LUT", toName: "Luton",
        platform: "1", ticket: { ref: "TL-3R8X1", class: "Off-peak return", code: "qr" } } },
    { changeover: { at: "Luton Station", from: "Platform 4", to: "Platform 1", mode: "rail→rail",
        available: 11, needed: 4, risk: "comfortable", protects: "the 17:51 to Wellingborough" } },
    { rail: { line: "EMR · towards Sheffield", mins: 25, from: "17:51", to: "18:16",
        fromCode: "LUT", fromName: "Luton", toCode: "WEL", toName: "Wellingborough",
        platform: "1", seat: "Coach B · 11", ticket: { ref: "EMR-7F2K9", class: "Off-peak return", code: "qr" },
        todos: [ { label: "Wind down — no email", icon: "check", tag: "off-duty", scope: "personal" } ] } },
    { move: [ { mode: "walk", mins: 12, label: "Walk home", to: "Home" } ] },
    { id: "home2", role: "end", icon: "home", name: "Home", area: "Wellingborough · day complete",
      window: { arrive: "18:30" }, todos: [] },
  ] },

/* ════════════════ 2 · BUSINESS FLIGHT DAY (home→hotel, overnight) ══════════ */
{ id: "flight", label: "Flight + hotel", shape: "Home → Hotel",
  title: "London → Geneva — Lumen review", eyebrow: "Thu 19 Jun · Plan", canWork: true,
  unplaced: [
    { icon: "phone", label: "Call Priya", note: "debrief · any quiet 30 min", kind: "action", scope: "work" },
  ],
  stops: [
    { id: "home", role: "start", icon: "home", name: "Home", area: "Clapham, London",
      window: { leaveBy: "05:25" },
      todos: [
        { label: "Passport + boarding pass", icon: "luggage" },
        { label: "Charge the laptop", icon: "code" },
      ] },
    { move: [ { mode: "car", mins: 38, label: "Pre-booked car to Gatwick", to: "Gatwick · South",
        ref: "GET-4471" } ] },
    { id: "lgw", role: "air", icon: "plane", name: "Gatwick Airport", area: "South Terminal",
      window: { arrive: "06:05", leave: "07:15" }, protected: { mins: 40, covers: "the 07:15 departure" },
      transit: { air: { bagDrop: "Zone A", security: "Fast Track", gate: "27" } },
      todos: [ { label: "Coffee airside", icon: "coffee" } ] },
    { flight: { airline: "easyJet · U2 8461", mins: 95, from: "07:15", to: "10:05",
        fromCode: "LGW", fromName: "Gatwick", toCode: "GVA", toName: "Geneva",
        gate: "27", seat: "14C", boarding: "06:45", offline: true,
        pass: { ref: "U2 8461", seat: "14C", gate: "27", boarding: "06:45", class: "Economy" },
        todos: [
          { label: "Read the Lumen Q3 brief", icon: "file", type: "prep", tag: "offline", notes: "12-page brief. Focus on the churn section." },
          { label: "Finalise the 4 review slides", icon: "code", type: "prep", tag: "60 min" },
        ] } },
    { id: "gva", role: "air", icon: "plane", name: "Geneva Airport", area: "GVA · local time +1h",
      window: { arrive: "10:05", leave: "10:30" },
      transit: { air: { bagDrop: null, security: null } },
      todos: [ { label: "Grab local cash", icon: "check" } ] },
    { gap: { type: "route", from: "Geneva Airport", to: "the hotel", note: "You haven't said how you're getting into the city.",
        options: [
          { id: "train", icon: "train", label: "Léman Express", mins: 18, cost: "CHF 3", sub: "6 stops · to Cornavin" },
          { id: "taxi", icon: "car", label: "Taxi", mins: 14, cost: "~CHF 35", sub: "door to door" },
        ] } },
    { id: "hotel", role: "stay", icon: "bed", name: "Mövenpick Genève", area: "Rue de Lausanne 20",
      window: { arrive: "10:55" },
      stay: { checkIn: "15:00", checkOut: "11:00", room: "412", reception: "+41 22 908 1212", base: true,
        actions: [
          { label: "Drop bags", icon: "luggage", when: "now", state: "available" },
          { label: "Check in", icon: "check", when: "from 15:00", state: "later" },
          { label: "Breakfast", icon: "coffee", when: "tomorrow · 06:30–10:00", state: "later" },
          { label: "Check out", icon: "route", when: "tomorrow · by 11:00", state: "later" },
        ] },
      credential: { kind: "Hotel booking", ref: "MV-908231", lines: ["Check-in from 15:00", "1 night · King · breakfast", "Early bag drop confirmed"] } },
    { move: [ { mode: "walk", mins: 6, label: "Walk to Lumen", to: "Rue du Rhône 65" } ] },
    { id: "lumen", role: "work", icon: "briefcase", name: "Lumen SA", area: "Rue du Rhône 65 · Q3 review",
      window: { from: "11:40", to: "13:10" }, scope: "work", addedByWork: true,
      todos: [
        { label: "Walkthrough & roadmap", at: "11:40", icon: "play", scope: "work" },
        { label: "Commercials & next steps", at: "12:40", icon: "file", scope: "work" },
        { label: "Text Sarah — landed safe", at: "13:00", icon: "phone", scope: "personal" },
      ] },
    { gap: { type: "open", from: "13:10", to: "20:00", where: "near Lumen · Old Town",
        boundedBy: { place: "Brasserie Lipp", at: "20:00" },
        onward: { mode: "walk", mins: 9, to: "Brasserie Lipp" },
        note: "Open until you head to dinner — the onward walk still has to happen.",
        stay: [
          { icon: "coffee", label: "Coffee & emails nearby", sub: "walk to dinner after" },
          { icon: "walk", label: "Old Town wander", sub: "loop back for the walk" },
          { icon: "code", label: "Prep call with Priya", sub: "fits the window", fromUnplaced: "Call Priya" },
        ],
        goNow: { label: "Head over early", sub: "spend it at the restaurant, not here" } } },
    { id: "dinner", role: "dine", icon: "utensils", name: "Brasserie Lipp", area: "Rue de la Confédération 8",
      window: { arrive: "20:00" },
      credential: { kind: "Reservation", ref: "RES-5512", lines: ["Table for 4 · 20:00", "Under ‘Khonsera’", "Terrace requested"] },
      todos: [ { label: "Confirm headcount", icon: "phone", scope: "work" } ] },
    { move: [ { mode: "walk", mins: 9, label: "Walk back to the hotel", to: "Mövenpick Genève" } ] },
    { id: "hotel2", role: "end", icon: "bed", name: "Mövenpick Genève", area: "Geneva · night",
      window: { arrive: "22:15" }, todos: [] },
  ] },

/* ════════════════════════ 3 · EVENING OUT (local, taxi) ═══════════════════ */
{ id: "evening", label: "Evening out", shape: "Office → Home",
  title: "Theatre night — West End", eyebrow: "Fri 20 Jun · Plan", canWork: false,
  stops: [
    { id: "office", role: "work", icon: "building", name: "The Office", area: "Finishing up",
      window: { leaveBy: "17:30" }, scope: "work",
      todos: [ { label: "Send the weekly note", at: "17:15", icon: "mail", scope: "work" } ] },
    { gap: { from: "The Office", to: "the theatre", note: "Curtain is 19:30 — how are you getting across town?",
        options: [
          { id: "tube", icon: "train", label: "Tube", mins: 26, cost: "£2.80", sub: "Central line · 1 change" },
          { id: "taxi", icon: "car", label: "Taxi", mins: 32, cost: "~£24", sub: "traffic-dependent" },
        ] } },
    { id: "dinner", role: "dine", icon: "utensils", name: "Dishoom", area: "Kingly Street · pre-theatre",
      window: { arrive: "18:15" }, protected: { mins: 20, covers: "the 19:30 curtain" },
      credential: { kind: "Reservation", ref: "DSH-7741", lines: ["Table for 2 · 18:15", "Pre-theatre menu", "Under ‘Sarah’"] },
      todos: [ { label: "Pre-order the black daal", icon: "check", scope: "personal" } ] },
    { move: [ { mode: "walk", mins: 7, label: "Walk to the theatre", to: "Sondheim Theatre" } ] },
    { id: "show", role: "event", icon: "ticket", name: "Sondheim Theatre", area: "Les Misérables · 19:30",
      window: { from: "19:30", to: "22:20" },
      credential: { kind: "Theatre tickets", ref: "TKT-2290", lines: ["2 × Stalls · Row H", "Doors 19:00", "E-tickets · scan at door"] },
      todos: [] },
    { gap: { from: "the theatre", to: "home", note: "Late finish — set the way home now so it’s ready.",
        options: [
          { id: "taxi", icon: "car", label: "Taxi home", mins: 34, cost: "~£28", sub: "booked for 22:25" },
          { id: "tube", icon: "train", label: "Last tube", mins: 41, cost: "£2.80", sub: "tight after curtain" },
        ] } },
    { id: "home", role: "end", icon: "home", name: "Home", area: "Clapham · day complete",
      window: { arrive: "23:05" }, todos: [] },
  ] },

/* ════════════════ 4 · FIELD DAY — work as a GOVERNING CONTAINER ════════════ */
{ id: "field", label: "Field day", shape: "Mobile · multi-site",
  title: "Field day — East Midlands", eyebrow: "Wed 18 Jun · Plan", canWork: true,
  stops: [
    { id: "home", role: "start", icon: "home", name: "Home", area: "Wellingborough",
      window: { leaveBy: "07:40" }, todos: [ { label: "Load the demo kit", icon: "luggage" } ] },
    { move: [ { mode: "car", mins: 35, label: "Drive to first customer", to: "Vocation Brewery, Derby", ref: "pool car · WX21 ZRT" } ] },
    // A work CONTAINER: an outer window that governs a stretch of the day and
    // holds its own legs, meetings and tasks. It can end away from where it began.
    { container: { kind: "work", name: "Field day", area: "3 customer sites · ends in Buxton",
        window: { from: "09:00", to: "17:30" }, endsAway: "Buxton",
        generates: ["Mileage log", "Expense capture", "Day-end summary to the team"],
        children: [
          { place: { id: "c1", role: "event", icon: "briefcase", name: "Vocation Brewery", area: "Derby · product demo",
              window: { arrive: "08:55", leave: "10:30" }, scope: "work",
              todos: [ { label: "Run the product demo", at: "09:00", icon: "play", scope: "work" },
                       { label: "Capture requirements", at: "10:00", icon: "file", scope: "work" } ] } },
          { move: [ { mode: "car", mins: 40, label: "Drive between sites", to: "Thornbridge, Bakewell" } ] },
          { place: { id: "c2", role: "event", icon: "briefcase", name: "Thornbridge", area: "Bakewell · quarterly review",
              window: { arrive: "11:15", leave: "12:30" }, scope: "work",
              todos: [ { label: "Quarterly review call", at: "11:20", icon: "video", scope: "work" } ] } },
          { place: { id: "cl", role: "hub", icon: "coffee", name: "Lunch — The Tap", area: "Bakewell",
              window: { arrive: "12:40", leave: "13:20" }, todos: [ { label: "Lunch", icon: "coffee", scope: "personal" } ] } },
          { move: [ { mode: "car", mins: 30, label: "Drive to final site", to: "Buxton Water, Buxton" } ] },
          { place: { id: "c3", role: "event", icon: "briefcase", name: "Buxton Water", area: "Buxton · close-out",
              window: { arrive: "14:00", leave: "16:30" }, scope: "work",
              todos: [ { label: "Close-out & next steps", at: "14:10", icon: "file", scope: "work" },
                       { label: "Log fuel receipts", at: "16:15", icon: "check", scope: "work" } ] } },
        ] } },
    { move: [ { mode: "car", mins: 55, label: "Drive home", to: "Home" } ] },
    { id: "home2", role: "end", icon: "home", name: "Home", area: "Wellingborough · day complete",
      window: { arrive: "17:25" }, todos: [] },
  ] },

/* ════════════════ GALLERY · GAP TYPES (showcase of #2) ════════════════════ */
{ id: "gaps", label: "Gap types", shape: "Showcase", canWork: false,
  title: "Every kind of gap", eyebrow: "Reference · Plan", noWallet: true,
  stops: [
    { id: "a", role: "start", icon: "home", name: "A real day has many kinds of gap", area: "not all of them are problems", window: {}, todos: [] },
    { gap: { type: "waiting", mins: 18, where: "on the platform", note: "You're early for the 06:40. Nothing to do but wait." } },
    { gap: { type: "usable", mins: 50, where: "before the review", note: "Enough for one real thing — a prep call or the inbox.", cta: "Drop a task in" } },
    { gap: { type: "spare", mins: 12, where: "before boarding", note: "Your safety margin. If the train slips, this absorbs it first." } },
    { gap: { type: "risky", mins: 4, where: "the Luton change", risk: "tight", note: "Only 4 min to cross — a delay breaks the connection.", cta: "See the fallback" } },
    { gap: { type: "idle", mins: 35, where: "Geneva", note: "You're somewhere with nothing scheduled and nowhere to be." } },
    { gap: { type: "detour", mins: 15, where: "near Cornavin", note: "Coffee, flowers, an errand — only if you want it.", cta: "Add a detour" } },
    { id: "z", role: "end", icon: "check", name: "Each behaves differently", area: "waiting · usable · spare · risky · idle · detour", window: {}, todos: [] },
  ] },

/* ════════════════ GALLERY · SPECIAL CARDS (showcase of #12) ═══════════════ */
{ id: "cards", label: "Special cards", shape: "Showcase", canWork: false,
  title: "Special cards", eyebrow: "Reference · Plan", noWallet: true,
  stops: [
    { id: "s", role: "start", icon: "home", name: "Every modality gets a crafted card", area: "not collapsed into a generic leg", window: {}, todos: [] },
    { move: [ { mode: "coach", mins: 130, label: "National Express to Victoria", to: "London Victoria", ref: "NX · seat 14" } ] },
    { move: [ { mode: "eurostar", mins: 138, label: "Eurostar to Paris Nord", to: "Paris Nord", ref: "9024 · coach 7" } ] },
    { move: [ { mode: "ferry", mins: 90, label: "Ferry to Calais", to: "Calais", ref: "DFDS · deck 5" } ] },
    { id: "hire", role: "hub", icon: "key", name: "Car hire — Europcar", area: "pickup desk · Terminal 2",
      window: { arrive: "10:30" },
      credential: { kind: "Pass", ref: "EC-44182", lines: ["Group D · automatic", "Pickup 10:30 · return tomorrow 18:00", "Excess waiver included"] },
      todos: [ { label: "Photograph any damage", icon: "check" } ] },
    { id: "park", role: "hub", icon: "car", name: "Bold Lane Car Park", area: "level 3 · bay 214",
      window: { arrive: "13:44" },
      credential: { kind: "Parking", ref: "PK-7781", lines: ["Paid until 18:00", "Scan QR at exit", "Level 3 · bay 214"] }, todos: [] },
    { id: "lounge", role: "hub", icon: "sofa", name: "Aspire Lounge", area: "airside · before the gate",
      window: { arrive: "06:20", leave: "06:45" }, protected: { mins: 25, covers: "the 07:15 boarding" },
      credential: { kind: "Pass", ref: "LNG-2231", lines: ["Single entry · 1 guest", "Wi-Fi + breakfast", "Show QR at desk"] } },
    { id: "lug", role: "hub", icon: "luggage", name: "Left luggage — Excess Baggage Co", area: "concourse",
      window: { arrive: "11:10" }, todos: [ { label: "Store the case", icon: "luggage" }, { label: "Collect by 17:00", icon: "check" } ] },
    { id: "rdv", role: "event", icon: "users", name: "Meet Sam", area: "rendezvous · under the clock, St Pancras",
      window: { arrive: "12:30" }, todos: [ { label: "Text on arrival", icon: "phone", scope: "personal" } ] },
    { id: "errand", role: "dine", icon: "coffee", name: "Errand — pick up dry cleaning", area: "5-min detour",
      window: { arrive: "16:40" }, todos: [ { label: "Collect order #3391", icon: "check", scope: "personal" } ] },
    { id: "exp", role: "hub", icon: "receipt", name: "Expenses", area: "capture as you go",
      window: {}, todos: [ { label: "Snap the lunch receipt", icon: "receipt", scope: "work" }, { label: "Log mileage", icon: "car", scope: "work" } ] },
    { id: "e", role: "end", icon: "check", name: "Coach · Eurostar · ferry · hire · parking · lounge · storage · rendezvous · errand · receipts", area: "all first-class", window: {}, todos: [] },
  ] },

];
