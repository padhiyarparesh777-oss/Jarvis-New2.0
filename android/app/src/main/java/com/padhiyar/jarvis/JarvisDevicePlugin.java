package com.padhiyar.jarvis;

import android.app.ActivityManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.BatteryManager;
import android.os.Build;
import android.provider.AlarmClock;
import androidx.core.app.NotificationCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "JarvisDevice")
public class JarvisDevicePlugin extends Plugin {

    private static final String CHANNEL_ID = "jarvis_alerts";
    private static final String CHANNEL_NAME = "JARVIS AI Alerts";

    @Override
    public void load() {
        super.load();
        createNotificationChannel();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Notifications and timer/alarm alerts from JARVIS AI");
            channel.enableVibration(true);

            NotificationManager manager = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    @PluginMethod
    public void openApp(PluginCall call) {
        String packageName = call.getString("packageName");
        String targetApp = call.getString("targetApp", "Application");

        if (packageName == null || packageName.trim().isEmpty()) {
            call.reject("Package name is required to launch an Android app.");
            return;
        }

        try {
            Context context = getContext();
            PackageManager pm = context.getPackageManager();
            Intent launchIntent = pm.getLaunchIntentForPackage(packageName.trim());

            if (launchIntent != null) {
                launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(launchIntent);

                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("message", "Launched " + targetApp + " (" + packageName + ")");
                call.resolve(ret);
            } else {
                // Fallback to Google Play Store intent if app not installed
                Intent storeIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=" + packageName.trim()));
                storeIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                if (storeIntent.resolveActivity(pm) != null) {
                    context.startActivity(storeIntent);
                    JSObject ret = new JSObject();
                    ret.put("success", true);
                    ret.put("message", targetApp + " not installed. Opened Play Store page.");
                    call.resolve(ret);
                } else {
                    call.reject("Could not resolve application or market intent for " + packageName);
                }
            }
        } catch (Exception e) {
            call.reject("Failed to launch " + targetApp + ": " + e.getMessage());
        }
    }

    @PluginMethod
    public void openDialer(PluginCall call) {
        String phoneNumber = call.getString("phoneNumber", "");
        String sanitized = phoneNumber.replaceAll("[^0-9+*#]", "");

        try {
            Uri dialUri = sanitized.isEmpty() ? Uri.parse("tel:") : Uri.parse("tel:" + Uri.encode(sanitized));
            Intent intent = new Intent(Intent.ACTION_DIAL, dialUri);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("message", "Opened dialer for " + (sanitized.isEmpty() ? "keypad" : sanitized));
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to open dialer: " + e.getMessage());
        }
    }

    @PluginMethod
    public void sendSms(PluginCall call) {
        String phoneNumber = call.getString("phoneNumber", "");
        String message = call.getString("message", "");
        String sanitized = phoneNumber.replaceAll("[^0-9+]", "");

        try {
            Uri smsUri = sanitized.isEmpty() ? Uri.parse("smsto:") : Uri.parse("smsto:" + Uri.encode(sanitized));
            Intent intent = new Intent(Intent.ACTION_SENDTO, smsUri);
            if (!message.isEmpty()) {
                intent.putExtra("sms_body", message);
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("message", "Drafted SMS to " + (sanitized.isEmpty() ? "recipient" : sanitized));
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to prepare SMS: " + e.getMessage());
        }
    }

    @PluginMethod
    public void sendWhatsApp(PluginCall call) {
        String phoneNumber = call.getString("phoneNumber", "");
        String message = call.getString("message", "");
        String cleanPhone = phoneNumber.replaceAll("[^0-9]", "");

        try {
            Context context = getContext();
            Uri.Builder builder = Uri.parse("https://api.whatsapp.com/send").buildUpon();
            if (!cleanPhone.isEmpty()) {
                builder.appendQueryParameter("phone", cleanPhone);
            }
            if (!message.isEmpty()) {
                builder.appendQueryParameter("text", message);
            }

            Intent intent = new Intent(Intent.ACTION_VIEW, builder.build());
            intent.setPackage("com.whatsapp");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            PackageManager pm = context.getPackageManager();
            if (intent.resolveActivity(pm) != null) {
                context.startActivity(intent);
            } else {
                // WhatsApp app not found; open in browser
                Intent webIntent = new Intent(Intent.ACTION_VIEW, builder.build());
                webIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(webIntent);
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("message", "Opened WhatsApp message composer");
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to open WhatsApp: " + e.getMessage());
        }
    }

    @PluginMethod
    public void setAlarm(PluginCall call) {
        Integer hour = call.getInt("hour", 7);
        Integer minute = call.getInt("minute", 0);
        String label = call.getString("label", "JARVIS Alarm");
        Boolean skipUi = call.getBoolean("skipUi", false);

        try {
            Intent intent = new Intent(AlarmClock.ACTION_SET_ALARM);
            intent.putExtra(AlarmClock.EXTRA_HOUR, hour);
            intent.putExtra(AlarmClock.EXTRA_MINUTES, minute);
            intent.putExtra(AlarmClock.EXTRA_MESSAGE, label);
            intent.putExtra(AlarmClock.EXTRA_SKIP_UI, skipUi != null && skipUi);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            Context context = getContext();
            if (intent.resolveActivity(context.getPackageManager()) != null) {
                context.startActivity(intent);
                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("message", String.format("Alarm scheduled for %02d:%02d (%s)", hour, minute, label));
                call.resolve(ret);
            } else {
                call.reject("No Clock app found to handle ACTION_SET_ALARM.");
            }
        } catch (Exception e) {
            call.reject("Failed to set system alarm: " + e.getMessage());
        }
    }

    @PluginMethod
    public void setTimer(PluginCall call) {
        Integer seconds = call.getInt("seconds", 60);
        String label = call.getString("label", "JARVIS Timer");
        Boolean skipUi = call.getBoolean("skipUi", false);

        try {
            Intent intent = new Intent(AlarmClock.ACTION_SET_TIMER);
            intent.putExtra(AlarmClock.EXTRA_LENGTH, seconds);
            intent.putExtra(AlarmClock.EXTRA_MESSAGE, label);
            intent.putExtra(AlarmClock.EXTRA_SKIP_UI, skipUi != null && skipUi);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            Context context = getContext();
            if (intent.resolveActivity(context.getPackageManager()) != null) {
                context.startActivity(intent);
                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("message", String.format("Timer started for %ds (%s)", seconds, label));
                call.resolve(ret);
            } else {
                call.reject("No Clock app found to handle ACTION_SET_TIMER.");
            }
        } catch (Exception e) {
            call.reject("Failed to set system timer: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getDeviceTelemetry(PluginCall call) {
        try {
            Context context = getContext();
            JSObject ret = new JSObject();

            // 1. Battery Telemetry
            IntentFilter ifilter = new IntentFilter(Intent.ACTION_BATTERY_CHANGED);
            Intent batteryStatus = context.registerReceiver(null, ifilter);

            int level = -1;
            int scale = -1;
            boolean isCharging = false;
            String chargeType = "None";

            if (batteryStatus != null) {
                level = batteryStatus.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
                scale = batteryStatus.getIntExtra(BatteryManager.EXTRA_SCALE, -1);
                int status = batteryStatus.getIntExtra(BatteryManager.EXTRA_STATUS, -1);
                isCharging = status == BatteryManager.BATTERY_STATUS_CHARGING ||
                             status == BatteryManager.BATTERY_STATUS_FULL;

                int chargePlug = batteryStatus.getIntExtra(BatteryManager.EXTRA_PLUGGED, -1);
                if (chargePlug == BatteryManager.BATTERY_PLUGGED_USB) chargeType = "USB";
                else if (chargePlug == BatteryManager.BATTERY_PLUGGED_AC) chargeType = "AC Adapter";
                else if (chargePlug == BatteryManager.BATTERY_PLUGGED_WIRELESS) chargeType = "Wireless";
            }

            int batteryPct = (level >= 0 && scale > 0) ? (int) ((level / (float) scale) * 100) : 100;
            ret.put("batteryLevel", batteryPct);
            ret.put("isCharging", isCharging);
            ret.put("chargeType", chargeType);

            // 2. Hardware and OS specifications
            ret.put("manufacturer", Build.MANUFACTURER);
            ret.put("model", Build.MODEL);
            ret.put("device", Build.DEVICE);
            ret.put("androidVersion", Build.VERSION.RELEASE);
            ret.put("sdkInt", Build.VERSION.SDK_INT);

            // 3. RAM Memory status
            ActivityManager actManager = (ActivityManager) context.getSystemService(Context.ACTIVITY_SERVICE);
            if (actManager != null) {
                ActivityManager.MemoryInfo memInfo = new ActivityManager.MemoryInfo();
                actManager.getMemoryInfo(memInfo);
                long totalRamMb = memInfo.totalMem / (1024 * 1024);
                long availRamMb = memInfo.availMem / (1024 * 1024);
                ret.put("totalRamMb", totalRamMb);
                ret.put("availRamMb", availRamMb);
                ret.put("lowMemory", memInfo.lowMemory);
            }

            ret.put("platform", "Android Native (Capacitor)");
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Could not read device telemetry: " + e.getMessage());
        }
    }

    @PluginMethod
    public void shareText(PluginCall call) {
        String title = call.getString("title", "Share with JARVIS");
        String text = call.getString("text", "");
        String url = call.getString("url", "");

        String shareBody = text;
        if (!url.isEmpty()) {
            shareBody = shareBody.isEmpty() ? url : (shareBody + "\n" + url);
        }

        try {
            Intent sendIntent = new Intent(Intent.ACTION_SEND);
            sendIntent.setType("text/plain");
            sendIntent.putExtra(Intent.EXTRA_SUBJECT, title);
            sendIntent.putExtra(Intent.EXTRA_TEXT, shareBody);

            Intent chooser = Intent.createChooser(sendIntent, title);
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(chooser);

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("message", "Opened system share sheet");
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to open share sheet: " + e.getMessage());
        }
    }

    @PluginMethod
    public void showNotification(PluginCall call) {
        String title = call.getString("title", "JARVIS AI");
        String body = call.getString("body", "");
        Integer id = call.getInt("id", (int) (System.currentTimeMillis() % 100000));

        try {
            Context context = getContext();
            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle(title)
                .setContentText(body)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true);

            NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null) {
                manager.notify(id, builder.build());
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("notificationId", id);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to display notification: " + e.getMessage());
        }
    }
}
