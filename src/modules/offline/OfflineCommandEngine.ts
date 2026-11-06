import type { DeviceActionRequest } from '../../types/jarvis';

export interface OfflineCommandResult {
  handled: boolean;
  reply: string;
  action?: DeviceActionRequest;
}

const normalize = (value: string) =>
  value.toLocaleLowerCase().replace(/[.,!?]/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Deterministic offline command parser. It intentionally handles only
 * unambiguous, local device commands; it never guesses contact identities
 * or performs network-dependent actions.
 */
export function processOfflineCommand(input: string): OfflineCommandResult {
  const q = normalize(input);
  if (!q) return { handled: false, reply: '' };

  if (/\b(flashlight|flash light|torch)\b|टॉर्च|ફ્લેશલાઇટ/.test(q)) {
    const enabled = !/\b(off|disable| बंद|band|બંધ)\b/.test(q);
    return {
      handled: true,
      reply: enabled ? 'Flashlight ON kar raha hoon.' : 'Flashlight OFF kar raha hoon.',
      action: { actionType: 'SET_FLASHLIGHT', label: enabled ? 'ON' : 'OFF', levelPercent: enabled ? 100 : 0 },
    };
  }

  const volume = q.match(/(?:volume|आवाज|વોલ્યુમ)\s*(?:to|at|करो|कर|પર)?\s*(\d{1,3})/);
  if (volume) {
    const percent = Math.max(0, Math.min(100, Number(volume[1])));
    return { handled: true, reply: `Volume ${percent}% set kar raha hoon.`, action: { actionType: 'SET_MEDIA_VOLUME', levelPercent: percent } };
  }

  const brightness = q.match(/(?:brightness|screen brightness|ब्राइटनेस|બ્રાઇટનેસ)\s*(?:to|at|करो|कर|પર)?\s*(\d{1,3})/);
  if (brightness) {
    const percent = Math.max(1, Math.min(100, Number(brightness[1])));
    return { handled: true, reply: `Brightness ${percent}% set kar raha hoon.`, action: { actionType: 'SET_SCREEN_BRIGHTNESS', levelPercent: percent } };
  }

  if (/\b(open|show|check)\b.*\b(wifi|wi-fi)\b|वाई.?फाई सेटिंग|વાઇફાઇ સેટિંગ/.test(q)) {
    return { handled: true, reply: 'Wi-Fi settings open kar raha hoon.', action: { actionType: 'OPEN_WIFI_SETTINGS' } };
  }
  if (/\b(open|show)\b.*\bbluetooth\b|ब्लूटूथ सेटिंग|બ્લૂટૂથ સેટિંગ/.test(q)) {
    return { handled: true, reply: 'Bluetooth settings open kar raha hoon.', action: { actionType: 'OPEN_BLUETOOTH_SETTINGS' } };
  }
  if (/\b(battery|device status|phone status)\b|बैटरी|બેટરી/.test(q)) {
    return { handled: true, reply: 'Device status check kar raha hoon.', action: { actionType: 'CHECK_DEVICE_STATUS' } };
  }
  if (/\b(open|launch)\s+(camera)\b|कैमरा खोल/.test(q)) {
    return { handled: true, reply: 'Camera open kar raha hoon.', action: { actionType: 'OPEN_CAMERA' } };
  }

  // Never execute communication, purchases, web searches, or ambiguous app/contact commands offline.
  if (/\b(call|phone|dial|message|sms|whatsapp|search|weather|map|navigate)\b/.test(q)) {
    return { handled: true, reply: 'Ye command internet ya extra confirmation maangti hai. Online hone par main ise complete kar sakta hoon.' };
  }

  return { handled: false, reply: '' };
}
