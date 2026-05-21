"use client";

// AddBetween — the dashed "+ Add an anchor / + Add another here" pill
// that lives between cards. `between` controls the wording: a
// "between" position (in the middle of a list of anchors) shows
// "Add another here"; the head or tail position shows the more
// general "Add an anchor".
export function AddBetween({
  onAdd,
  between,
}: {
  onAdd: () => void;
  between?: boolean;
}) {
  return (
    <div className={between ? "brief-between brief-between-mid" : "brief-between"}>
      <button type="button" className="brief-between-btn" onClick={onAdd}>
        <span aria-hidden>+</span>
        <span>{between ? "Add another here" : "Add an anchor"}</span>
      </button>
    </div>
  );
}
