import { cookies } from "next/headers";
import { toggleDemoMode } from "@/app/(app)/demo-mode-actions";

export async function DemoModeIndicator() {
  const store = await cookies();
  const on = store.get("journies_demo_mode")?.value === "on";

  return (
    <form action={toggleDemoMode}>
      <input type="hidden" name="next" value={on ? "off" : "on"} />
      <button
        type="submit"
        className={`w-full rounded-md px-2 py-1.5 text-left text-xs font-medium ${
          on
            ? "bg-amber-500/20 text-amber-900"
            : "border border-dashed border-border text-muted-foreground"
        }`}
        title="Staff only. Injects realistic mock data into integration stubs."
      >
        Demo mode: {on ? "on (staff)" : "off"}
      </button>
    </form>
  );
}
