import { toggleDemoMode } from "@/app/(app)/demo-mode-actions";
import { isDemoModeActive } from "@/lib/demo-mode";

export async function DemoModeIndicator() {
  const on = await isDemoModeActive();

  return (
    <div className="cc-demo-setting">
      <form action={toggleDemoMode}>
        <input type="hidden" name="next" value={on ? "off" : "on"} />
        <button
          type="submit"
          className="cc-demo-toggle"
          data-active={on ? "true" : "false"}
          role="switch"
          aria-checked={on}
          title="Staff only. Switches Today between your account data and an isolated scenario."
        >
          <span className="cc-demo-toggle-track" aria-hidden>
            <span className="cc-demo-toggle-thumb" />
          </span>
          <span className="cc-demo-toggle-copy">
            <strong>Demo scenario</strong>
            <span>{on ? "Showing sample Today" : "Showing your real Today"}</span>
          </span>
          <span className="cc-demo-toggle-state">{on ? "On" : "Off"}</span>
        </button>
      </form>
      <p className="cc-demo-setting-note">
        When on, Today uses isolated staff scenario data. When off, Today reads
        your actual itinerary. Both use the same production components; the demo
        cannot write to your plan.
      </p>
    </div>
  );
}
