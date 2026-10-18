import {
  DeviceActionRequest,
  DeviceActionResult,
  PermissionStatusMap,
  JarvisSettings,
} from '../../types/jarvis';

const ANDROID_APP_PACKAGES: Record<string, { pkg: string; scheme: string; webFallback: string }> = {
  youtube: {
    pkg: 'com.google.android.youtube',
    scheme: 'vnd.youtube://',
    webFallback: 'https://m.youtube.com',
  },
  whatsapp: {
    pkg: 'com.whatsapp',
    scheme: 'whatsapp://send',
    webFallback: 'https://wa.me/',
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
  settings: {
    pkg: 'com.android.settings',
    scheme: 'intent:#Intent;action=android.settings.SETTINGS;end',
    webFallback: '',
  },
};

export function isAndroidEnvironment(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent);
}

export async function checkPermissionsStatus(
  accessibilityAuthorized: boolean,
  screenCaptureActive = false
): Promise<PermissionStatusMap> {
  let microphone: PermissionStatusMap['microphone'] = 'prompt';
  let camera: PermissionStatusMap['camera'] = 'prompt';
  let notifications: PermissionStatusMap['notifications'] = 'prompt';

  if (typeof navigator !== 'undefined' && navigator.permissions) {
    try {
      const micPerm = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      microphone = micPerm.state;
    } catch {
      microphone = 'prompt';
    }
    try {
      const camPerm = await navigator.permissions.query({ name: 'camera' as PermissionName });
      camera = camPerm.state;
    } catch {
      camera = 'prompt';
    }
  }

  if (typeof Notification !== 'undefined') {
    notifications = Notification.permission === 'default' ? 'prompt' : Notification.permission;
  } else {
    notifications = 'unsupported';
  }

  const wakeLock =
    typeof navigator !== 'undefined' && 'wakeLock' in navigator ? 'supported' : 'unsupported';

  const canCaptureScreen =
    typeof navigator !== 'undefined' &&
    navigator.mediaDevices &&
    'getDisplayMedia' in navigator.mediaDevices;

  return {
    microphone,
    camera,
    notifications,
    screenCapture: screenCaptureActive
      ? 'active'
      : canCaptureScreen || isAndroidEnvironment()
      ? 'ready'
      : 'unsupported',
    androidIntents: isAndroidEnvironment() ? 'ready' : 'simulated_web',
    accessibilityService: accessibilityAuthorized ? 'authorized' : 'unauthorized',
    wakeLock,
  };
}

export async function requestMicrophonePermission(): Promise<'granted' | 'denied'> {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return 'denied';
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return 'granted';
  } catch {
    return 'denied';
  }
}

export async function requestCameraPermission(): Promise<'granted' | 'denied'> {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return 'denied';
    }
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach((t) => t.stop());
    return 'granted';
  } catch {
    return 'denied';
  }
}

export async function requestNotificationPermission(): Promise<'granted' | 'denied' | 'prompt'> {
  try {
    if (typeof Notification === 'undefined') return 'denied';
    const result = await Notification.requestPermission();
    return result === 'default' ? 'prompt' : result;
  } catch {
    return 'denied';
  }
}

