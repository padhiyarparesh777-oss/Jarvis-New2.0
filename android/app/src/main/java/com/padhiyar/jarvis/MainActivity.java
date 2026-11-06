package com.padhiyar.jarvis;

import android.os.Bundle;
import android.content.Intent;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    // The overlay is started only by the explicit Floating Island control.
    // Returning to JARVIS always dismisses the overlay.
    @Override
    public void onResume() {
        super.onResume();
        stopService(new Intent(this, JarvisFloatingOverlayService.class));
    }

    @Override
    public void onPause() {
        // Do not auto-start overlays when the activity loses focus.
        // JarvisDevicePlugin.startFloatingOverlay() is the sole opt-in entry point.
        super.onPause();
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(JarvisPermissionsPlugin.class);
        registerPlugin(JarvisDevicePlugin.class);
        registerPlugin(JarvisHardwarePlugin.class);
        registerPlugin(JarvisSystemControlPlugin.class);
        super.onCreate(savedInstanceState);

        // Configure WebView settings for audio responsiveness and media permissions.
        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView webView = getBridge().getWebView();
            WebSettings settings = webView.getSettings();
            settings.setMediaPlaybackRequiresUserGesture(false);
            settings.setJavaScriptEnabled(true);
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);
        }

        // Android hardware Back button dispatches the 'jarvis:backbutton' event.
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
