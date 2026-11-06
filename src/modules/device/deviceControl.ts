import { Capacitor, registerPlugin } from '@capacitor/core';
import {
  ContactInfo,
  DeviceActionRequest,
  DeviceActionResult,
  DeviceActionType,
  InstalledAppInfo,
  JarvisSettings,
  PermissionStatusMap,
} from '../../types/jarvis';

interface JarvisPermissionsPlugin {
  getPermissionsStatus(): Promise<{
    microphone: 'granted' | 'denied' | 'prompt';
    camera: 'granted' | 'denied' | 'prompt';
    notifications: 'granted' | 'denied' | 'prompt';
    contacts?: 'granted' | 'denied' | 'prompt';
    phone?: 'granted' | 'denied' | 'prompt';
    androidIntents?: string;
  }>;
  requestNotificationPermission(): Promise<{ notifications: 'granted' | 'denied' | 'prompt' }>;
  requestMicrophonePermission(): Promise<{ microphone: 'granted' | 'denied' | 'prompt' }>;
  requestCameraPermission(): Promise<{ camera: 'granted' | 'denied' | 'prompt' }>;
  requestContactsPermission(): Promise<{ contacts: 'granted' | 'denied' | 'prompt' }>;
  requestPhonePermission(): Promise<{ phone: 'granted' | 'denied' | 'prompt' }>;
}


interface JarvisHardwarePlugin {
  setFlashlight(options: { enabled: boolean }): Promise<{ success: boolean; enabled: boolean; message: string }>;
  getNetworkStatus(): Promise<{ connected: boolean; transport: 'wifi' | 'cellular' | 'ethernet' | 'bluetooth' | 'vpn' | 'other' | 'none'; metered: boolean; androidVersion: string }>;
}

export interface NativeUiNode {
  text: string;
  viewId?: string;
  className?: string;
  clickable: boolean;
  editable: boolean;
}

export interface NativeNotificationItem {
  packageName: string;
  title: string;
  text: string;
  postTime: number;
}

interface JarvisDevicePlugin {
  openApp(options: { packageName: string; targetApp?: string }): Promise<{ success: boolean; message: string }>;
  openDialer(options: { phoneNumber?: string }): Promise<{ success: boolean; message: string }>;
  placeCall(options: { phoneNumber: string }): Promise<{ success: boolean; message: string }>;
  sendSms(options: { phoneNumber?: string; message?: string }): Promise<{ success: boolean; message: string }>;
  sendWhatsApp(options: { phoneNumber?: string; message?: string }): Promise<{ success: boolean; message: string }>;
  setAlarm(options: { hour: number; minute: number; label?: string; skipUi?: boolean }): Promise<{ success: boolean; message: string }>;
  setTimer(options: { seconds: number; label?: string; skipUi?: boolean }): Promise<{ success: boolean; message: string }>;
  getDeviceTelemetry(): Promise<{
    batteryLevel: number;
    isCharging: boolean;
    chargeType: string;
    manufacturer: string;
    model: string;
    device: string;
    androidVersion: string;
    sdkInt: number;
    totalRamMb?: number;
    availRamMb?: number;
    lowMemory?: boolean;
    platform: string;
  }>;
  shareText(options: { title?: string; text?: string; url?: string }): Promise<{ success: boolean; message: string }>;
  showNotification(options: { title: string; body: string; id?: number }): Promise<{ success: boolean; notificationId: number }>;

  // Native Android SpeechRecognizer Bridge
  isSpeechRecognitionAvailable(): Promise<{ available: boolean }>;
  startSpeechRecognition(options: { language?: string }): Promise<{ success: boolean }>;
  stopSpeechRecognition(): Promise<{ success: boolean }>;
  cancelSpeechRecognition(): Promise<{ success: boolean }>;
  addListener(
    eventName: 'speechReady' | 'speechStart' | 'speechEndOfSpeech',
    listenerFunc: (data: { status: string }) => void
  ): Promise<{ remove: () => Promise<void> }>;
  addListener(
    eventName: 'speechRms',
    listenerFunc: (data: { rms: number }) => void
  ): Promise<{ remove: () => Promise<void> }>;
  addListener(
    eventName: 'speechPartial' | 'speechResult',
    listenerFunc: (data: { transcript: string; isFinal: boolean }) => void
  ): Promise<{ remove: () => Promise<void> }>;
  addListener(
    eventName: 'speechError',
    listenerFunc: (data: { errorCode: number; error: string }) => void
  ): Promise<{ remove: () => Promise<void> }>;

  // Quick Android controls (system panels remain user-confirmed)
  openWifiSettings(): Promise<{ success: boolean; message: string }>;
  openBluetoothSettings(): Promise<{ success: boolean; message: string }>;
  setMediaVolume(options: { percent: number }): Promise<{ success: boolean; percent: number; message: string }>;
  setScreenBrightness(options: { percent: number }): Promise<{ success: boolean; percent?: number; permissionRequired?: boolean; message: string }>;
  openCameraCapture(): Promise<{ success: boolean; message: string }>;

  // Accessibility & UI gestures
  isAccessibilityServiceEnabled(): Promise<{ enabled: boolean; foregroundPackage?: string }>;
  openAccessibilitySettings(): Promise<{ success: boolean; message: string }>;
  readScreenText(): Promise<{ success: boolean; foregroundPackage: string; nodeCount: number; nodes: NativeUiNode[] }>;
  performTap(options: { target: string }): Promise<{ success: boolean; message: string }>;
  performScroll(options: { direction: 'up' | 'down' }): Promise<{ success: boolean; message: string }>;
  performInputText(options: { text: string; target?: string }): Promise<{ success: boolean; message: string }>;
  performGlobalAction(options: { action: 'BACK' | 'HOME' | 'NOTIFICATIONS' }): Promise<{ success: boolean; action: string }>;

