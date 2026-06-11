// Concierge contract components (handover §3 inventory). Placeholders now —
// Design restyles via tokens, screens compose by these names. Don't rename.
export { ModeSwitch } from "./mode-switch";
export { AnchorCard, IntentionCard, GapCard, LegCard } from "./timeline-cards";
export { ActiveTile, type ActiveUrgency } from "./active-tile";
export { JourneyListCard } from "./journey-list-card";
export { ComparisonMatrix } from "./comparison-matrix";
export {
  TicketCard,
  StatusStrip,
  BarcodePresenter,
  ScanView,
  KIND_LABEL,
} from "./document-cards";
export { Pass, PassPeek } from "./pass";
export type { BoardingVM } from "./pass";
export { ContactChip, TaskRow, ExpenseRow } from "./people-ledger";
export { NudgeCard, ReadinessPrompt } from "./feedback";
export * from "./types";
