# Notes (Prep + Outcome) — Content Entity Research

**Purpose:** ground the NOTES entity — a first-class day-object bound to a Commitment (meeting,
visit, flight, stay) or a Day. Two kinds: **PREP** notes (written before — what the meeting is
about, who you're seeing, what to bring, context) and **OUTCOME** notes (written during/after — what
happened, decisions, follow-ups). For work commitments, outcome notes are reviewable by the
organisation; personal notes stay private.

**Web access:** available. Sources cited inline. Research date: 2026-06-14.

**Scope note:** Notes are a **content/prep entity, NOT a bookable one.** There is no operator app to
replace and no booking API. So unlike the accommodation/flight research, this is not a "make the
Hilton app redundant" exercise. The questions are narrower: *what makes a great travel prep + outcome
note, how do the best tools structure it, and what data shape should Khonsera adopt that survives the
later arrival of attachments and templates without a re-migration.*

---

## PART 1 — How leading tools structure trip / meeting notes

### TripIt — notes are a free-text plan item, not a structured field

TripIt treats a "Note" as its own **plan type** sitting alongside flights, hotels, and car rentals in
the trip timeline. You add one via the trip's plus icon → Note, and it carries a title + free-text
body; on web it's reached via Actions → View Plan Details → More Options → Notes. The stated use is
"time-sensitive reminders that may or may not relate to the actual plans in your trip" — i.e. a
catch-all so everything lives in one unified view. Separately, TripIt added a **Documents** feature
to attach files (confirmations, visas, PDFs) to a trip. Key takeaways for us: (a) a note is a
**timeline-attachable object**, not just a property on another item; (b) **attachments are a
sibling concept** TripIt bolted on later — worth designing for from day one.
Sources: [TripIt add note](https://www.hardreset.info/devices/apps/apps-tripit/add-note-to-trip/),
[Supercharge TripIt with notes](https://emusements.com/supercharge-your-tripit-itineraries-by-adding-custom-notes),
[TripIt documents](https://help.tripit.com/en/support/solutions/articles/103000063361-add-documents-to-a-trip),
[Documents feature blog](https://www.tripit.com/web/blog/news-culture/documents-feature-in-tripit).

### Google Maps / Google Travel — notes attach to a *place*, and lists are shareable

Google Maps lets you write a **note per saved place** and attach **photos** to a location ("buffet
12–3pm" on a restaurant). Notes live inside **Lists** (e.g. "Paris Food Adventures"), and 2025
updates added visited/not-visited filtering and custom list icons. Critically: **sharing a list
shares the notes with it** — recipients see every saved place plus your notes. Takeaways: (a) a note
naturally binds to a *thing* (a place/commitment), not floating free; (b) **photos are a first-class
note attachment**; (c) **sharing scope is set at the container (list) level** — a clean precedent for
Khonsera's per-note share/redaction boundary.
Sources: [We3Travel — Google Maps as travel journal](https://we3travel.com/turn-google-maps-into-your-personal-travel-diary/),
[GeeksOnTour — save & share lists](https://geeksontour.com/2025/09/google-maps-gives-us-a-place-to-save-our-want-to-go-list/),
[Unconventional Route — saved places](https://www.theunconventionalroute.com/google-maps-saved-places/),
[Google Maps Help — save & manage trips](https://support.google.com/maps/answer/10271256).

### Notion / Evernote — templates by type + embedded checklists + attachments

**Notion** meeting-notes templates converge on a stable set of sections: **attendees, agenda, action
items (task + owner + due date), and decisions** — "prepare your agenda ahead of time, jot down
decisions on the fly, and assign follow-up tasks right after the call." Newer templates add **AI
summaries** that auto-extract decisions + action items. **Evernote**'s travel angle adds the prep
side: trip templates bundle **packing lists (tick-off checklists), itinerary, budget/expense
tracking, and reservations/tickets**, with **document scanning and inline images** as attachments,
organised by tags/notebooks. Takeaways: (a) **prep and outcome are different section sets**; (b)
**embedded checklists** ("what to bring") are a core prep affordance; (c) **attachments (docs,
scans, photos)** are expected; (d) **templates-by-type** are the norm.
Sources: [Notion meeting-notes templates](https://www.notion.com/templates/collections/top-free-meeting-notes-templates-in-notion),
[super.so — best Notion meeting templates 2026](https://super.so/templates/notion-meeting-notes-templates),
[Evernote trip template + packing lists](https://evernote.com/user-stories/a-travel-planner-creates-a-trip-template-with-packing-lists),
[Evernote — plan a trip with notes](https://evernote.com/learn/how-to-use-notes-to-plan-a-trip),
[Evernote travel journal](https://evernote.com/learn/how-to-create-a-travel-journal-in-evernote).

### Executive-assistant / chief-of-staff briefing practice

The EA "briefing doc" / "meeting brief" is the gold standard for a PREP note. The canonical layout is
roughly three pages: **page 1 — meeting purpose/objective + attendees and the meeting context; page
2 — background on the company/relationship; page 3 — bios and photos of the people you'll meet.**
Custom fields recommended: **Meeting Date, Location, Attendees, Action Items.** Agenda craft adds:
**clear objectives stated in advance, discussion topics (most important first), time-boxing per
topic, and action items with named owners** — and the brief should reach the principal **≥48h
ahead**. Takeaways: a strong prep note is **objective + attendees(+roles/bios) + agenda + background
+ logistics**, and **who you're meeting (with roles)** is as load-bearing as the agenda.
Sources: [Officepal — event briefing template for EAs](https://www.slideshare.net/Officepal/sample-brief-events),
[The EA Campus — briefing your executive](https://theeacampus.com/blog/briefing-your-executive/),
[Nuroum — executive meeting guide 2025](https://nuroum.com/blog/executive-meeting),
[iBabs — executive meeting agenda template](https://www.ibabs.com/en/board-meetings/executive-meeting-agenda-template/).

### Business trip report — the OUTCOME standard

The "trip report" is the canonical OUTCOME artifact: **purpose/objective, trip details (traveller +
dates), meeting summaries with outcomes, notable achievements/setbacks, client interactions/business
outcomes, actionable next steps,** and an **itemised expense breakdown** (transport, lodging, meals;
receipts, currency, total reimbursable). Follow-ups are explicit ("share minutes within a week";
schedule the next meeting). Takeaway: the outcome note is where **expenses-to-claim and
decisions/next-steps** naturally co-locate, and it's the artifact an **organisation reviews**.
Sources: [travel-code — business trip report templates](https://travel-code.com/news/how-to-make-a-business-trip-report-templates-and-travel-reports),
[Pliant — what a business travel report includes](https://www.getpliant.com/en/blog/what-should-a-business-travel-report-include),
[Engine — write a business travel report](https://engine.com/business-travel-guide/business-travel-report).

### Outcome-note best practice — the action-item rule

Across modern meeting-notes guidance, every **action item needs three things: a clear task
description, a named owner, and a due date** ("a task owned by 'the team' is owned by no one"; "without
a deadline, follow-up becomes optional"). And **decisions must carry their context/"why"** ("a
decision without context invites the same debate three weeks later"). The recommended lifecycle:
**pre (link agenda, confirm attendees, state objectives) → during (capture decisions, action items
with owners/dates) → post (finalise, get approvals, distribute, archive)** — and action items should
**flow out into a real task tracker**, not die in the note.
Sources: [Read.ai — meeting notes best practices](https://www.read.ai/articles/meeting-notes-best-practices-for-better-follow-through),
[Fellow — manage meeting action items (2026)](https://fellow.ai/blog/how-to-manage-meeting-tasks-and-action-items/),
[Umbrex — capturing action items and decisions](https://umbrex.com/resources/how-to-run-effective-meetings/capturing-action-items-and-decisions/).

### Field inventory (distilled)

**A strong PREP note carries:**
- Objective / purpose (why this commitment matters; the single outcome you want)
- Agenda / discussion topics (ordered, optionally time-boxed)
- Attendees + roles (who you're meeting; for key people, a one-line bio/relationship history)
- What to bring (an embedded **checklist** — documents, samples, gifts, ID)
- Dress code
- Logistics / access (door/entrance, parking, security/sign-in, floor/room, wifi, contact-to-call)
- Talking points / questions to ask
- Background / context (relationship history, prior decisions, current state)
- Linked materials / attachments (decks, contracts, maps, photos)

**A strong OUTCOME note carries:**
- Summary (what happened, in a few lines)
- Decisions (each with its "why"/context)
- Action items (task + **owner** + **due date** + status) — flowing to the task layer
- Follow-ups / next steps (incl. "schedule next meeting")
- Sentiment / how it went (optional, often private)
- Expenses to claim (what was spent, reimbursable total) — links to the expense entity
- Open questions / risks

---

## PART 2 — Patterns worth copying

1. **Prep-vs-outcome separation.** Treat them as two note *kinds* on the same commitment, not one
   blob. The prep note is authored before and consumed at the door; the outcome note is authored
   during/after and is the reviewable artifact. They have different section sets, different lifecycles
   (prep goes stale; outcome is permanent record), and different sharing rules (prep is usually
   private working-prep; outcome is what the org sees for work). Both Notion (pre/during/post) and EA
   practice (briefing doc vs trip report) confirm the split.

2. **Templates by commitment type.** A client meeting, a site visit, a personal dinner, and a
   conference want different prep fields (a dinner wants dress code + who's coming + dietary, not an
   agenda; a site visit wants access/PPE/safety + host contact; a conference wants
   sessions/booth/badge). Notion/Evernote and EA practice all ship type-specific templates. **But a
   template is just a default set of sections + checklist items** — it must not be a rigid schema, or
   it fights the "decide and proceed / one toolkit" posture. Recommendation: templates are a
   *seed/preset* layer over a flexible note, **not** a separate table.

3. **Embedded checklists ("what to bring").** Tick-off lists inside the note are a core prep
   affordance (Evernote packing lists, EA "what to bring"). Each item: label + checked-state. This
   doubles as a **readiness** input — an unchecked "passport" item is exactly the kind of thing
   Khonsera's readiness back-calc should surface. Worth storing structured (array of `{label,
   checked}`), not buried in markdown, so the day-of surface can read it.

4. **Attachments (documents, photos).** Every serious tool has them (TripIt Documents, Google Maps
   photos, Evernote scans/images). For Khonsera the travel-day cases are: a deck/contract for the
   meeting, a photo of a whiteboard or a receipt for the outcome, a map/door photo for access. Design
   the note so attachments are a **0..n child relation** from day one (even if the storage backend
   ships later) — never inline them into the body text.

5. **Voice-to-note capture.** The 2025/2026 note market is dominated by voice → transcription →
   auto-summary (Otter, Jamie, Notion AI, Voicenotes). For a *travel-day* concierge this is the
   natural capture mode for outcome notes — you dictate "what happened" walking out of the building.
   This is the **one third-party touch worth flagging**: on-device dictation (Web Speech API /
   `SpeechRecognition`, same family Khonsera already uses for nav voice guidance) covers basic
   capture for free; higher-accuracy transcription/summarisation is a later AI-tier feature (consistent
   with the benched free-text → "AI tier later" decision). Store the raw transcript + (later) a
   summary; do not block the entity on it.

6. **Org-review / sharing model + privacy/redaction.** Google Maps sets sharing at the **container**
   level (share a list → its notes go too). EA practice distributes the **outcome** trip report to
   stakeholders, never the principal's private working-prep. The pattern Khonsera needs:
   - **Personal-mode notes are never visible to the workspace** — same RLS boundary as everything
     else (`can_access_itinerary`); this is the security correctness line, not a UI toggle.
   - For **work** commitments, the **OUTCOME** note is org-reviewable; the **PREP** note (the
     principal's private thinking, talking points, "how I'll play this") defaults **private** and is
     shared only on explicit opt-in. Redaction is naturally achieved by **kind + an explicit
     visibility flag**, not field-level scrubbing: keep the sensitive thinking in the prep note (which
     stays private) and the reportable facts in the outcome note (which the org sees).

---

## PART 3 — Synthesis for Khonsera

### Posture

A Khonsera Note is a **first-class day-object** that **attaches to a Commitment** (an anchor/`stop`
that is a meeting/visit/flight/stay — `Anchor` in the model) **or to a Day** (a `journey` + date,
when the note isn't about one specific commitment — "remember to call the office before 5"). It has a
**kind** (`prep` | `outcome`). It carries **structured fields where the day-of surface needs to read
them** (checklist items, action items, attendees) and **free-text/markdown for everything else**
(objective, agenda, background, summary). It inherits the **work/personal tag** and the **RLS privacy
boundary** from its parent, plus its own **visibility** flag that makes work outcome notes
org-reviewable while keeping prep private by default.

### What's structured vs free-text (pragmatic split)

- **Free-text (markdown `body`)**: objective, agenda, background/context, talking points, dress code,
  logistics, summary, decisions narrative, follow-ups narrative. One body field, kind-aware section
  presets. This is what avoids a rigid template schema and keeps "one toolkit" honest.
- **Structured (separate columns / child rows)** — only where another surface consumes them:
  - **checklist** (prep "what to bring") → feeds readiness. `jsonb` array of `{id, label, checked}`.
  - **action items** (outcome) → feed the Task entity. Start as `jsonb` array of `{id, text, owner,
    due, status}`; promote to real `tasks` rows when the task layer lands (the jsonb survives as the
    capture buffer). Per best practice each carries task + owner + due.
  - **attachments** → a child relation (see below).
  - **attendees / contact** → reuse the existing `contact_id` link on the parent anchor; a note-level
    `contact_ids jsonb` only if multi-attendee briefs are needed before the People layer is deep.

### Recommended data shape (won't need re-migration when attachments/templates arrive)

A single `notes` table + a child `note_attachments` table. Attachments and action-items-as-jsonb mean
no schema break when storage/templates/tasks deepen later.

```sql
-- migration: notes
create table public.notes (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id),
  workspace_id    uuid references public.workspaces(id),         -- null for personal
  app_mode        text not null default 'personal',              -- 'work' | 'personal' (per-item tag)

  -- attachment target: exactly one of stop_id / journey_id is the primary bind.
  journey_id      uuid references public.journeys(id) on delete cascade,  -- the trip/day container
  stop_id         uuid references public.stops(id)   on delete cascade,   -- the commitment (null = day note)
  note_date       date,                                          -- set when it's a Day note (no stop)

  kind            text not null,                                 -- 'prep' | 'outcome'
  title           text,
  body            text,                                          -- markdown free-text (sections by kind)

  -- structured, surface-readable extracts (jsonb so they evolve without migration):
  checklist       jsonb not null default '[]'::jsonb,            -- prep: [{id,label,checked}]
  action_items    jsonb not null default '[]'::jsonb,            -- outcome: [{id,text,owner,due,status}]

  -- sharing / review boundary:
  visibility      text not null default 'private',               -- 'private' | 'org_reviewable'
  -- (work OUTCOME notes default to / can be set org_reviewable; prep stays private; RLS still gates personal)

  -- provenance / capture:
  source          text not null default 'manual',                -- 'manual' | 'voice' | 'template'
  template_key    text,                                          -- which preset seeded it (nullable; templates = presets, not a table)
  transcript      text,                                          -- raw voice transcript when source='voice'

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint notes_kind_chk        check (kind in ('prep','outcome')),
  constraint notes_visibility_chk  check (visibility in ('private','org_reviewable')),
  constraint notes_target_chk      check (stop_id is not null or journey_id is not null)
);
create index notes_stop_idx    on public.notes(stop_id);
create index notes_journey_idx on public.notes(journey_id);
create index notes_user_idx    on public.notes(user_id);

create table public.note_attachments (
  id           uuid primary key default gen_random_uuid(),
  note_id      uuid not null references public.notes(id) on delete cascade,
  kind         text not null,                                    -- 'document' | 'photo' | 'link'
  storage_path text,                                             -- Supabase Storage object path (null for 'link')
  url          text,                                             -- external link (for kind='link')
  filename     text,
  mime_type    text,
  size_bytes   bigint,
  created_at   timestamptz not null default now()
);
create index note_attachments_note_idx on public.note_attachments(note_id);
```

**RLS / privacy:** notes ride the same boundary as their parent — RLS must enforce that personal-mode
notes are never visible to a workspace, mirroring `can_access_itinerary` (migration 0030). For work
notes, a manager/company_admin can read a note **only when `app_mode='work'` AND `kind='outcome'` AND
`visibility='org_reviewable'`** (and they have access to the parent journey via the existing role
checks). Prep notes and any personal note stay owner-only. This puts the redaction boundary in the
**data layer**, not the UI — getting it wrong is a data breach (per CLAUDE.md standing orders).

### Decisions / recommendations

- **Two kinds on one table** (`kind`), not two tables — they share 90% of shape and the split is a
  field, keeping queries and the component simple. Contract component name candidate: `NoteCard`
  (one component, kind-aware), consistent with the existing placeholder family.
- **Templates = presets, not a table.** Ship a small in-code registry of kind+commitment-type
  presets (client-meeting prep, site-visit prep, dinner prep, conference prep, generic outcome) that
  seed `body` section headers + default `checklist` items + suggested `visibility`. `template_key`
  records which one seeded a note. This honours "one toolkit, two views" and avoids a rigid schema.
  Worth it: yes — they're cheap (code) and high-value for the "what to bring" / "who am I meeting"
  prep quality, but they must remain editable defaults.
- **Action items as jsonb now, real tasks later.** The jsonb buffer matches today's reality (Task
  layer is build-spine §8) and becomes the capture surface that promotes into `tasks` rows when that
  lands — no migration needed; the column stays as the editable scratch.
- **Attachments table from day one**, even though Supabase Storage wiring can come later — having the
  relation prevents a re-migration and lets photos/docs/links attach the moment storage is enabled.
- **Third-party touches are minimal and optional:** (1) **Supabase Storage** for attachment blobs
  (first-party to the stack, not really "third-party"); (2) **on-device voice dictation** (Web
  Speech API — already in the codebase for nav guidance) for `source='voice'` capture, with
  higher-accuracy transcription/summarisation deferred to the AI tier. No booking API, no operator
  app — correct for a content entity.

---

## Top 5 takeaways

1. **Prep and outcome are genuinely different notes** sharing one shape — split by a `kind` field,
   different section presets, different default visibility (prep private, work-outcome org-reviewable).
2. **Bind a note to a commitment (stop) or a day (journey + date)** — never floating; both TripIt and
   Google Maps confirm notes want a host object, and the day-note case needs `journey_id` + `note_date`.
3. **Structure only what a surface reads** — checklists (→ readiness) and action items (→ tasks) as
   `jsonb`; everything else is markdown `body`. This avoids a rigid template schema while keeping
   "what to bring" and "action item + owner + due" machine-usable.
4. **The org-review boundary is data-layer, kind-driven** — managers see a note only when it's
   `work` + `outcome` + `org_reviewable`; prep and all personal notes stay owner-only via the same RLS
   line as `can_access_itinerary`. Redaction is achieved by *putting private thinking in the prep
   note*, not by scrubbing fields.
5. **Design attachments + voice in from day one but ship them later** — `note_attachments` child table
   and `source`/`transcript` columns mean no re-migration when Supabase Storage and the AI
   transcription tier arrive; the only real third-party touches are first-party Storage and on-device
   Web Speech dictation.
