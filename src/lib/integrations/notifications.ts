import { features } from "@/lib/features";
import { isDemoModeActive } from "@/lib/demo-mode";
import type { IntegrationResult, NotificationInput } from "./types";

export async function sendNotification(
  input: NotificationInput,
): Promise<IntegrationResult<{ id: string }>> {
  if (
    (input.channel === "email" && features.notificationsEmail) ||
    (input.channel === "push" && features.notificationsPush)
  ) {
    return { mode: "unavailable", reason: "Live notifications not yet implemented" };
  }
  if (await isDemoModeActive()) {
    return {
      mode: "demo",
      demo: true,
      data: { id: `demo-notif-${Math.random().toString(36).slice(2, 10)}` },
    };
  }
  return { mode: "unavailable", reason: "Notifications provider not connected." };
}
