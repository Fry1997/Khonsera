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
        className="chip"
        style={{
          color: on ? "var(--terra)" : "var(--ink-dim)",
          background: on ? "var(--rust-2)" : "transparent",
          border: on ? "1px solid var(--rust-2)" : "1px dashed var(--rule)",
        }}
        title="Staff only. Injects realistic mock data into integration stubs."
      >
        <span className="dot" />
        Demo {on ? "on" : "off"}
      </button>
    </form>
  );
}
