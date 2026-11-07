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

  // Accessibility & UI gestures
  isAccessibilityServiceEnabled(): Promise<{ enabled: boolean; foregroundPackage?: string }>;
  openAccessibilitySettings(): Promise<{ success: boolean; message: string }>;
  readScreenText(): Promise<{ success: boolean; foregroundPackage: string; nodeCount: number; nodes: NativeUiNode[] }>;
  performTap(options: { target: string }): Promise<{ success: boolean; message: string }>;
  performScroll(options: { direction: 'up' | 'down' }): Promise<{ success: boolean; message: string }>;
  performInputText(options: { text: string; target?: string }): Promise<{ success: boolean; message: string }>;
  performGlobalAction(options: { action: 'BACK' | 'HOME' | 'NOTIFICATIONS' }): Promise<{ success: boolean; action: string }>;

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

export const JarvisNativePermissions = registerPlugin<JarvisPermissionsPlugin>('JarvisPermissions');
export const JarvisNativeDevice = registerPlugin<JarvisDevicePlugin>('JarvisDevice');

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
  let defaultAssistant: PermissionStatusMap['defaultAssistant'] = 'inactive';
  let notificationListener: PermissionStatusMap['notificationListener'] = 'disabled';

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

    try {
      const assistant = await JarvisNativeDevice.isDefaultAssistant();
      defaultAssistant = assistant.isDefault ? 'active' : 'inactive';
    } catch {
      // Ignore
    }

    try {
      const listener = await JarvisNativeDevice.isNotificationListenerEnabled();
      notificationListener = listener.enabled && listener.connected ? 'enabled' : 'disabled';
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
    defaultAssistant,
    notificationListener,
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
      return await JarvisNativeDevice.openDialer({ phoneNumber: req.phoneNumberOrContact });
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
    actionType === 'DIAL_NUMBER' ||
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

  // 5. Phone Calls (CONFIRMATION REQUIRED)
  if (actionType === 'DIAL_NUMBER') {
    let target = request.phoneNumberOrContact || '';
    if (Capacitor.isNativePlatform() && target && !/^\+?\d+$/.test(target)) {
      try {
        const contactMatch = await JarvisNativeDevice.searchContacts({ query: target });
        if (contactMatch.contacts && contactMatch.contacts.length > 0) {
          const first = contactMatch.contacts[0];
          target = `${first.displayName} (${first.phoneNumber || target})`;
        }
      } catch {
        // Ignore
      }
    }

    const sanitized = target.replace(/[^\d+]/g, '');
    const telUri = sanitized ? `tel:${sanitized}` : `tel:`;

    return {
      id,
      request,
      status: 'awaiting_confirmation',
      title: `Place Phone Call: ${target || 'Dialer'}`,
      detail: `Placing a call requires explicit confirmation. Recipient: ${target || 'Phone Dialer'}. Confirm to place call.`,
      androidIntentUri: telUri,
      timestamp,
    };
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
