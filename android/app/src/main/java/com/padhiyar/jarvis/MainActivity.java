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

        if (Intent.ACTION_ASSIST.equals(getIntent() != null ? getIntent().getAction() : null)) {
            dispatchAssistantInvocation();
        }

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
        if (intent != null && Intent.ACTION_ASSIST.equals(intent.getAction())) {
            dispatchAssistantInvocation();
        }
    }

    private void dispatchAssistantInvocation() {
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().triggerWindowJSEvent("jarvis:assist");
            }
        }, 900);
    }
}