  // User-enabled floating Dynamic Island overlay
  canDrawFloatingOverlay(): Promise<{ allowed: boolean }>;
  requestFloatingOverlayPermission(): Promise<{ openedSettings: boolean }>;
  startFloatingOverlay(): Promise<{ success: boolean }>;
  stopFloatingOverlay(): Promise<{ success: boolean }>;

  // Background Assistant Foreground Service
  isBackgroundServiceRunning(): Promise<{ running: boolean }>;
  startBackgroundService(): Promise<{ success: boolean; running: boolean }>;
  stopBackgroundService(): Promise<{ success: boolean; running: boolean }>;

  // Notification Listener
  isNotificationListenerEnabled(): Promise<{ enabled: boolean; connected: boolean }>;
  openNotificationListenerSettings(): Promise<{ success: boolean }>;
  getRecentNotifications(): Promise<{ success: boolean; notifications: NativeNotificationItem[] }>;

  // Default Assistant & Device Admin
  isDefaultAssistant(): Promise<{ isDefault: boolean }>;
  requestDefaultAssistant(): Promise<{ success: boolean }>;
  isDeviceAdminActive(): Promise<{ active: boolean }>;
  requestDeviceAdmin(): Promise<{ success: boolean }>;
  lockDevice(): Promise<{ success: boolean; message: string }>;
  requestIgnoreBatteryOptimizations(): Promise<{ success: boolean }>;

  // Discovery & Contacts
  getInstalledApps(): Promise<{ success: boolean; apps: Array<{ packageName: string; appName: string; isSystemApp: boolean }> }>;
  searchContacts(options: { query?: string }): Promise<{ success: boolean; contacts: ContactInfo[] }>;
}

/** Open Android's user-controlled Wi-Fi panel. Android does not allow ordinary apps to toggle Wi-Fi silently. */
export async function openWifiControls() {
  if (!Capacitor.isNativePlatform()) return { success: false, message: 'Available in the Android app only.' };
  return JarvisNativeDevice.openWifiSettings();
}

/** Open Android's user-controlled Bluetooth panel. */
export async function openBluetoothControls() {
  if (!Capacitor.isNativePlatform()) return { success: false, message: 'Available in the Android app only.' };
  return JarvisNativeDevice.openBluetoothSettings();
}

export async function setMediaVolumePercent(percent: number) {
  if (!Capacitor.isNativePlatform()) return { success: false, percent: 0, message: 'Available in the Android app only.' };
  return JarvisNativeDevice.setMediaVolume({ percent: Math.max(0, Math.min(100, Math.round(percent))) });
}

export async function setScreenBrightnessPercent(percent: number) {
  if (!Capacitor.isNativePlatform()) return { success: false, permissionRequired: false, message: 'Available in the Android app only.' };
  return JarvisNativeDevice.setScreenBrightness({ percent: Math.max(1, Math.min(100, Math.round(percent))) });
}

export async function launchCameraForUserCapture() {
  if (!Capacitor.isNativePlatform()) return { success: false, message: 'Available in the Android app only.' };
  return JarvisNativeDevice.openCameraCapture();
}

export const JarvisNativePermissions = registerPlugin<JarvisPermissionsPlugin>('JarvisPermissions');
export const JarvisNativeDevice = registerPlugin<JarvisDevicePlugin>('JarvisDevice');
export const JarvisNativeHardware = registerPlugin<JarvisHardwarePlugin>('JarvisHardware');

/** Toggle the Android camera torch. Camera permission may be requested by the app first. */
export async function setFlashlight(enabled: boolean) {
  if (!Capacitor.isNativePlatform()) return { success: false, enabled: false, message: 'Flashlight control is available in the Android app only.' };
  return JarvisNativeHardware.setFlashlight({ enabled });
}

/** Read the active Android network transport without exposing Wi-Fi credentials. */
export async function getNativeNetworkStatus() {
  if (!Capacitor.isNativePlatform()) return { connected: navigator.onLine, transport: 'other' as const, metered: true, androidVersion: 'web' };
  return JarvisNativeHardware.getNetworkStatus();
}

const DEFAULT_KNOWN_PACKAGES: Record<string, { pkg: string; scheme: string; webFallback: string }> = {
  youtube: {
    pkg: 'com.google.android.youtube',
    scheme: 'vnd.youtube://',
    webFallback: 'https://m.youtube.com',
  },
  telegram: {
    pkg: 'org.telegram.messenger',
    scheme: 'tg://',
    webFallback: 'https://web.telegram.org',
  },
  whatsapp: {
    pkg: 'com.whatsapp',
    scheme: 'whatsapp://',
    webFallback: 'https://web.whatsapp.com',
  },
  spotify: {
    pkg: 'com.spotify.music',
    scheme: 'spotify://',
    webFallback: 'https://open.spotify.com',
  },
  maps: {
    pkg: 'com.google.android.apps.maps',
    scheme: 'geo:0,0?q=',
    webFallback: 'https://maps.google.com',
  },
  gmail: {
    pkg: 'com.google.android.gm',
    scheme: 'mailto:',
    webFallback: 'https://mail.google.com',
  },
  chrome: {
    pkg: 'com.android.chrome',
    scheme: 'googlechrome://',
    webFallback: 'https://www.google.com',
  },
  camera: {
    pkg: 'com.android.camera',
    scheme: 'intent:#Intent;action=android.media.action.IMAGE_CAPTURE;end',
    webFallback: '',
  },
  gallery: {
    pkg: 'com.google.android.apps.photos',
    scheme: 'content://media/internal/images/media',
    webFallback: 'https://photos.google.com',
  },
  settings: {
    pkg: 'com.android.settings',
    scheme: 'intent:#Intent;action=android.settings.SETTINGS;end',
    webFallback: '',
  },
};

