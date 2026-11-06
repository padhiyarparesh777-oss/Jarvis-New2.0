package com.padhiyar.jarvis;

import android.content.Context;
import android.content.pm.PackageManager;
import android.hardware.camera2.CameraAccessException;
import android.hardware.camera2.CameraCharacteristics;
import android.hardware.camera2.CameraManager;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Android-native hardware APIs that are not available to a WebView. */
@CapacitorPlugin(name = "JarvisHardware")
public class JarvisHardwarePlugin extends Plugin {
    private String torchCameraId;
    private boolean torchEnabled;

    @PluginMethod
    public void setFlashlight(PluginCall call) {
        Boolean enabled = call.getBoolean("enabled");
        if (enabled == null) {
            call.reject("Flashlight enabled state is required.");
            return;
        }
        Context context = getContext();
        if (!context.getPackageManager().hasSystemFeature(PackageManager.FEATURE_CAMERA_FLASH)) {
            call.reject("This device does not have a camera flash.");
            return;
        }
        try {
            CameraManager manager = (CameraManager) context.getSystemService(Context.CAMERA_SERVICE);
            if (manager == null) {
                call.reject("Android camera service is unavailable.");
                return;
            }
            if (torchCameraId == null) {
                for (String id : manager.getCameraIdList()) {
                    CameraCharacteristics characteristics = manager.getCameraCharacteristics(id);
                    Boolean flash = characteristics.get(CameraCharacteristics.FLASH_INFO_AVAILABLE);
                    Integer facing = characteristics.get(CameraCharacteristics.LENS_FACING);
                    if (Boolean.TRUE.equals(flash) && (facing == null || facing == CameraCharacteristics.LENS_FACING_BACK)) {
                        torchCameraId = id;
                        break;
                    }
                }
            }
            if (torchCameraId == null) {
                call.reject("No rear camera flash is available.");
                return;
            }
            manager.setTorchMode(torchCameraId, enabled);
            torchEnabled = enabled;
            JSObject result = new JSObject();
            result.put("success", true);
            result.put("enabled", enabled);
            result.put("message", enabled ? "Flashlight turned on." : "Flashlight turned off.");
            call.resolve(result);
        } catch (SecurityException e) {
            call.reject("Camera permission is required for flashlight control: " + e.getMessage());
        } catch (CameraAccessException | RuntimeException e) {
            call.reject("Could not change flashlight state: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getNetworkStatus(PluginCall call) {
        try {
            ConnectivityManager manager = (ConnectivityManager) getContext().getSystemService(Context.CONNECTIVITY_SERVICE);
            Network network = manager != null ? manager.getActiveNetwork() : null;
            NetworkCapabilities caps = manager != null && network != null ? manager.getNetworkCapabilities(network) : null;
            boolean connected = caps != null && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
            String transport = "none";
            if (caps != null) {
                if (caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) transport = "wifi";
                else if (caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)) transport = "cellular";
                else if (caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)) transport = "ethernet";
                else if (caps.hasTransport(NetworkCapabilities.TRANSPORT_BLUETOOTH)) transport = "bluetooth";
                else if (caps.hasTransport(NetworkCapabilities.TRANSPORT_VPN)) transport = "vpn";
                else transport = "other";
            }
            JSObject result = new JSObject();
            result.put("connected", connected);
            result.put("transport", transport);
            result.put("metered", manager != null && manager.isActiveNetworkMetered());
            result.put("androidVersion", Build.VERSION.RELEASE);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Could not read network status: " + e.getMessage());
        }
    }
}
