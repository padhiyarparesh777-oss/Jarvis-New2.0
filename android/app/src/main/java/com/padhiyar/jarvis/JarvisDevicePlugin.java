package com.padhiyar.jarvis;

import android.app.ActivityManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.admin.DevicePolicyManager;
import android.app.role.RoleManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.database.Cursor;
import android.net.Uri;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.AlarmClock;
import android.provider.ContactsContract;
import android.provider.MediaStore;
import android.provider.Settings;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(name = "JarvisDevice")
public class JarvisDevicePlugin extends Plugin {

    private static final String CHANNEL_ID = "jarvis_alerts";
    private static final String CHANNEL_NAME = "JARVIS AI Alerts";

    private SpeechRecognizer speechRecognizer = null;
    private boolean isListeningSpeech = false;

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
                // Direct fallback for system actions: Settings, Camera, Gallery
                Intent fallbackIntent = null;
                String pkgLower = packageName.toLowerCase();
                String targetLower = targetApp.toLowerCase();

                if (pkgLower.contains("setting") || targetLower.contains("setting")) {
                    fallbackIntent = new Intent(Settings.ACTION_SETTINGS);
                } else if (pkgLower.contains("camera") || targetLower.contains("camera")) {
                    fallbackIntent = new Intent(MediaStore.INTENT_ACTION_STILL_IMAGE_CAMERA);
                    if (fallbackIntent.resolveActivity(pm) == null) {
                        fallbackIntent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                    }
                } else if (pkgLower.contains("gallery") || pkgLower.contains("photo") || targetLower.contains("gallery") || targetLower.contains("photo")) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.ICE_CREAM_SANDWICH_MR1) {
                        fallbackIntent = Intent.makeMainSelectorActivity(Intent.ACTION_MAIN, Intent.CATEGORY_APP_GALLERY);
                    }
                    if (fallbackIntent == null || fallbackIntent.resolveActivity(pm) == null) {
                        fallbackIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("content://media/internal/images/media"));
                    }
                }

                if (fallbackIntent != null) {
                    fallbackIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    if (fallbackIntent.resolveActivity(pm) != null) {
                        context.startActivity(fallbackIntent);
                        JSObject ret = new JSObject();
                        ret.put("success", true);
                        ret.put("message", "Launched " + targetApp + " via system action");
                        call.resolve(ret);
                        return;
                    }
                }

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
    public void placeCall(PluginCall call) {
        String phoneNumber = call.getString("phoneNumber", "").trim();
        String sanitized = phoneNumber.replaceAll("[^0-9+*#]", "");
        if (sanitized.isEmpty()) {
            call.reject("A valid phone number is required.");
            return;
        }
        if (androidx.core.content.ContextCompat.checkSelfPermission(getContext(), android.Manifest.permission.CALL_PHONE)
                != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            call.reject("CALL_PHONE permission is not granted.");
            return;
        }
        try {
            Intent intent = new Intent(Intent.ACTION_CALL, Uri.parse("tel:" + Uri.encode(sanitized)));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("message", "Call initiated to " + sanitized);
            call.resolve(ret);
        } catch (SecurityException e) {
            call.reject("Call permission is required: " + e.getMessage());
        } catch (Exception e) {
            call.reject("Unable to place call: " + e.getMessage());
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

    // =========================================================================
    // ACCESSIBILITY & SCREEN NAVIGATION
    // =========================================================================

    @PluginMethod
    public void isAccessibilityServiceEnabled(PluginCall call) {
        boolean active = JarvisAccessibilityService.isRunning();
        JSObject ret = new JSObject();
        ret.put("enabled", active);
        if (active && JarvisAccessibilityService.getInstance() != null) {
            ret.put("foregroundPackage", JarvisAccessibilityService.getInstance().getForegroundPackage());
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void openAccessibilitySettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("message", "Opened Accessibility Settings");
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to open accessibility settings: " + e.getMessage());
        }
    }

    @PluginMethod
    public void readScreenText(PluginCall call) {
        JarvisAccessibilityService service = JarvisAccessibilityService.getInstance();
        if (service == null) {
            call.reject("Accessibility Service is not enabled. Please enable JARVIS in Android Accessibility Settings.");
            return;
        }

        try {
            JSONArray nodes = service.dumpVisibleUiNodes();
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("foregroundPackage", service.getForegroundPackage());
            ret.put("nodeCount", nodes.length());
            ret.put("nodes", nodes);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to read screen nodes: " + e.getMessage());
        }
    }

    @PluginMethod
    public void performTap(PluginCall call) {
        JarvisAccessibilityService service = JarvisAccessibilityService.getInstance();
        if (service == null) {
            call.reject("Accessibility Service is not enabled.");
            return;
        }

        String target = call.getString("target", "");
        if (target.isEmpty()) {
            call.reject("Target text or viewId is required for tap.");
            return;
        }

        boolean success = service.performTap(target);
        JSObject ret = new JSObject();
        ret.put("success", success);
        ret.put("message", success ? ("Tapped element matching: " + target) : ("No interactive element found matching: " + target));
        call.resolve(ret);
    }

    @PluginMethod
    public void performScroll(PluginCall call) {
        JarvisAccessibilityService service = JarvisAccessibilityService.getInstance();
        if (service == null) {
            call.reject("Accessibility Service is not enabled.");
            return;
        }

        String direction = call.getString("direction", "down");
        boolean forward = direction.equalsIgnoreCase("down");
        boolean success = service.performScroll(forward);

        JSObject ret = new JSObject();
        ret.put("success", success);
        ret.put("message", success ? ("Scrolled screen " + direction) : "Screen not scrollable");
        call.resolve(ret);
    }

    @PluginMethod
    public void performInputText(PluginCall call) {
        JarvisAccessibilityService service = JarvisAccessibilityService.getInstance();
        if (service == null) {
            call.reject("Accessibility Service is not enabled.");
            return;
        }

        String text = call.getString("text", "");
        String target = call.getString("target", "");

        boolean success = service.performInputText(text, target);
        JSObject ret = new JSObject();
        ret.put("success", success);
        ret.put("message", success ? "Entered text successfully" : "No editable field found");
        call.resolve(ret);
    }

    @PluginMethod
    public void performGlobalAction(PluginCall call) {
        JarvisAccessibilityService service = JarvisAccessibilityService.getInstance();
        if (service == null) {
            call.reject("Accessibility Service is not enabled.");
            return;
        }

        String action = call.getString("action", "BACK").toUpperCase();
        boolean success = false;
        if ("BACK".equals(action)) {
            success = service.navigateBack();
        } else if ("HOME".equals(action)) {
            success = service.navigateHome();
        } else if ("NOTIFICATIONS".equals(action)) {
            success = service.openNotifications();
        }

        JSObject ret = new JSObject();
        ret.put("success", success);
        ret.put("action", action);
        call.resolve(ret);
    }

    // =========================================================================
    // BACKGROUND ASSISTANT FOREGROUND SERVICE
    // =========================================================================

    @PluginMethod
    public void isBackgroundServiceRunning(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("running", JarvisBackgroundService.isRunning());
        call.resolve(ret);
    }

    @PluginMethod
    public void startBackgroundService(PluginCall call) {
        try {
            Context ctx = getContext();
            Intent intent = new Intent(ctx, JarvisBackgroundService.class);
            intent.setAction(JarvisBackgroundService.ACTION_START);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ctx.startForegroundService(intent);
            } else {
                ctx.startService(intent);
            }
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("running", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to start background service: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stopBackgroundService(PluginCall call) {
        try {
            Context ctx = getContext();
            Intent intent = new Intent(ctx, JarvisBackgroundService.class);
            intent.setAction(JarvisBackgroundService.ACTION_STOP);
            ctx.startService(intent);
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("running", false);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to stop background service: " + e.getMessage());
        }
    }

    // =========================================================================
    // NOTIFICATION LISTENER
    // =========================================================================

    @PluginMethod
    public void isNotificationListenerEnabled(PluginCall call) {
        Context ctx = getContext();
        Set<String> enabledPackages = NotificationManagerCompat.getEnabledListenerPackages(ctx);
        boolean enabled = enabledPackages != null && enabledPackages.contains(ctx.getPackageName());

        JSObject ret = new JSObject();
        ret.put("enabled", enabled);
        ret.put("connected", JarvisNotificationListenerService.isConnected());
        call.resolve(ret);
    }

    @PluginMethod
    public void openNotificationListenerSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to open notification listener settings: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getRecentNotifications(PluginCall call) {
        JSONArray notifications = JarvisNotificationListenerService.getRecentNotificationsJson();
        JSObject ret = new JSObject();
        ret.put("success", true);
        ret.put("notifications", notifications);
        call.resolve(ret);
    }

    // =========================================================================
    // DEFAULT ASSISTANT & DEVICE ADMIN
    // =========================================================================

    @PluginMethod
    public void isDefaultAssistant(PluginCall call) {
        Context ctx = getContext();
        boolean isAssistant = false;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                RoleManager rm = (RoleManager) ctx.getSystemService(Context.ROLE_SERVICE);
                if (rm != null && rm.isRoleAvailable(RoleManager.ROLE_ASSISTANT)) {
                    isAssistant = rm.isRoleHeld(RoleManager.ROLE_ASSISTANT);
                }
            } else {
                String curAssistant = Settings.Secure.getString(ctx.getContentResolver(), "assistant");
                if (curAssistant != null && curAssistant.contains(ctx.getPackageName())) {
                    isAssistant = true;
                }
            }
        } catch (Exception ignored) {}

        JSObject ret = new JSObject();
        ret.put("isDefault", isAssistant);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestDefaultAssistant(PluginCall call) {
        try {
            Context ctx = getContext();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                RoleManager rm = (RoleManager) ctx.getSystemService(Context.ROLE_SERVICE);
                if (rm != null && rm.isRoleAvailable(RoleManager.ROLE_ASSISTANT) && !rm.isRoleHeld(RoleManager.ROLE_ASSISTANT)) {
                    Intent roleIntent = rm.createRequestRoleIntent(RoleManager.ROLE_ASSISTANT);
                    roleIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    ctx.startActivity(roleIntent);
                    JSObject ret = new JSObject();
                    ret.put("success", true);
                    call.resolve(ret);
                    return;
                }
            }

            Intent voiceIntent = new Intent(Settings.ACTION_VOICE_INPUT_SETTINGS);
            voiceIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(voiceIntent);

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to request assistant role: " + e.getMessage());
        }
    }

    @PluginMethod
    public void isDeviceAdminActive(PluginCall call) {
        Context ctx = getContext();
        DevicePolicyManager dpm = (DevicePolicyManager) ctx.getSystemService(Context.DEVICE_POLICY_SERVICE);
        ComponentName adminComponent = new ComponentName(ctx, JarvisDeviceAdminReceiver.class);
        boolean active = dpm != null && dpm.isAdminActive(adminComponent);

        JSObject ret = new JSObject();
        ret.put("active", active);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestDeviceAdmin(PluginCall call) {
        try {
            Context ctx = getContext();
            ComponentName adminComponent = new ComponentName(ctx, JarvisDeviceAdminReceiver.class);
            Intent intent = new Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN);
            intent.putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, adminComponent);
            intent.putExtra(DevicePolicyManager.EXTRA_ADD_EXPLANATION, "Enables JARVIS to safely lock the screen upon user command.");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(intent);

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to launch device admin prompt: " + e.getMessage());
        }
    }

    @PluginMethod
    public void lockDevice(PluginCall call) {
        try {
            Context ctx = getContext();
            DevicePolicyManager dpm = (DevicePolicyManager) ctx.getSystemService(Context.DEVICE_POLICY_SERVICE);
            ComponentName adminComponent = new ComponentName(ctx, JarvisDeviceAdminReceiver.class);
            if (dpm != null && dpm.isAdminActive(adminComponent)) {
                dpm.lockNow();
                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("message", "Screen locked.");
                call.resolve(ret);
            } else {
                call.reject("Device Admin permission is required to lock device screen.");
            }
        } catch (Exception e) {
            call.reject("Failed to lock screen: " + e.getMessage());
        }
    }

    @PluginMethod
    public void requestIgnoreBatteryOptimizations(PluginCall call) {
        try {
            Context ctx = getContext();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
                if (pm != null && !pm.isIgnoringBatteryOptimizations(ctx.getPackageName())) {
                    Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    intent.setData(Uri.parse("package:" + ctx.getPackageName()));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    ctx.startActivity(intent);
                }
            }
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to request battery exemption: " + e.getMessage());
        }
    }

    // =========================================================================
    // INSTALLED APPS DISCOVERY & CONTACTS
    // =========================================================================

    @PluginMethod
    public void getInstalledApps(PluginCall call) {
        try {
            Context ctx = getContext();
            PackageManager pm = ctx.getPackageManager();
            Intent mainIntent = new Intent(Intent.ACTION_MAIN, null);
            mainIntent.addCategory(Intent.CATEGORY_LAUNCHER);

            List<ResolveInfo> activities = pm.queryIntentActivities(mainIntent, 0);
            JSONArray appsArray = new JSONArray();

            for (ResolveInfo ri : activities) {
                if (ri.activityInfo != null && ri.activityInfo.packageName != null) {
                    JSONObject appObj = new JSONObject();
                    appObj.put("packageName", ri.activityInfo.packageName);
                    CharSequence label = ri.loadLabel(pm);
                    appObj.put("appName", label != null ? label.toString() : ri.activityInfo.name);

                    boolean isSystem = (ri.activityInfo.applicationInfo.flags & ApplicationInfo.FLAG_SYSTEM) != 0;
                    appObj.put("isSystemApp", isSystem);
                    appsArray.put(appObj);
                }
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("apps", appsArray);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to discover installed apps: " + e.getMessage());
        }
    }

    @PluginMethod
    public void searchContacts(PluginCall call) {
        String query = call.getString("query", "").trim();
        Context ctx = getContext();

        try {
            JSONArray contactsArray = new JSONArray();
            Uri uri = ContactsContract.CommonDataKinds.Phone.CONTENT_URI;
            String selection = null;
            String[] selectionArgs = null;

            if (!query.isEmpty()) {
                selection = ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME + " LIKE ?";
                selectionArgs = new String[] { "%" + query + "%" };
            }

            Cursor cursor = ctx.getContentResolver().query(
                uri,
                new String[] {
                    ContactsContract.CommonDataKinds.Phone.CONTACT_ID,
                    ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
                    ContactsContract.CommonDataKinds.Phone.NUMBER,
                },
                selection,
                selectionArgs,
                ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME + " ASC LIMIT 15"
            );

            if (cursor != null) {
                while (cursor.moveToNext()) {
                    String id = cursor.getString(0);
                    String name = cursor.getString(1);
                    String number = cursor.getString(2);

                    JSONObject contact = new JSONObject();
                    contact.put("id", id != null ? id : "");
                    contact.put("displayName", name != null ? name : "");
                    contact.put("phoneNumber", number != null ? number : "");
                    contactsArray.put(contact);
                }
                cursor.close();
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("contacts", contactsArray);
            call.resolve(ret);
        } catch (SecurityException se) {
            call.reject("READ_CONTACTS permission is required to search contacts.");
        } catch (Exception e) {
            call.reject("Failed to search contacts: " + e.getMessage());
        }
    }

    // ==========================================
    // Native Android SpeechRecognizer Bridge
    // ==========================================

    @PluginMethod
    public void isSpeechRecognitionAvailable(PluginCall call) {
        boolean available = SpeechRecognizer.isRecognitionAvailable(getContext());
        JSObject ret = new JSObject();
        ret.put("available", available);
        call.resolve(ret);
    }

    @PluginMethod
    public void startSpeechRecognition(PluginCall call) {
        String language = call.getString("language", "en-IN");

        getActivity().runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    if (speechRecognizer != null) {
                        try {
                            speechRecognizer.cancel();
                            speechRecognizer.destroy();
                        } catch (Exception ignored) {}
                        speechRecognizer = null;
                    }

                    if (!SpeechRecognizer.isRecognitionAvailable(getContext())) {
                        call.reject("Speech recognition is not available on this device.");
                        return;
                    }

                    speechRecognizer = SpeechRecognizer.createSpeechRecognizer(getContext());
                    Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                    intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                    intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
                    intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3);
                    if (language != null && !language.isEmpty() && !language.equals("auto")) {
                        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, language);
                        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, language);
                    }

                    speechRecognizer.setRecognitionListener(new RecognitionListener() {
                        @Override
                        public void onReadyForSpeech(Bundle params) {
                            isListeningSpeech = true;
                            JSObject ret = new JSObject();
                            ret.put("status", "ready");
                            notifyListeners("speechReady", ret);
                        }

                        @Override
                        public void onBeginningOfSpeech() {
                            JSObject ret = new JSObject();
                            ret.put("status", "speaking");
                            notifyListeners("speechStart", ret);
                        }

                        @Override
                        public void onRmsChanged(float rmsdB) {
                            JSObject ret = new JSObject();
                            float normalized = Math.max(0.0f, Math.min(1.0f, (rmsdB + 2.0f) / 12.0f));
                            ret.put("rms", normalized);
                            notifyListeners("speechRms", ret);
                        }

                        @Override
                        public void onBufferReceived(byte[] buffer) {}

                        @Override
                        public void onEndOfSpeech() {
                            isListeningSpeech = false;
                            JSObject ret = new JSObject();
                            ret.put("status", "end_of_speech");
                            notifyListeners("speechEndOfSpeech", ret);
                        }

                        @Override
                        public void onError(int error) {
                            isListeningSpeech = false;
                            String errorMsg = getSpeechErrorMessage(error);
                            JSObject ret = new JSObject();
                            ret.put("errorCode", error);
                            ret.put("error", errorMsg);
                            notifyListeners("speechError", ret);
                        }

                        @Override
                        public void onResults(Bundle results) {
                            isListeningSpeech = false;
                            ArrayList<String> matches = results != null
                                ? results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                                : null;
                            String text = (matches != null && !matches.isEmpty()) ? matches.get(0) : "";
                            JSObject ret = new JSObject();
                            ret.put("transcript", text != null ? text.trim() : "");
                            ret.put("isFinal", true);
                            notifyListeners("speechResult", ret);
                        }

                        @Override
                        public void onPartialResults(Bundle partialResults) {
                            ArrayList<String> matches = partialResults != null
                                ? partialResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                                : null;
                            String text = (matches != null && !matches.isEmpty()) ? matches.get(0) : "";
                            if (text != null && !text.trim().isEmpty()) {
                                JSObject ret = new JSObject();
                                ret.put("transcript", text.trim());
                                ret.put("isFinal", false);
                                notifyListeners("speechPartial", ret);
                            }
                        }

                        @Override
                        public void onEvent(int eventType, Bundle params) {}
                    });

                    speechRecognizer.startListening(intent);
                    isListeningSpeech = true;

                    JSObject ret = new JSObject();
                    ret.put("success", true);
                    call.resolve(ret);
                } catch (Exception e) {
                    call.reject("Failed to initialize speech recognizer: " + e.getMessage());
                }
            }
        });
    }

    @PluginMethod
    public void stopSpeechRecognition(PluginCall call) {
        getActivity().runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (speechRecognizer != null) {
                    try {
                        speechRecognizer.stopListening();
                    } catch (Exception ignored) {}
                }
                isListeningSpeech = false;
                JSObject ret = new JSObject();
                ret.put("success", true);
                call.resolve(ret);
            }
        });
    }

    @PluginMethod
    public void cancelSpeechRecognition(PluginCall call) {
        getActivity().runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (speechRecognizer != null) {
                    try {
                        speechRecognizer.cancel();
                        speechRecognizer.destroy();
                    } catch (Exception ignored) {}
                    speechRecognizer = null;
                }
                isListeningSpeech = false;
                JSObject ret = new JSObject();
                ret.put("success", true);
                call.resolve(ret);
            }
        });
    }

    private String getSpeechErrorMessage(int errorCode) {
        switch (errorCode) {
            case SpeechRecognizer.ERROR_AUDIO:
                return "Audio recording error. Please check your microphone.";
            case SpeechRecognizer.ERROR_CLIENT:
                return "Client side speech recognition error.";
            case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS:
                return "Microphone permission is required for voice recognition.";
            case SpeechRecognizer.ERROR_NETWORK:
            case SpeechRecognizer.ERROR_NETWORK_TIMEOUT:
                return "Network timeout during speech recognition.";
            case SpeechRecognizer.ERROR_NO_MATCH:
                return "No speech detected. Please speak clearly.";
            case SpeechRecognizer.ERROR_RECOGNIZER_BUSY:
                return "Speech recognition service is busy. Please try again.";
            case SpeechRecognizer.ERROR_SERVER:
                return "Server recognition error.";
            case SpeechRecognizer.ERROR_SPEECH_TIMEOUT:
                return "No speech input detected.";
            default:
                return "Speech recognition error (code " + errorCode + ").";
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (speechRecognizer != null) {
            try {
                speechRecognizer.destroy();
            } catch (Exception ignored) {}
            speechRecognizer = null;
        }
        super.handleOnDestroy();
    }
}
