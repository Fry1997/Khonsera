// Feature switches. Single source of truth for "what's implemented vs awaiting".
// The UI checks these to render "coming soon" badges instead of broken buttons.
// Flip to true as each integration lands.

export const features = {
  calendarGoogle: true,
  calendarMicrosoft: false,
  routingLive: false,
  railTimetableLive: false,
  railBookingEmbedded: false,
  railBookingDeepLink: false,
  notificationsPush: false,
  notificationsEmail: false,
  expenseExport: false,
} as const;

export type FeatureKey = keyof typeof features;

export function isFeatureLive(key: FeatureKey): boolean {
  return features[key];
}
