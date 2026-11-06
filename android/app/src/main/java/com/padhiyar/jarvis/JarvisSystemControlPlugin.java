package com.padhiyar.jarvis;

import android.app.AlarmManager;
import android.app.admin.DevicePolicyManager;
import android.app.NotificationManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.media.AudioManager;
import android.net.Uri;
import android.os.BatteryManager;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import android.text.TextUtils;
import android.view.WindowManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "JarvisSystemControl")
public class JarvisSystemControlPlugin extends Plugin {
    private JSObject result(boolean success, String message) {
        JSObject out = new JSObject();
        out.put("success", success);
        out.put("message", message);
        return out;
    }

    private void launchSettings(PluginCall call, String action) {
        try {
            Intent intent = new Intent(action);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve(result(true, "Opened Android settings."));
        } catch (Exception e) {
            call.resolve(result(false, "Unable to open settings: " + e.getMessage()));
        }
    }

    private boolean accessibilityEnabled() {
        String enabled = Settings.Secure.getString(
            getContext().getContentResolver(), Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        );
        String expected = new ComponentName(getContext(), JarvisAccessibilityService.class).flattenToString();
        return enabled != null && enabled.toLowerCase().contains(expected.toLowerCase());
    }

    private boolean notificationListenerEnabled() {
        String enabled = Settings.Secure.getString(
            getContext().getContentResolver(), "enabled_notification_listeners"
        );
        String expected = new ComponentName(getContext(), JarvisNotificationListenerService.class).flattenToString();
        return enabled != null && enabled.toLowerCase().contains(expected.toLowerCase());
    }

    @PluginMethod
    public void getCapabilities(PluginCall call) {
        Context context = getContext();
        PowerManager power = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        NotificationManager notifications = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        DevicePolicyManager dpm = (DevicePolicyManager) context.getSystemService(Context.DEVICE_POLICY_SERVICE);
        ComponentName admin = new ComponentName(context, JarvisDeviceAdminReceiver.class);
        JSObject out = new JSObject();
        out.put("apiLevel", Build.VERSION.SDK_INT);
        out.put("writeSettings", Build.VERSION.SDK_INT < 23 || Settings.System.canWrite(context));
        out.put("overlay", Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(context));
        out.put("batteryOptimizationExempt", Build.VERSION.SDK_INT < 23 || power.isIgnoringBatteryOptimizations(context.getPackageName()));
        out.put("accessibilityEnabled", accessibilityEnabled());
        out.put("notificationListenerEnabled", notificationListenerEnabled());
        out.put("deviceAdminEnabled", dpm != null && dpm.isAdminActive(admin));
        out.put("dndAccess", Build.VERSION.SDK_INT < 23 || notifications.isNotificationPolicyAccessGranted());
        out.put("usageAccess", hasUsageAccess());
        out.put("exactAlarmsAllowed", Build.VERSION.SDK_INT < 31 || ((AlarmManager) context.getSystemService(Context.ALARM_SERVICE)).canScheduleExactAlarms());
        call.resolve(out);
    }

    private boolean hasUsageAccess() {
        try {
            android.app.AppOpsManager appOps = (android.app.AppOpsManager) getContext().getSystemService(Context.APP_OPS_SERVICE);
            int mode;
            if (Build.VERSION.SDK_INT >= 29) {
                mode = appOps.unsafeCheckOpNoThrow("android:get_usage_stats", android.os.Process.myUid(), getContext().getPackageName());
            } else {
                mode = appOps.checkOpNoThrow("android:get_usage_stats", android.os.Process.myUid(), getContext().getPackageName());
            }
            return mode == android.app.AppOpsManager.MODE_ALLOWED;
        } catch (Exception e) {
            return false;
        }
    }