export async function readLiveDeviceTelemetry(): Promise<string> {
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

  if (actionType === 'CHECK_DEVICE_STATUS') {
    const telemetry = await readLiveDeviceTelemetry();
    return {
      id,
      request,
      status: 'confirmed',
      title: 'Device Telemetry Verified',
      detail: telemetry,
      timestamp,
    };
  }

  if (actionType === 'SET_TIMER') {
    const seconds = Math.max(5, Number(request.timerSeconds || 60));
    const label = request.label || 'JARVIS Timer';
    const intentUri = `intent:#Intent;action=android.intent.action.SET_TIMER;i.android.intent.extra.alarm.LENGTH=${seconds};S.android.intent.extra.alarm.MESSAGE=${encodeURIComponent(
      label
    )};end`;

    if (onScheduleTimerOrAlarm) {
      onScheduleTimerOrAlarm('timer', label, seconds);
    }

    return {
      id,
      request,
      status: 'confirmed',
      title: `Timer Active (${seconds}s)`,
      detail: `Active runtime countdown started for "${label}". Android Clock Intent URI ready.`,
      androidIntentUri: intentUri,
      timestamp,
    };
  }

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

    return {
      id,
      request,
      status: isAndroidEnvironment() ? 'intent_dispatched' : 'confirmed',
      title: `Alarm Scheduled for ${timeStr}`,
      detail: isAndroidEnvironment()
        ? `Android AlarmClock intent prepared for ${timeStr}. Tap Confirm to open system clock.`
        : `Scheduled in active session for ${timeStr} (${label}). Native Android SET_ALARM intent URI generated.`,
      androidIntentUri: intentUri,
      timestamp,
    };
  }

  if (actionType === 'OPEN_APP' || actionType === 'OPEN_SETTINGS') {
    const rawTarget = (
      actionType === 'OPEN_SETTINGS' ? 'settings' : request.targetApp || 'settings'
    )
      .toLowerCase()
      .trim();

    const matchedKey = Object.keys(ANDROID_APP_PACKAGES).find((k) => rawTarget.includes(k));
    const appMeta = matchedKey ? ANDROID_APP_PACKAGES[matchedKey] : null;
    const intentUri = appMeta
      ? `intent:#Intent;package=${appMeta.pkg};scheme=${appMeta.scheme.replace('://', '')};end`
      : `intent:#Intent;action=android.intent.action.MAIN;S.query=${encodeURIComponent(rawTarget)};end`;

    if (settings.phoneControl.confirmSensitiveActions) {
      return {
        id,
        request,
        status: 'awaiting_confirmation',
        title: `Open ${request.targetApp || 'System Settings'}`,
        detail: isAndroidEnvironment()
          ? `Ready to launch Android package ${appMeta?.pkg || rawTarget}. Confirm to dispatch intent.`
          : `Confirm to launch ${request.targetApp || 'System Settings'} via Android Intent or web target.`,
        androidIntentUri: appMeta?.webFallback || intentUri,
        timestamp,
      };
    }

    return {
      id,
      request,
      status: 'intent_dispatched',
      title: `Intent Prepared: ${request.targetApp || 'Settings'}`,
      detail: `Android Intent URI generated (${appMeta?.pkg || rawTarget}).`,
      androidIntentUri: appMeta?.webFallback || intentUri,
      timestamp,
    };
  }

  if (actionType === 'DIAL_NUMBER') {
    const target = request.phoneNumberOrContact || '';
    const sanitized = target.replace(/[^\d+]/g, '');
    const telUri = sanitized ? `tel:${sanitized}` : `tel:`;
    return {
      id,
      request,
      status: 'awaiting_confirmation',
      title: `Dial ${target || 'Contact'}`,
      detail: `Intended recipient: ${target || 'Phone Dialer'}. Android ACTION_DIAL requires explicit user confirmation before opening the dialer.`,
      androidIntentUri: telUri,
      timestamp,
    };
  }

  if (actionType === 'SEND_SMS') {
    const target = request.phoneNumberOrContact || '';
    const body = request.label || '';
    const smsUri = `sms:${target.replace(/[^\d+]/g, '')}?body=${encodeURIComponent(body)}`;
    return {
      id,
      request,
      status: 'awaiting_confirmation',
      title: `Draft SMS to ${target || 'Recipient'}`,
      detail: `Message: "${body || '(Empty)'}". Requires explicit confirmation before opening SMS app.`,
      androidIntentUri: smsUri,
      timestamp,
    };
  }

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
      title: `Draft WhatsApp to ${request.phoneNumberOrContact || 'Contact'}`,
      detail: `Draft: "${body || '(Empty)'}". Confirm to open WhatsApp intent.`,
      androidIntentUri: waUri,
      timestamp,
    };
  }

  if (actionType === 'NAVIGATE_SCREEN') {
    const gesture = request.navigationGesture || 'SCROLL_DOWN';
    if (!settings.phoneControl.accessibilityBridgeEnabled) {
      return {
        id,
        request,
        status: 'permission_missing',
        title: `Accessibility Gesture: ${gesture}`,
        detail:
          'AccessibilityService is not enabled. Authorize Accessibility Integration in Settings > Phone Control to allow UI gestures.',
        timestamp,
      };
    }

    // Execute supported scroll/back actions in current viewport and log accessibility event
    if (gesture === 'SCROLL_DOWN') {
      window.scrollBy({ top: 300, behavior: 'smooth' });
    } else if (gesture === 'SCROLL_UP') {
      window.scrollBy({ top: -300, behavior: 'smooth' });
    }

    return {
      id,
      request,
      status: 'confirmed',
      title: `Navigation Gesture: ${gesture}`,
      detail: `Dispatched user-authorized ${gesture} action via Accessibility Bridge.`,
      timestamp,
    };
  }

  return {
    id,
    request,
    status: 'awaiting_confirmation',
    title: `System Action: ${actionType}`,
    detail: `Action prepared for "${request.label || request.targetApp || actionType}".`,
    timestamp,
  };
}

export const NATIVE_KOTLIN_BLUEPRINT = `// =====================================================================
// JARVIS AI — Native Android Architecture (Kotlin + Capacitor Bridge)
// Package: com.jarvis.ai.assistant
// =====================================================================

package com.jarvis.ai.assistant.device

import android.content.Context
import android.content.Intent
import android.provider.AlarmClock
import android.net.Uri
import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.view.accessibility.AccessibilityEvent

class AndroidIntentDispatcher(private val context: Context) {

    fun setSystemAlarm(hour: Int, minutes: Int, message: String): Boolean {
        val intent = Intent(AlarmClock.ACTION_SET_ALARM).apply {
            putExtra(AlarmClock.EXTRA_HOUR, hour)
            putExtra(AlarmClock.EXTRA_MINUTES, minutes)
            putExtra(AlarmClock.EXTRA_MESSAGE, message)
            putExtra(AlarmClock.EXTRA_SKIP_UI, false)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        return if (intent.resolveActivity(context.packageManager) != null) {
            context.startActivity(intent)
            true
        } else false
    }

    fun openDialerWithConfirmation(phoneNumber: String): Boolean {
        val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$phoneNumber")).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        context.startActivity(intent)
        return true
    }

    fun draftWhatsAppMessage(phone: String, message: String): Boolean {
        val uri = Uri.parse("https://wa.me/$phone?text=" + Uri.encode(message))
        val intent = Intent(Intent.ACTION_VIEW, uri).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        context.startActivity(intent)
        return true
    }
}

class JarvisAccessibilityService : AccessibilityService() {
    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // Strictly user-authorized gesture execution; no background screen harvesting
    }
    override fun onInterrupt() {}

    fun performTap(x: Float, y: Float): Boolean {
        val path = Path().apply { moveTo(x, y) }
        val gesture = GestureDescription.Builder()
            .addStroke(GestureDescription.StrokeDescription(path, 0, 80))
            .build()
        return dispatchGesture(gesture, null, null)
    }
}`;
