package com.padhiyar.jarvis;

import android.app.Service;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.IBinder;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.animation.ObjectAnimator;
import android.animation.ValueAnimator;

/**
 * Small, user-enabled Dynamic-Island-inspired launcher overlay.
 * It intentionally does not capture audio or perform actions by itself.
 */
public class JarvisFloatingOverlayService extends Service {
    private WindowManager windowManager;
    private View island;
    private boolean expanded = false;

    @Override public void onCreate() {
        super.onCreate();
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        createIsland();
    }

    private int dp(float value) {
        return (int) (value * getResources().getDisplayMetrics().density + 0.5f);
    }

    private GradientDrawable background(boolean open) {
        GradientDrawable shape = new GradientDrawable();
        shape.setColor(Color.argb(238, 10, 13, 19));
        shape.setCornerRadius(dp(open ? 28 : 30));
        shape.setStroke(dp(1), Color.argb(190, 225, 183, 111));
        return shape;
    }

    private void createIsland() {
        LinearLayout shell = new LinearLayout(this);
        shell.setOrientation(LinearLayout.HORIZONTAL);
        shell.setGravity(Gravity.CENTER);
        shell.setPadding(dp(17), dp(10), dp(17), dp(10));
        shell.setBackground(background(false));

        TextView pulse = new TextView(this);
        pulse.setText("✦");
        pulse.setTextColor(Color.rgb(245, 211, 146));
        pulse.setTextSize(16);
        pulse.setPadding(0, 0, dp(9), 0);

        TextView label = new TextView(this);
        label.setText("JARVIS  •  READY");
        label.setTextColor(Color.WHITE);
        label.setTextSize(11);
        label.setLetterSpacing(0.12f);
        shell.addView(pulse);
        shell.addView(label);
        island = shell;

        ObjectAnimator glow = ObjectAnimator.ofFloat(shell, View.ALPHA, 0.78f, 1f);
        glow.setDuration(1500);
        glow.setRepeatMode(ValueAnimator.REVERSE);
        glow.setRepeatCount(ValueAnimator.INFINITE);
        glow.start();

        shell.setOnClickListener(v -> {
            if (!expanded) {
                expanded = true;
                label.setText("JARVIS  •  TAP TO OPEN");
                shell.setBackground(background(true));
                shell.setPadding(dp(22), dp(13), dp(22), dp(13));
            } else {
                Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
                if (launch != null) {
                    launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                    startActivity(launch);
                }
            }
        });

        int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            : WindowManager.LayoutParams.TYPE_PHONE;
        WindowManager.LayoutParams params = new WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
            PixelFormat.TRANSLUCENT
        );
        params.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
        params.y = dp(30);
        try {
            windowManager.addView(island, params);
        } catch (Exception ignored) {
            stopSelf();
        }
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        return START_NOT_STICKY;
    }

    @Override public void onDestroy() {
        if (windowManager != null && island != null) {
            try { windowManager.removeView(island); } catch (Exception ignored) {}
        }
        island = null;
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent intent) { return null; }
}
