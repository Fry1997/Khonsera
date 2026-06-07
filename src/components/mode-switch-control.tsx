"use client";

import { useTransition } from "react";
import { ModeSwitch, type Mode } from "@/components/concierge";
import { switchMode } from "@/lib/actions/mode";

// Shell-level wrapper that binds the presentational ModeSwitch to the persisted
// active mode (server action + cookie). Reachable from every page via the shell.
export function ModeSwitchControl({
  mode,
  size = "sm",
}: {
  mode: Mode;
  size?: "sm" | "md";
}) {
  const [pending, startTransition] = useTransition();
  return (
    <span style={{ opacity: pending ? 0.6 : 1, transition: "opacity var(--dur-fast)" }}>
      <ModeSwitch
        mode={mode}
        size={size}
        onChange={(m) => startTransition(() => switchMode(m))}
      />
    </span>
  );
}