export function isAndroidEnvironment(): boolean {
  if (Capacitor.isNativePlatform()) return true;
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent);
}

export async function checkPermissionsStatus(
  accessibilitySettingEnabled = false,
  screenCaptureActive = false
): Promise<PermissionStatusMap> {
  let microphone: PermissionStatusMap['microphone'] = 'prompt';
  let camera: PermissionStatusMap['camera'] = 'prompt';
  let notifications: PermissionStatusMap['notifications'] = 'prompt';
  let contacts: PermissionStatusMap['contacts'] = 'prompt';
  let phone: PermissionStatusMap['phone'] = 'prompt';
  let accessibilityAuthorized: PermissionStatusMap['accessibilityService'] = 'unauthorized';
  let backgroundService: PermissionStatusMap['backgroundService'] = 'stopped';
  let deviceAdmin: PermissionStatusMap['deviceAdmin'] = 'inactive';

  if (Capacitor.isNativePlatform()) {
    try {
      const nativeStatus = await JarvisNativePermissions.getPermissionsStatus();
      if (nativeStatus.microphone) microphone = nativeStatus.microphone;
      if (nativeStatus.camera) camera = nativeStatus.camera;
      if (nativeStatus.notifications) notifications = nativeStatus.notifications;
      if (nativeStatus.contacts) contacts = nativeStatus.contacts;
      if (nativeStatus.phone) phone = nativeStatus.phone;
    } catch {
      // Ignore
    }

    try {
      const acc = await JarvisNativeDevice.isAccessibilityServiceEnabled();
      accessibilityAuthorized = acc.enabled ? 'authorized' : 'unauthorized';
    } catch {
      accessibilityAuthorized = accessibilitySettingEnabled ? 'authorized' : 'unauthorized';
    }

    try {
      const bg = await JarvisNativeDevice.isBackgroundServiceRunning();
      backgroundService = bg.running ? 'running' : 'stopped';
    } catch {
      // Ignore
    }

    try {
      const da = await JarvisNativeDevice.isDeviceAdminActive();
      deviceAdmin = da.active ? 'active' : 'inactive';
    } catch {
      // Ignore
    }
  } else {
    accessibilityAuthorized = accessibilitySettingEnabled ? 'authorized' : 'unauthorized';
  }

  if (microphone === 'prompt' && typeof navigator !== 'undefined' && navigator.permissions) {
    try {
      const micPerm = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      microphone = micPerm.state;
    } catch {
      // preserve
    }
  }

  if (camera === 'prompt' && typeof navigator !== 'undefined' && navigator.permissions) {
    try {
      const camPerm = await navigator.permissions.query({ name: 'camera' as PermissionName });
      camera = camPerm.state;
    } catch {
      // preserve
    }
  }

  if (notifications === 'prompt' && typeof Notification !== 'undefined') {
    notifications = Notification.permission === 'default' ? 'prompt' : Notification.permission;
  } else if (!Capacitor.isNativePlatform() && typeof Notification === 'undefined') {
    notifications = 'unsupported';
  }

  const wakeLock =
    typeof navigator !== 'undefined' && 'wakeLock' in navigator ? 'supported' : 'unsupported';

  return {
    microphone,
    camera,
    notifications,
    contacts,
    phone,
    screenCapture: screenCaptureActive ? 'active' : 'ready',
    androidIntents: Capacitor.isNativePlatform() ? 'ready' : 'simulated_web',
    accessibilityService: accessibilityAuthorized,
    wakeLock,
    backgroundService,
    deviceAdmin,
  };
}

export async function requestMicrophonePermission(): Promise<'granted' | 'denied' | 'prompt'> {
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await JarvisNativePermissions.requestMicrophonePermission();
      return res.microphone || 'denied';
    } catch {
      // Fall through
    }
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return 'granted';
  } catch {
    return 'denied';
  }
}

export async function requestCameraPermission(): Promise<'granted' | 'denied' | 'prompt'> {
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await JarvisNativePermissions.requestCameraPermission();
      return res.camera || 'denied';
    } catch {
      // Fall through
    }
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach((t) => t.stop());
    return 'granted';
  } catch {
    return 'denied';
  }
}

export async function requestNotificationPermission(): Promise<'granted' | 'denied' | 'prompt'> {
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await JarvisNativePermissions.requestNotificationPermission();
      return res.notifications || 'denied';
    } catch {
      // Fall through
    }
  }
  try {
    if (typeof Notification === 'undefined') return 'denied';
    const result = await Notification.requestPermission();
    return result === 'default' ? 'prompt' : result;
  } catch {
    return 'denied';
  }
}

export async function requestContactsPermission(): Promise<'granted' | 'denied' | 'prompt'> {
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await JarvisNativePermissions.requestContactsPermission();
      return res.contacts || 'denied';
    } catch {
      // Ignore
    }
  }
  return 'denied';
}

export async function requestPhonePermission(): Promise<'granted' | 'denied' | 'prompt'> {
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await JarvisNativePermissions.requestPhonePermission();
      return res.phone || 'denied';
    } catch {
      // Ignore
    }
  }
  return 'denied';
}

