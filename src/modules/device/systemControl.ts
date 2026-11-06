import { registerPlugin } from '@capacitor/core';

export type SystemControlResult = { success: boolean; message: string };
export type SystemCapabilities = {
  apiLevel: number;
  writeSettings: boolean;
  overlay: boolean;
  batteryOptimizationExempt: boolean;
  accessibilityEnabled: boolean;
  notificationListenerEnabled: boolean;
  deviceAdminEnabled: boolean;
  dndAccess: boolean;
  usageAccess: boolean;
  exactAlarmsAllowed: boolean;
};

interface JarvisSystemControlPlugin {
  getCapabilities(): Promise<SystemCapabilities>;
  openAccessibilitySettings(): Promise<SystemControlResult>;
  openNotificationListenerSettings(): Promise<SystemControlResult>;
  openUsageAccessSettings(): Promise<SystemControlResult>;
  openDndAccessSettings(): Promise<SystemControlResult>;
  openBatterySettings(): Promise<SystemControlResult>;
  openOverlaySettings(): Promise<SystemControlResult>;
  openAppDetailsSettings(): Promise<SystemControlResult>;
  requestWriteSettings(): Promise<SystemControlResult>;
  requestOverlayPermission(): Promise<SystemControlResult>;
  requestBatteryOptimizationExemption(): Promise<SystemControlResult>;
  requestDeviceAdmin(): Promise<SystemControlResult>;
  lockDevice(options: { confirmed: boolean }): Promise<SystemControlResult>;
  setScreenBrightness(options: { percent: number }): Promise<SystemControlResult>;
  setScreenTimeout(options: { milliseconds: number }): Promise<SystemControlResult>;
  setVolume(options: { percent: number; stream?: 'music' | 'ring' | 'alarm' | 'notification' | 'voice_call' }): Promise<SystemControlResult>;
  setDoNotDisturb(options: { enabled: boolean }): Promise<SystemControlResult>;
  openWifiPanel(): Promise<SystemControlResult>;
  openBluetoothPanel(): Promise<SystemControlResult>;
  openInternetPanel(): Promise<SystemControlResult>;
  openLocationSettings(): Promise<SystemControlResult>;
  openDisplaySettings(): Promise<SystemControlResult>;
  openSoundSettings(): Promise<SystemControlResult>;
  openNfcSettings(): Promise<SystemControlResult>;
  openSecuritySettings(): Promise<SystemControlResult>;
}

export const JarvisSystemControl = registerPlugin<JarvisSystemControlPlugin>('JarvisSystemControl');
