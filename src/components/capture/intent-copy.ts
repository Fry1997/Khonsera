// On-brand, honest copy for imperative intents the engine recognises but hasn't
// learned to act on yet (§2.3). Calm, slightly self-aware — never "not implemented".

import type { ImperativeIntent } from "@/lib/dictionary/dictionary";

export const STUB_INTENT_COPY: Record<string, { title: string; body: string }> = {
  search_request: {
    title: "I understood you want me to find something",
    body: "I haven't learned how to search yet, but I've kept this for when I do.",
  },
  booking_request: {
    title: "I understood you want me to book something",
    body: "I can't make bookings myself yet — for now, add it as a plan and I'll help you keep track.",
  },
  cancellation_request: {
    title: "I understood you want to cancel something",
    body: "I can't action cancellations yet. I've noted it so it isn't lost.",
  },
  modification_request: {
    title: "I understood you want to change something",
    body: "I can't reschedule things for you yet — I've kept the note so you can.",
  },
  comparison_request: {
    title: "I understood you want to weigh up options",
    body: "I haven't learned to compare options yet, but I've kept the thought.",
  },
  itinerary_request: {
    title: "I understood you want a route worked out",
    body: "I can't plan the route end-to-end yet. Tell me the stops and I'll lay them out.",
  },
  information_request: {
    title: "I understood you're asking a question",
    body: "I can't answer that one yet, but I've kept it for when I can.",
  },
};

export function stubIntentCopy(intent: ImperativeIntent) {
  return STUB_INTENT_COPY[intent] ?? null;
}