export async function readLiveDeviceTelemetry(): Promise<string> {
  if (Capacitor.isNativePlatform()) {
    try {
      const data = await JarvisNativeDevice.getDeviceTelemetry();
      const chargeStr = data.isCharging ? `Charging (${data.chargeType})` : 'Discharging';
      const ramStr = data.totalRamMb ? ` · RAM: ${data.availRamMb || 0}MB free / ${data.totalRamMb}MB` : '';
      return `Android: ${data.manufacturer} ${data.model} (v${data.androidVersion}, SDK ${data.sdkInt}) · Battery: ${data.batteryLevel}% (${chargeStr})${ramStr}`;
    } catch {
      // Fall through
    }
  }

  const parts: string[] = [];
  const isAndroid = isAndroidEnvironment();
  parts.push(`Platform: ${isAndroid ? 'Android Mobile OS' : 'Web Runtime'}`);

  if (typeof navigator !== 'undefined') {
    parts.push(`Network: ${navigator.onLine ? 'Online' : 'Offline'}`);
    const navWithBattery = navigator as Navigator & {
      getBattery?: () => Promise<{ level: number; charging: boolean }>;
      deviceMemory?: number;
    };
    if (typeof navWithBattery.getBattery === 'function') {
      try {
        const battery = await navWithBattery.getBattery();
        const pct = Math.round(battery.level * 100);
        parts.push(`Battery: ${pct}% (${battery.charging ? 'Charging' : 'Discharging'})`);
      } catch {
        // Ignore
      }
    }
    if (navWithBattery.deviceMemory) {
      parts.push(`RAM Tier: ~${navWithBattery.deviceMemory} GB`);
    }
    if (navigator.hardwareConcurrency) {
      parts.push(`CPU Cores: ${navigator.hardwareConcurrency}`);
    }
  }

  return parts.join(' · ');
}

/**
 * Resolves application package from user aliases, app manager, or built-in registry.
 */
export function resolveTargetPackage(targetInput: string, settings: JarvisSettings): { pkg: string; name: string } {
  const cleanTarget = (targetInput || 'settings').toLowerCase().trim();

  // Known direct aliases
  if (cleanTarget === 'photos' || cleanTarget === 'gallery') {
    return { pkg: DEFAULT_KNOWN_PACKAGES.gallery.pkg, name: 'Gallery' };
  }
  if (cleanTarget === 'tg' || cleanTarget === 'telegram') {
    return { pkg: DEFAULT_KNOWN_PACKAGES.telegram.pkg, name: 'Telegram' };
  }
  if (cleanTarget === 'yt' || cleanTarget === 'youtube') {
    return { pkg: DEFAULT_KNOWN_PACKAGES.youtube.pkg, name: 'YouTube' };
  }
  if (cleanTarget === 'wa' || cleanTarget === 'whatsapp') {
    return { pkg: DEFAULT_KNOWN_PACKAGES.whatsapp.pkg, name: 'WhatsApp' };
  }
  if (cleanTarget === 'browser' || cleanTarget === 'chrome' || cleanTarget === 'google chrome') {
    return { pkg: DEFAULT_KNOWN_PACKAGES.chrome.pkg, name: 'Chrome' };
  }
  if (cleanTarget === 'camera' || cleanTarget === 'cam') {
    return { pkg: DEFAULT_KNOWN_PACKAGES.camera.pkg, name: 'Camera' };
  }
  if (cleanTarget === 'setting' || cleanTarget === 'settings') {
    return { pkg: DEFAULT_KNOWN_PACKAGES.settings.pkg, name: 'Settings' };
  }

  // 1. Check user configured App Integrations
  if (settings.appIntegrations?.apps) {
    for (const app of settings.appIntegrations.apps) {
      if (!app.enabled) continue;
      if (app.appName.toLowerCase() === cleanTarget || app.packageName.toLowerCase() === cleanTarget) {
        return { pkg: app.packageName, name: app.appName };
      }
      if (app.aliases && app.aliases.some((alias) => cleanTarget.includes(alias.toLowerCase()))) {
        return { pkg: app.packageName, name: app.appName };
      }
    }
  }

  // 2. Check default known registry
  const matchedKey = Object.keys(DEFAULT_KNOWN_PACKAGES).find((k) => cleanTarget.includes(k));
  if (matchedKey) {
    const meta = DEFAULT_KNOWN_PACKAGES[matchedKey];
    return { pkg: meta.pkg, name: matchedKey.charAt(0).toUpperCase() + matchedKey.slice(1) };
  }

  return { pkg: cleanTarget, name: targetInput };
}

/**
 * Executes a native or intent-based device action directly on Android or web runtime.
 */
