package com.padhiyar.jarvis;

import android.Manifest;
import android.content.Context;
import android.os.Build;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "JarvisPermissions",
    permissions = {
        @Permission(
            alias = "microphone",
            strings = { Manifest.permission.RECORD_AUDIO, Manifest.permission.MODIFY_AUDIO_SETTINGS }
        ),
        @Permission(
            alias = "camera",
            strings = { Manifest.permission.CAMERA }
        ),
        @Permission(
            alias = "notifications",
            strings = { Manifest.permission.POST_NOTIFICATIONS }
        ),
        @Permission(
            alias = "contacts",
            strings = { Manifest.permission.READ_CONTACTS }
        ),
        @Permission(
            alias = "phone",
            strings = { Manifest.permission.READ_PHONE_STATE, Manifest.permission.CALL_PHONE }
        )
    }
)
public class JarvisPermissionsPlugin extends Plugin {

    @PluginMethod
    public void getPermissionsStatus(PluginCall call) {
        JSObject ret = new JSObject();

        // Check microphone permission
        PermissionState micState = getPermissionState("microphone");
        ret.put("microphone", micState != null ? micState.toString().toLowerCase() : "prompt");

        // Check camera permission
        PermissionState camState = getPermissionState("camera");
        ret.put("camera", camState != null ? camState.toString().toLowerCase() : "prompt");

        // Check notifications (Android 13+ vs legacy)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            PermissionState notifState = getPermissionState("notifications");
            ret.put("notifications", notifState != null ? notifState.toString().toLowerCase() : "prompt");
        } else {
            Context ctx = getContext();
            boolean enabled = NotificationManagerCompat.from(ctx).areNotificationsEnabled();
            ret.put("notifications", enabled ? "granted" : "denied");
        }

        // Check contacts permission
        PermissionState contactsState = getPermissionState("contacts");
        ret.put("contacts", contactsState != null ? contactsState.toString().toLowerCase() : "prompt");

        // Check phone permission
        PermissionState phoneState = getPermissionState("phone");
        ret.put("phone", phoneState != null ? phoneState.toString().toLowerCase() : "prompt");

        ret.put("androidIntents", "ready");
        call.resolve(ret);
    }

    @PluginMethod
    public void requestNotificationPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            requestPermissionForAlias("notifications", call, "notificationPermCallback");
        } else {
            boolean enabled = NotificationManagerCompat.from(getContext()).areNotificationsEnabled();
            JSObject ret = new JSObject();
            ret.put("notifications", enabled ? "granted" : "denied");
            call.resolve(ret);
        }
    }

    @PermissionCallback
    private void notificationPermCallback(PluginCall call) {
        PermissionState notifState = getPermissionState("notifications");
        JSObject ret = new JSObject();
        ret.put("notifications", notifState != null ? notifState.toString().toLowerCase() : "denied");
        call.resolve(ret);
    }

    @PluginMethod
    public void requestMicrophonePermission(PluginCall call) {
        requestPermissionForAlias("microphone", call, "microphonePermCallback");
    }

    @PermissionCallback
    private void microphonePermCallback(PluginCall call) {
        PermissionState micState = getPermissionState("microphone");
        JSObject ret = new JSObject();
        ret.put("microphone", micState != null ? micState.toString().toLowerCase() : "denied");
        call.resolve(ret);
    }

    @PluginMethod
    public void requestCameraPermission(PluginCall call) {
        requestPermissionForAlias("camera", call, "cameraPermCallback");
    }

    @PermissionCallback
    private void cameraPermCallback(PluginCall call) {
        PermissionState camState = getPermissionState("camera");
        JSObject ret = new JSObject();
        ret.put("camera", camState != null ? camState.toString().toLowerCase() : "denied");
        call.resolve(ret);
    }

    @PluginMethod
    public void requestContactsPermission(PluginCall call) {
        requestPermissionForAlias("contacts", call, "contactsPermCallback");
    }

    @PermissionCallback
    private void contactsPermCallback(PluginCall call) {
        PermissionState state = getPermissionState("contacts");
        JSObject ret = new JSObject();
        ret.put("contacts", state != null ? state.toString().toLowerCase() : "denied");
        call.resolve(ret);
    }

    @PluginMethod
    public void requestPhonePermission(PluginCall call) {
        requestPermissionForAlias("phone", call, "phonePermCallback");
    }

    @PermissionCallback
    private void phonePermCallback(PluginCall call) {
        PermissionState state = getPermissionState("phone");
        JSObject ret = new JSObject();
        ret.put("phone", state != null ? state.toString().toLowerCase() : "denied");
        call.resolve(ret);
    }
}
