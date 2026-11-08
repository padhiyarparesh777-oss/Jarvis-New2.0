package com.padhiyar.jarvis;

import android.os.Bundle;
import android.content.Intent;
import android.os.Handler;
import android.os.Looper;
import android.os.Build;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(JarvisPermissionsPlugin.class);
        registerPlugin(JarvisDevicePlugin.class);
        super.onCreate(savedInstanceState);

        // Start the private on-device API server whenever JARVIS opens.
        Intent localServerIntent = new Intent(this, JarvisLocalServerService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(localServerIntent);
        } else {
            startService(localServerIntent);
        }

        dispatchIntentAction(getIntent());

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

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        dispatchIntentAction(intent);
    }

    private void dispatchIntentAction(Intent intent) {
        if (intent == null || intent.getAction() == null) return;
        String action = intent.getAction();
        if (Intent.ACTION_ASSIST.equals(action) || "com.padhiyar.jarvis.ACTION_MIC_ON".equals(action)) dispatchAssistantInvocation("jarvis:assist");
        else if ("com.padhiyar.jarvis.ACTION_MIC_OFF".equals(action)) dispatchAssistantInvocation("jarvis:assist-stop");
    }

    private void dispatchAssistantInvocation(String eventName) {
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            if (getBridge() != null && getBridge().getWebView() != null) getBridge().triggerWindowJSEvent(eventName);
        }, 900);
    }

    @Override
    public void onStop() {
        super.onStop();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && android.provider.Settings.canDrawOverlays(this)) {
            try { startService(new Intent(this, JarvisFloatingOrbService.class)); } catch (Exception ignored) {}
        }
    }
}