export async function executeNativeDeviceAction(
  result: DeviceActionResult,
  settings?: JarvisSettings
): Promise<{ success: boolean; message: string }> {
  const req = result.request;
  const actionType = req.actionType;

  if (!Capacitor.isNativePlatform()) {
    if (result.androidIntentUri) {
      window.open(result.androidIntentUri, '_blank');
      return { success: true, message: 'Dispatched intent via web browser.' };
    }
    return { success: true, message: 'Processed simulated action.' };
  }

  try {
    if (actionType === 'OPEN_APP' || actionType === 'OPEN_SETTINGS') {
      const rawTarget = actionType === 'OPEN_SETTINGS' ? 'settings' : req.targetApp || 'settings';
      const resolved = resolveTargetPackage(rawTarget, settings || ({} as JarvisSettings));
      return await JarvisNativeDevice.openApp({ packageName: resolved.pkg, targetApp: resolved.name });
    }

    if (actionType === 'DIAL_NUMBER') {
      return await JarvisNativeDevice.placeCall({ phoneNumber: req.phoneNumberOrContact || '' });
    }

    if (actionType === 'SEND_SMS') {
      return await JarvisNativeDevice.sendSms({ phoneNumber: req.phoneNumberOrContact, message: req.label });
    }

    if (actionType === 'SEND_WHATSAPP') {
      return await JarvisNativeDevice.sendWhatsApp({ phoneNumber: req.phoneNumberOrContact, message: req.label });
    }

    if (actionType === 'SET_ALARM') {
      return await JarvisNativeDevice.setAlarm({
        hour: req.alarmHour ?? 7,
        minute: req.alarmMinute ?? 0,
        label: req.label || 'JARVIS Alarm',
      });
    }

    if (actionType === 'SET_TIMER') {
      return await JarvisNativeDevice.setTimer({
        seconds: req.timerSeconds ?? 60,
        label: req.label || 'JARVIS Timer',
      });
    }

    if (actionType === 'OPEN_WIFI_SETTINGS') return await JarvisNativeDevice.openWifiSettings();
    if (actionType === 'OPEN_BLUETOOTH_SETTINGS') return await JarvisNativeDevice.openBluetoothSettings();
    if (actionType === 'SET_MEDIA_VOLUME') return await JarvisNativeDevice.setMediaVolume({ percent: req.levelPercent ?? 50 });
    if (actionType === 'SET_SCREEN_BRIGHTNESS') return await JarvisNativeDevice.setScreenBrightness({ percent: req.levelPercent ?? 50 });
    if (actionType === 'OPEN_CAMERA') return await JarvisNativeDevice.openCameraCapture();
    if (actionType === 'SET_FLASHLIGHT') {
      const result = await setFlashlight((req.label || '').toLowerCase() !== 'off');
      return { success: result.success, message: result.message };
    }
    if (actionType === 'CHECK_NETWORK_STATUS') {
      const result = await getNativeNetworkStatus();
      return { success: true, message: 'Network: ' + (result.connected ? 'connected' : 'disconnected') + ' via ' + result.transport + (result.metered ? ' (metered)' : '') + '.' };
    }

    if (actionType === 'CHECK_DEVICE_STATUS') {
      const telemetry = await JarvisNativeDevice.getDeviceTelemetry();
      const summary = `Battery: ${telemetry.batteryLevel}% (${telemetry.isCharging ? 'Charging' : 'Battery'}) · ${telemetry.manufacturer} ${telemetry.model} (Android ${telemetry.androidVersion})`;
      return { success: true, message: summary };
    }

    if (actionType === 'NAVIGATE_SCREEN') {
      const gesture = req.navigationGesture || 'SCROLL_DOWN';
      if (gesture === 'BACK') {
        const res = await JarvisNativeDevice.performGlobalAction({ action: 'BACK' });
        return { success: res.success, message: 'Navigated Back' };
      }
      if (gesture === 'HOME') {
        const res = await JarvisNativeDevice.performGlobalAction({ action: 'HOME' });
        return { success: res.success, message: 'Navigated Home' };
      }
      if (gesture === 'SCROLL_DOWN' || gesture === 'SCROLL_UP') {
        const res = await JarvisNativeDevice.performScroll({ direction: gesture === 'SCROLL_DOWN' ? 'down' : 'up' });
        return { success: res.success, message: res.message };
      }
      if (gesture === 'TAP' && req.label) {
        const res = await JarvisNativeDevice.performTap({ target: req.label });
        return { success: res.success, message: res.message };
      }
    }

    if (actionType === 'LOCK_DEVICE') {
      return await JarvisNativeDevice.lockDevice();
    }

    if (result.androidIntentUri) {
      window.open(result.androidIntentUri, '_blank');
      return { success: true, message: 'Intent dispatched.' };
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, message: errorMsg };
  }

  return { success: true, message: 'Action executed successfully.' };
}

/**
 * Determines whether an action qualifies for direct execution without user confirmation.
 */
export function isActionDirectExecution(
  actionType: DeviceActionType,
  request?: DeviceActionRequest
): boolean {
  switch (actionType) {
    case 'OPEN_APP':
    case 'OPEN_SETTINGS':
    case 'DIAL_NUMBER':
      // Opening installed apps (YouTube, Telegram, Chrome, Settings, Gallery, Camera, WhatsApp itself) is direct
      return true;
    case 'NAVIGATE_SCREEN':
      // Back, Home, Scroll up/down, Tap UI buttons, Type text are direct
      return true;
    case 'CHECK_DEVICE_STATUS':
    case 'READ_NOTIFICATIONS':
    case 'WEB_SEARCH_INTENT':
    case 'SET_ALARM':
    case 'SET_TIMER':
    case 'OPEN_WIFI_SETTINGS':
    case 'OPEN_BLUETOOTH_SETTINGS':
    case 'SET_MEDIA_VOLUME':
    case 'SET_SCREEN_BRIGHTNESS':
    case 'OPEN_CAMERA':
    case 'SET_FLASHLIGHT':
    case 'CHECK_NETWORK_STATUS':
      return true;
    default:
      return false;
  }
}

/**
 * Determines whether an action is sensitive and strictly requires explicit user confirmation.
 */
export function isActionConfirmationRequired(
  actionType: DeviceActionType,
  request?: DeviceActionRequest
): boolean {
  // Explicit sensitive categories
  if (
    actionType === 'SEND_SMS' ||
    actionType === 'SEND_WHATSAPP' ||
    actionType === 'LOCK_DEVICE'
  ) {
    return true;
  }

  const label = (request?.label || '').toLowerCase();
  const target = (request?.targetApp || '').toLowerCase();

  // Delete files or data, make payments or purchases, change sensitive security settings
  if (
    label.includes('delete') ||
    label.includes('wipe') ||
    label.includes('remove') ||
    label.includes('format') ||
    label.includes('pay') ||
    label.includes('purchase') ||
    label.includes('buy') ||
    label.includes('security') ||
    label.includes('password') ||
    target.includes('security')
  ) {
    return true;
  }

  return false;
}

