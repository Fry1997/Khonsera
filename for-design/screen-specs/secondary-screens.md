# SCREEN SPEC — SECONDARY SCREENS

Lower craft-ceiling than Planner/Today, but they must belong to the same family (Edition II skin, the
`.cc-*` components, mobile-first, the shell). Each composes contract components you've already styled
— mostly they just need **layout + states + empty states** designed, plus any new list-row treatments.

Each: design **mobile (390) as the source of truth**, plus desktop (1280) centred. All states incl.
**empty** and **loading**.

## Tasks  (`/tasks`)
A simple to-do surface. Components: `TaskRow` (`.cc-task-row[data-done]`) + an add affordance.
States: list · empty ("nothing on your list") · adding · a done section (struck-through, sage tick).
Date-bearing tasks note the day. Calm; no per-row clutter.

## People / Clients  (`/contacts`; in Work mode this slot is **Clients** → the customer/visit CRM)
- **People** (personal + work) — `ContactChip` (`.cc-contact-chip[data-bound]`) grid/list + quick-add
  by name; a person opens detail (channels: phone/email/WhatsApp). States: list · empty · add.
- **Clients** (Work mode) — the lightweight CRM: customers + sites + visits. Needs a list + a client
  detail (sites, contacts, visit history). Keep it quiet; same family. (Customer *sites* are places
  the Planner uses in all modes — design the place reference consistently.)

## Expenses  (`/expenses`)
A per-journey ledger. `ExpenseRow` (`.cc-expense-row`) + a running total; add-expense; receipt thumb.
States: list · empty · add. (Work mode later adds allowance/per-diem — out of scope this round.)

## Settings  (`/settings`)
Profile + home/base address + notification channel + palette (staff) + sign out. Plain, grouped
sections; the home/base is the Planner's default start. States: default · editing.

## Workspace  (`/workspace`, Work mode only)
The teams stub: workspace name + your role + member count, and placeholder sections (approvals,
allowance/per-diem, travel policy). In **Personal** mode this screen states the privacy boundary
("workspaces are a work-mode thing; your personal travel is never visible to a workspace").

## Welcome / first-run  (`/welcome`, chromeless)
The §3 first minute: Khonsera's warm self-intro + the **honest fork** ("Something's coming up" /
"Find me later"), then a "booked?" sub-step. No nav chrome. The brand's first impression after the
landing — design it to match.

## What to return

For each: layout + every state (incl. empty/loading) × the two sizes; additive CSS by class (extend
the existing `.cc-*`; add list/section classes as needed); a class map; light redlines. Tokens only;
calm; no emojis; copy as Khonsera.
