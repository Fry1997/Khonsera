import { PageShell, ComingSoon } from "@/components/ui/page-shell";

export default function NewVisitPage() {
  return (
    <PageShell
      title="Plan new visit"
      description="Enter the appointment details. We'll check whether it's actually feasible."
    >
      <form className="grid max-w-2xl gap-4">
        <div className="grid gap-2">
          <label className="text-sm font-medium">Customer</label>
          <select className="rounded-md border border-border px-3 py-2 text-sm">
            <option>Select a customer…</option>
          </select>
          <p className="text-xs text-muted-foreground">
            Customer picker and "add new" — wired in Phase 3.
          </p>
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium">Site</label>
          <select
            className="rounded-md border border-border px-3 py-2 text-sm"
            disabled
          >
            <option>Choose customer first</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Proposed start</label>
            <input
              type="datetime-local"
              className="rounded-md border border-border px-3 py-2 text-sm"
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Meeting duration (min)</label>
            <input
              type="number"
              defaultValue={120}
              className="rounded-md border border-border px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Start location</label>
            <select className="rounded-md border border-border px-3 py-2 text-sm">
              <option>Home</option>
              <option>Office</option>
            </select>
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Travel preference</label>
            <select className="rounded-md border border-border px-3 py-2 text-sm">
              <option value="compare">Compare rail and drive</option>
              <option value="rail">Rail</option>
              <option value="drive">Drive</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Arrival buffer (min)</label>
            <input
              type="number"
              defaultValue={15}
              className="rounded-md border border-border px-3 py-2 text-sm"
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Latest return home</label>
            <input
              type="datetime-local"
              className="rounded-md border border-border px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <input type="checkbox" id="calendar-check" defaultChecked disabled />
          <label htmlFor="calendar-check" className="text-muted-foreground">
            Check calendar conflicts (connect calendar in Settings)
          </label>
        </div>
        <button
          type="button"
          disabled
          className="w-fit rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          title="Phase 4 — feasibility engine wires up here"
        >
          Check feasibility
        </button>
      </form>
      <ComingSoon
        feature="Feasibility check"
        detail="The form submits to the planning engine which produces TravelOptions. Backend is in place (src/lib/planning/feasibility.ts); the submit handler lands in Phase 4."
      />
    </PageShell>
  );
}
