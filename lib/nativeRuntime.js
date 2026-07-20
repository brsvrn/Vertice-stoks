"use client";

import { Capacitor } from "@capacitor/core";
import { BarcodeScanner } from "@capacitor-mlkit/barcode-scanning";
import { PushNotifications } from "@capacitor/push-notifications";

export function isNativeApp() {
  return Capacitor.isNativePlatform();
}

export function isAndroidApp() {
  return isNativeApp() && Capacitor.getPlatform() === "android";
}

export async function checkNativeCameraPermission() {
  if (!isNativeApp()) return "unsupported";
  const { camera } = await BarcodeScanner.checkPermissions();
  return camera;
}

export async function requestNativeCameraPermission() {
  if (!isNativeApp()) return "unsupported";
  const { camera } = await BarcodeScanner.requestPermissions();
  return camera;
}

export async function checkNativeNotificationPermission() {
  if (!isNativeApp()) return "unsupported";
  const { receive } = await PushNotifications.checkPermissions();
  return receive;
}

export async function requestNativeNotificationPermission() {
  if (!isNativeApp()) return "unsupported";

  let { receive } = await PushNotifications.checkPermissions();
  if (receive === "prompt" || receive === "prompt-with-rationale") {
    ({ receive } = await PushNotifications.requestPermissions());
  }
  return receive;
}
