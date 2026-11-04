package com.padhiyar.jarvis;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

public class JarvisBootReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(action) || "android.intent.action.QUICKBOOT_POWERON".equals(action)) {
            SharedPreferences prefs = context.getSharedPreferences("jarvis_native_prefs", Context.MODE_PRIVATE);
            boolean autoStart = prefs.getBoolean("boot_start_background", false);
            if (autoStart) {
                Intent serviceIntent = new Intent(context, JarvisBackgroundService.class);
                serviceIntent.setAction(JarvisBackgroundService.ACTION_START);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent);
                } else {
                    context.startService(serviceIntent);
                }
            }
        }
    }
}
