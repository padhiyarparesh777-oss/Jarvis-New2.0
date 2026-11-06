package com.padhiyar.jarvis;

import android.os.Bundle;
import android.content.Intent;
import android.provider.Settings;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    // Keep the floating JARVIS pill visible only while the app is in the background.
    @Override
    protected void onResume() {
        super.onResume();
        stopService(new Intent(this, JarvisFloatingOverlayService.class));
    }

    @Override
    protected void onPause() {
        // The app is leaving the foreground (Home, app switch, or another app).
        // Android still requires the user to grant Display over other apps.
        if (Settings.canDrawOverlays(this)) {
            try {
                startService(new Intent(this, JarvisFloatingOverlayService.class));
            } catch (IllegalStateException | SecurityException ignored) {
                // Some Android/OEM background restrictions may prevent a background service start.
            }
        }
        super.onPause();
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(JarvisPermissionsPlugin.class);
        registerPlugin(JarvisDevicePlugin.class);
        super.onCreate(savedInstanceState);

        // Configure WebView settings for audio responsiveness and media permissions
        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView webView = getBridge().getWebView();
            WebSettings settings = webView.getSettings();
            settings.setMediaPlaybackRequiresUserGesture(false);
            settings.setJavaScriptEnabled(true);
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);
        }

        // Android Hardware Back Button Handling (dispatches window event 'jarvis:backbutton')
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (getBridge() != null && getBridge().getWebView() != null) {
                    getBridge().triggerWindowJSEvent("jarvis:backbutton");
                } else {
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                }
            }
        });
    }
}
