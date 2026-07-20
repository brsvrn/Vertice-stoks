"use client";

import { auth } from "./firebase";
import { getActiveCompanyId } from "./tenantRuntime";

/**
 * Sends an inventory event to the server-side notification gateway.
 * Inventory writes remain successful even if a device is temporarily offline
 * or push delivery fails.
 */
export async function sendPushNotificationEvent(event) {
  try {
    const user = auth?.currentUser;
    if (!user) {
      return { success: false, skipped: "AUTH_REQUIRED" };
    }

    const idToken = await user.getIdToken();
    const response = await fetch("/api/notifications/event", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ ...event, companyId: getActiveCompanyId() }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.error || "PUSH_EVENT_FAILED");
    }

    return result;
  } catch (error) {
    console.error("Push notification event could not be sent:", error);
    return { success: false, error: error?.message || "PUSH_EVENT_FAILED" };
  }
}
