// ModeTag — the quiet work/personal classification badge. Edition III D1: the
// day is one unified view; work/personal is not a lens but a per-item privacy
// tag, shown so the blend stays legible. No toggle.
export function ModeTag({ mode }: { mode: "work" | "personal" | null | undefined }) {
  if (!mode) return null;
  return (
    <span className="cc-mode-tag" data-mode={mode}>
      {mode === "work" ? "Work" : "Personal"}
    </span>
  );
}