    @PluginMethod public void openAccessibilitySettings(PluginCall call) { launchSettings(call, Settings.ACTION_ACCESSIBILITY_SETTINGS); }
    @PluginMethod public void openNotificationListenerSettings(PluginCall call) { launchSettings(call, Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS); }
    @PluginMethod public void openUsageAccessSettings(PluginCall call) { launchSettings(call, Settings.ACTION_USAGE_ACCESS_SETTINGS); }
    @PluginMethod public void openDndAccessSettings(PluginCall call) { launchSettings(call, Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS); }
    @PluginMethod public void openBatterySettings(PluginCall call) { launchSettings(call, Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS); }
    @PluginMethod public void openOverlaySettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 23) launchSettings(call, Settings.ACTION_MANAGE_OVERLAY_PERMISSION);
        else call.resolve(result(true, "Overlay permission is not separately required on this Android version."));
    }
    @PluginMethod public void openAppDetailsSettings(PluginCall call) {
        launchSettings(call, Settings.ACTION_APPLICATION_DETAILS_SETTINGS + ":" + getContext().getPackageName());
    }

    @PluginMethod
    public void requestWriteSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT < 23 || Settings.System.canWrite(getContext())) {
            call.resolve(result(true, "Modify system settings access is already available."));
            return;
        }
        try {
            Intent intent = new Intent(Settings.ACTION_MANAGE_WRITE_SETTINGS,
                Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve(result(true, "Android opened the Modify system settings permission screen."));
        } catch (Exception e) { call.resolve(result(false, e.getMessage())); }
    }

    @PluginMethod
    public void requestOverlayPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(getContext())) {
            call.resolve(result(true, "Display over other apps access is already available."));
            return;
        }
        try {
            Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve(result(true, "Android opened the overlay permission screen."));
        } catch (Exception e) { call.resolve(result(false, e.getMessage())); }
    }

    @PluginMethod
    public void requestBatteryOptimizationExemption(PluginCall call) {
        if (Build.VERSION.SDK_INT < 23) { call.resolve(result(true, "Not required on this Android version.")); return; }
        PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
        if (pm.isIgnoringBatteryOptimizations(getContext().getPackageName())) {
            call.resolve(result(true, "JARVIS is already exempt from battery optimization."));
            return;
        }
        try {
            Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve(result(true, "Android opened the battery optimization approval screen."));
        } catch (Exception e) { call.resolve(result(false, e.getMessage())); }
    }

    @PluginMethod
    public void requestDeviceAdmin(PluginCall call) {
        try {
            ComponentName admin = new ComponentName(getContext(), JarvisDeviceAdminReceiver.class);
            DevicePolicyManager dpm = (DevicePolicyManager) getContext().getSystemService(Context.DEVICE_POLICY_SERVICE);
            if (dpm.isAdminActive(admin)) { call.resolve(result(true, "JARVIS Device Admin is already active.")); return; }
            Intent intent = new Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN);
            intent.putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, admin);
            intent.putExtra(DevicePolicyManager.EXTRA_ADD_EXPLANATION, "Allow JARVIS to lock this phone only when you explicitly ask it to.");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve(result(true, "Android opened the Device Admin activation screen."));
        } catch (Exception e) { call.resolve(result(false, e.getMessage())); }
    }

    @PluginMethod
    public void lockDevice(PluginCall call) {
        if (!Boolean.TRUE.equals(call.getBoolean("confirmed", false))) {
            call.resolve(result(false, "Explicit confirmation is required before locking the device."));
            return;
        }
        DevicePolicyManager dpm = (DevicePolicyManager) getContext().getSystemService(Context.DEVICE_POLICY_SERVICE);
        ComponentName admin = new ComponentName(getContext(), JarvisDeviceAdminReceiver.class);
        if (dpm == null || !dpm.isAdminActive(admin)) {
            call.resolve(result(false, "Activate JARVIS Device Admin first."));
            return;
        }
        try { dpm.lockNow(); call.resolve(result(true, "Device lock requested.")); }
        catch (SecurityException e) { call.resolve(result(false, "Android denied device lock: " + e.getMessage())); }
    }

    @PluginMethod
    public void setScreenBrightness(PluginCall call) {
        int percent = Math.max(1, Math.min(100, call.getInt("percent", 50)));
        if (Build.VERSION.SDK_INT >= 23 && !Settings.System.canWrite(getContext())) {
            call.resolve(result(false, "Grant Modify system settings permission first."));
            return;
        }
        try {
            int value = Math.round(percent * 255f / 100f);
            Settings.System.putInt(getContext().getContentResolver(), Settings.System.SCREEN_BRIGHTNESS, value);
            call.resolve(result(true, "Screen brightness set to " + percent + "%."));
        } catch (Exception e) { call.resolve(result(false, e.getMessage())); }
    }

    @PluginMethod
    public void setScreenTimeout(PluginCall call) {
        long millis = Math.max(15000L, Math.min(1800000L, call.getLong("milliseconds", 60000L)));
        if (Build.VERSION.SDK_INT >= 23 && !Settings.System.canWrite(getContext())) {
            call.resolve(result(false, "Grant Modify system settings permission first."));
            return;
        }
        try {
            Settings.System.putInt(getContext().getContentResolver(), Settings.System.SCREEN_OFF_TIMEOUT, (int) millis);
            call.resolve(result(true, "Screen timeout updated to " + (millis / 1000) + " seconds."));
        } catch (Exception e) { call.resolve(result(false, e.getMessage())); }
    }

    @PluginMethod
    public void setVolume(PluginCall call) {
        int percent = Math.max(0, Math.min(100, call.getInt("percent", 50)));
        String stream = call.getString("stream", "music");
        AudioManager audio = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        int streamType = AudioManager.STREAM_MUSIC;
        if ("ring".equalsIgnoreCase(stream)) streamType = AudioManager.STREAM_RING;
        else if ("alarm".equalsIgnoreCase(stream)) streamType = AudioManager.STREAM_ALARM;
        else if ("notification".equalsIgnoreCase(stream)) streamType = AudioManager.STREAM_NOTIFICATION;
        else if ("voice_call".equalsIgnoreCase(stream)) streamType = AudioManager.STREAM_VOICE_CALL;
        try {
            int max = audio.getStreamMaxVolume(streamType);
            int value = Math.round(max * percent / 100f);
            audio.setStreamVolume(streamType, value, 0);
            call.resolve(result(true, stream + " volume set to " + percent + "%."));
        } catch (SecurityException e) { call.resolve(result(false, "Android restricted background audio control: " + e.getMessage())); }
        catch (Exception e) { call.resolve(result(false, e.getMessage())); }
    }

    @PluginMethod
    public void setDoNotDisturb(PluginCall call) {
        NotificationManager manager = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 23 && !manager.isNotificationPolicyAccessGranted()) {
            call.resolve(result(false, "Grant Do Not Disturb access in Android settings first."));
            return;
        }
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", true));
        try {
            manager.setInterruptionFilter(enabled
                ? NotificationManager.INTERRUPTION_FILTER_PRIORITY
                : NotificationManager.INTERRUPTION_FILTER_ALL);
            call.resolve(result(true, enabled ? "Do Not Disturb enabled." : "Do Not Disturb disabled."));
        } catch (Exception e) { call.resolve(result(false, e.getMessage())); }
    }

    @PluginMethod public void openWifiPanel(PluginCall call) { openPanel(call, "android.settings.panel.action.WIFI"); }
    @PluginMethod public void openBluetoothPanel(PluginCall call) { openPanel(call, "android.settings.panel.action.BLUETOOTH"); }
    @PluginMethod public void openInternetPanel(PluginCall call) { openPanel(call, "android.settings.panel.action.INTERNET_CONNECTIVITY"); }
    @PluginMethod public void openLocationSettings(PluginCall call) { launchSettings(call, Settings.ACTION_LOCATION_SOURCE_SETTINGS); }
    @PluginMethod public void openDisplaySettings(PluginCall call) { launchSettings(call, Settings.ACTION_DISPLAY_SETTINGS); }
    @PluginMethod public void openSoundSettings(PluginCall call) { launchSettings(call, Settings.ACTION_SOUND_SETTINGS); }
    @PluginMethod public void openNfcSettings(PluginCall call) { launchSettings(call, Settings.ACTION_NFC_SETTINGS); }
    @PluginMethod public void openSecuritySettings(PluginCall call) { launchSettings(call, Settings.ACTION_SECURITY_SETTINGS); }

    private void openPanel(PluginCall call, String action) {
        try {
            Intent intent = new Intent(action);
            if (intent.resolveActivity(getContext().getPackageManager()) == null) {
                intent = new Intent(Settings.ACTION_SETTINGS);
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve(result(true, "Opened Android connectivity panel."));
        } catch (Exception e) { call.resolve(result(false, "Unable to open panel: " + e.getMessage())); }
    }
}