/**
 * Validates, plans, and stages incoming AI tool actions according to security policy.
 */
export async function processDeviceAction(
  request: DeviceActionRequest,
  settings: JarvisSettings,
  onScheduleTimerOrAlarm?: (type: 'alarm' | 'timer', label: string, seconds: number) => void
): Promise<DeviceActionResult> {
  const id = `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const timestamp = Date.now();

  if (!settings.phoneControl.enabled) {
    return {
      id,
      request,
      status: 'permission_missing',
      title: 'Phone Control Disabled',
      detail: 'Enable Phone Control in Settings > Phone Control to allow device actions.',
      timestamp,
    };
  }

  const actionType = request.actionType;

  if (actionType === 'SET_FLASHLIGHT') {
    if (!Capacitor.isNativePlatform()) return { id, request, status: 'unsupported', title: 'Android Only', detail: 'Flashlight control is available in the Android app.', timestamp };
    const enabled = (request.label || '').toLowerCase() !== 'off';
    try {
      const permission = await JarvisNativePermissions.getPermissionsStatus();
      if (permission.camera !== 'granted') {
        const granted = await JarvisNativePermissions.requestCameraPermission();
        if (granted.camera !== 'granted') return { id, request, status: 'permission_missing', title: 'Camera Permission Required', detail: 'Allow camera permission to control the flashlight.', timestamp };
      }
      const result = await JarvisNativeHardware.setFlashlight({ enabled });
      return { id, request, status: result.success ? 'confirmed' : 'unsupported', title: enabled ? 'Flashlight On' : 'Flashlight Off', detail: result.message, timestamp };
    } catch (error) {
      return { id, request, status: 'unsupported', title: 'Flashlight Error', detail: error instanceof Error ? error.message : String(error), timestamp };
    }
  }

  if (actionType === 'CHECK_NETWORK_STATUS') {
    if (!Capacitor.isNativePlatform()) return { id, request, status: 'unsupported', title: 'Android Only', detail: 'Native network diagnostics are available in the Android app.', timestamp };
    const result = await JarvisNativeHardware.getNetworkStatus();
    return { id, request, status: 'confirmed', title: 'Network Status', detail: (result.connected ? 'Connected' : 'Disconnected') + ' via ' + result.transport + (result.metered ? ' (metered connection)' : '') + '.', timestamp };
  }

  if (actionType === 'READ_NOTIFICATIONS') {
    if (!Capacitor.isNativePlatform()) {
      return { id, request, status: 'unsupported', title: 'Android Only', detail: 'Notification reading is available in the Android app.', timestamp };
    }
    const permission = await JarvisNativeDevice.isNotificationListenerEnabled();
    if (!permission.enabled || !permission.connected) {
      await JarvisNativeDevice.openNotificationListenerSettings();
      return { id, request, status: 'permission_missing', title: 'Notification Access Required',
        detail: 'Enable JARVIS in Android Notification Access settings, then ask again to read recent notifications.', timestamp };
    }
    const result = await JarvisNativeDevice.getRecentNotifications();
    const summary = result.notifications.length
      ? result.notifications.slice(-10).map((item) => `${item.title}: ${item.text}`).join(' | ')
      : 'There are no recent readable notifications.';
    return { id, request, status: 'confirmed', title: 'Recent Notifications', detail: summary, timestamp };
  }

  // Quick device controls (system panels are opened for the user; no silent Wi-Fi/Bluetooth toggles).
  if (actionType === 'OPEN_WIFI_SETTINGS' || actionType === 'OPEN_BLUETOOTH_SETTINGS') {
    if (!Capacitor.isNativePlatform()) {
      return { id, request, status: 'unsupported', title: 'Android Only', detail: 'This control is available in the Android app.', timestamp };
    }
    const result = actionType === 'OPEN_WIFI_SETTINGS'
      ? await JarvisNativeDevice.openWifiSettings()
      : await JarvisNativeDevice.openBluetoothSettings();
    return { id, request, status: result.success ? 'intent_dispatched' : 'unsupported',
      title: actionType === 'OPEN_WIFI_SETTINGS' ? 'Wi-Fi Controls Opened' : 'Bluetooth Controls Opened',
      detail: result.message, timestamp };
  }

  if (actionType === 'SET_MEDIA_VOLUME') {
    const percent = Math.max(0, Math.min(100, Number(request.levelPercent ?? 50)));
    if (!Capacitor.isNativePlatform()) {
      return { id, request, status: 'unsupported', title: 'Android Only', detail: 'Media volume control is available in the Android app.', timestamp };
    }
    const result = await JarvisNativeDevice.setMediaVolume({ percent });
    return { id, request, status: result.success ? 'confirmed' : 'unsupported',
      title: 'Media Volume Updated', detail: result.message, timestamp };
  }

  if (actionType === 'SET_SCREEN_BRIGHTNESS') {
    const percent = Math.max(1, Math.min(100, Number(request.levelPercent ?? 50)));
    if (!Capacitor.isNativePlatform()) {
      return { id, request, status: 'unsupported', title: 'Android Only', detail: 'Brightness control is available in the Android app.', timestamp };
    }
    const result = await JarvisNativeDevice.setScreenBrightness({ percent });
    return { id, request, status: result.success ? 'confirmed' : 'permission_missing',
      title: result.success ? 'Brightness Updated' : 'Brightness Permission Required',
      detail: result.message, timestamp };
  }

  if (actionType === 'OPEN_CAMERA') {
    if (!Capacitor.isNativePlatform()) {
      return { id, request, status: 'unsupported', title: 'Android Only', detail: 'Camera launch is available in the Android app.', timestamp };
    }
    const result = await JarvisNativeDevice.openCameraCapture();
    return { id, request, status: result.success ? 'intent_dispatched' : 'unsupported',
      title: 'Camera Opened', detail: result.message, timestamp };
  }

  // 1. Device Telemetry (DIRECT EXECUTION)
  if (actionType === 'CHECK_DEVICE_STATUS') {
    const telemetry = await readLiveDeviceTelemetry();
    return {
      id,
      request,
      status: 'confirmed',
      title: 'Device Status Verified',
      detail: telemetry,
      timestamp,
    };
  }

  // 2. Timers (DIRECT EXECUTION)
  if (actionType === 'SET_TIMER') {
    const seconds = Math.max(5, Number(request.timerSeconds || 60));
    const label = request.label || 'JARVIS Timer';
    const intentUri = `intent:#Intent;action=android.intent.action.SET_TIMER;i.android.intent.extra.alarm.LENGTH=${seconds};S.android.intent.extra.alarm.MESSAGE=${encodeURIComponent(
      label
    )};end`;

    if (onScheduleTimerOrAlarm) {
      onScheduleTimerOrAlarm('timer', label, seconds);
    }

    if (Capacitor.isNativePlatform()) {
      JarvisNativeDevice.setTimer({ seconds, label }).catch(() => {});
    }

    return {
      id,
      request,
      status: 'confirmed',
      title: `Timer Active (${seconds}s)`,
      detail: `Active runtime countdown started for "${label}".`,
      androidIntentUri: intentUri,
      timestamp,
    };
  }

  // 3. Alarms (DIRECT EXECUTION)
  if (actionType === 'SET_ALARM') {
    const hour = Math.min(23, Math.max(0, Number(request.alarmHour ?? 7)));
    const minute = Math.min(59, Math.max(0, Number(request.alarmMinute ?? 0)));
    const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    const label = request.label || `Alarm ${timeStr}`;
    const intentUri = `intent:#Intent;action=android.intent.action.SET_ALARM;i.android.intent.extra.alarm.HOUR=${hour};i.android.intent.extra.alarm.MINUTES=${minute};S.android.intent.extra.alarm.MESSAGE=${encodeURIComponent(
      label
    )};end`;

    const now = new Date();
    const target = new Date();
    target.setHours(hour, minute, 0, 0);
    if (target.getTime() <= now.getTime()) {
      target.setDate(target.getDate() + 1);
    }
    const diffSeconds = Math.max(1, Math.round((target.getTime() - now.getTime()) / 1000));

    if (onScheduleTimerOrAlarm) {
      onScheduleTimerOrAlarm('alarm', `${label} (${timeStr})`, diffSeconds);
    }

    if (Capacitor.isNativePlatform()) {
      JarvisNativeDevice.setAlarm({ hour, minute, label }).catch(() => {});
    }

    return {
      id,
      request,
      status: isAndroidEnvironment() ? 'intent_dispatched' : 'confirmed',
      title: `Alarm Scheduled for ${timeStr}`,
      detail: `Android AlarmClock scheduled for ${timeStr}.`,
      androidIntentUri: intentUri,
      timestamp,
    };
  }

  // 4. Open Application (DIRECT EXECUTION — NO CONFIRMATION)
  // Normal app launches (YouTube, Telegram, Chrome, Settings, Gallery, Camera, WhatsApp itself) must execute directly without confirmation
  if (actionType === 'OPEN_APP' || actionType === 'OPEN_SETTINGS') {
    const rawTarget = actionType === 'OPEN_SETTINGS' ? 'settings' : request.targetApp || 'settings';
    const resolved = resolveTargetPackage(rawTarget, settings);

    if (Capacitor.isNativePlatform()) {
      JarvisNativeDevice.openApp({ packageName: resolved.pkg, targetApp: resolved.name }).catch(() => {});
    }

    const fallbackUri = DEFAULT_KNOWN_PACKAGES[resolved.name.toLowerCase()]?.webFallback || '';

    return {
      id,
      request,
      status: 'intent_dispatched',
      title: `Launching ${resolved.name}`,
      detail: `Directly launched package ${resolved.pkg}.`,
      androidIntentUri: !Capacitor.isNativePlatform() && fallbackUri ? fallbackUri : undefined,
      timestamp,
    };
  }

  // 5. Phone Calls (DIRECT EXECUTION after explicit spoken/user command)
  if (actionType === 'DIAL_NUMBER') {
    const originalTarget = (request.phoneNumberOrContact || '').trim();
    let resolvedName = originalTarget;
    let resolvedNumber = originalTarget;
    if (Capacitor.isNativePlatform() && originalTarget && !/^\+?[\d\s().-]+$/.test(originalTarget)) {
      try {
        const contactMatch = await JarvisNativeDevice.searchContacts({ query: originalTarget });
        const matches = contactMatch.contacts?.filter((contact) => contact.phoneNumber?.trim()) || [];
        const normalizeName = (value: string) => value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
        const exactMatches = matches.filter((contact) =>
          normalizeName(contact.displayName || '') === normalizeName(originalTarget)
        );
        // Prefer a unique exact full-name match over broader partial-name search results.
        const selectedMatches = exactMatches.length > 0 ? exactMatches : matches;
        if (selectedMatches.length === 1) {
          resolvedName = selectedMatches[0].displayName || originalTarget;
          resolvedNumber = selectedMatches[0].phoneNumber || originalTarget;
        } else if (selectedMatches.length > 1) {
          return { id, request, status: 'awaiting_confirmation', title: 'Choose a contact',
            detail: `I found multiple contacts matching "${originalTarget}". Please choose the correct contact before I call.`, timestamp };
        }
      } catch { /* If lookup fails, try a supplied number below. */ }
    }
    const sanitized = resolvedNumber.replace(/[^\d+]/g, '');
    if (!sanitized) {
      return { id, request, status: 'unsupported', title: 'Phone number not found',
        detail: `I couldn't find a phone number for ${resolvedName}. Please provide the number or check Contacts permission.`, timestamp };
    }
    if (Capacitor.isNativePlatform()) {
      try {
        const result = await JarvisNativeDevice.placeCall({ phoneNumber: sanitized });
        return { id, request: { ...request, phoneNumberOrContact: sanitized },
          status: result.success ? 'intent_dispatched' : 'permission_missing',
          title: result.success ? `Calling ${resolvedName}` : 'Phone permission required',
          detail: result.message, timestamp };
      } catch (error) {
        return { id, request, status: 'permission_missing', title: 'Unable to place call',
          detail: error instanceof Error ? error.message : 'Check Phone permission and try again.', timestamp };
      }
    }
    return { id, request, status: 'intent_dispatched', title: `Call ${resolvedName}`,
      detail: `Call request prepared for ${sanitized}.`, androidIntentUri: `tel:${sanitized}`, timestamp };
  }

  // 6. SMS Messages (CONFIRMATION REQUIRED)
  if (actionType === 'SEND_SMS') {
    const target = request.phoneNumberOrContact || '';
    const body = request.label || '';
    const smsUri = `sms:${target.replace(/[^\d+]/g, '')}?body=${encodeURIComponent(body)}`;
    return {
      id,
      request,
      status: 'awaiting_confirmation',
      title: `Send SMS to ${target || 'Recipient'}`,
      detail: `Message: "${body || '(Empty)'}". Sending an SMS requires explicit user confirmation.`,
      androidIntentUri: smsUri,
      timestamp,
    };
  }

  // 7. WhatsApp Messages (CONFIRMATION REQUIRED)
  // Opening WhatsApp itself is direct, but sending a WhatsApp message requires confirmation
  if (actionType === 'SEND_WHATSAPP') {
    const target = (request.phoneNumberOrContact || '').replace(/[^\d]/g, '');
    const body = request.label || '';
    const waUri = target
      ? `https://wa.me/${target}?text=${encodeURIComponent(body)}`
      : `https://wa.me/?text=${encodeURIComponent(body)}`;
    return {
      id,
      request,
      status: 'awaiting_confirmation',
      title: `Send WhatsApp Message to ${request.phoneNumberOrContact || 'Contact'}`,
      detail: `Message: "${body || '(Empty)'}". Sending a message via WhatsApp requires explicit user confirmation.`,
      androidIntentUri: waUri,
      timestamp,
    };
  }

  // 8. Screen Navigation & Accessibility Actions (DIRECT EXECUTION — NO CONFIRMATION)
  // Navigate Back/Home, Scroll up/down, Tap accessible UI buttons, Type ordinary text
  if (actionType === 'NAVIGATE_SCREEN') {
    const gesture = request.navigationGesture || 'SCROLL_DOWN';
    if (Capacitor.isNativePlatform()) {
      try {
        const acc = await JarvisNativeDevice.isAccessibilityServiceEnabled();
        if (!acc.enabled) {
          return {
            id,
            request,
            status: 'permission_missing',
            title: 'Accessibility Service Required',
            detail: 'Please enable JARVIS in Android Accessibility Settings to allow screen navigation.',
            timestamp,
          };
        }
        if (gesture === 'BACK') {
          await JarvisNativeDevice.performGlobalAction({ action: 'BACK' });
        } else if (gesture === 'HOME') {
          await JarvisNativeDevice.performGlobalAction({ action: 'HOME' });
        } else if (gesture === 'SCROLL_DOWN') {
          await JarvisNativeDevice.performScroll({ direction: 'down' });
        } else if (gesture === 'SCROLL_UP') {
          await JarvisNativeDevice.performScroll({ direction: 'up' });
        } else if (gesture === 'TAP' && request.label) {
          await JarvisNativeDevice.performTap({ target: request.label });
        }
      } catch {
        // Continue
      }
    }

    return {
      id,
      request,
      status: 'confirmed',
      title: `Screen Action: ${gesture}`,
      detail: `Directly executed ${gesture} via Android Accessibility Bridge.`,
      timestamp,
    };
  }

  // 9. Lock Screen (CONFIRMATION REQUIRED)
  if (actionType === 'LOCK_DEVICE') {
    return {
      id,
      request,
      status: 'awaiting_confirmation',
      title: 'Lock Phone Screen',
      detail: 'Locking device screen requires explicit user confirmation.',
      timestamp,
    };
  }

  // 10. Generic Sensitive Action check (CONFIRMATION REQUIRED)
  if (isActionConfirmationRequired(actionType, request)) {
    return {
      id,
      request,
      status: 'awaiting_confirmation',
      title: `Confirm Action: ${actionType}`,
      detail: `Sensitive operation for "${request.label || request.targetApp || actionType}" requires user confirmation.`,
      timestamp,
    };
  }

  return {
    id,
    request,
    status: 'confirmed',
    title: `System Action: ${actionType}`,
    detail: `Action processed directly for "${request.label || request.targetApp || actionType}".`,
    timestamp,
  };
}
