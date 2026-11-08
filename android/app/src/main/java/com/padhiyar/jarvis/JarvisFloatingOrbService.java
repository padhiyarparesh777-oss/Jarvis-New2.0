package com.padhiyar.jarvis;
import android.app.Service;
import android.content.Intent;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.animation.ObjectAnimator;
import android.animation.ValueAnimator;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.TextView;

/** Floating JARVIS orb: tap toggles voice; long-press opens the full assistant. */
public class JarvisFloatingOrbService extends Service {
    private static volatile boolean running = false;
    public static boolean isRunning() { return running; }
    private WindowManager windowManager;
    private View orb;
    private WindowManager.LayoutParams params;
    private float downX, downY;
    private int startX, startY;
    private boolean moved, longPressed;
    private boolean micRequested = false;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable longPressAction = () -> { longPressed = true; launchAssistant(Intent.ACTION_ASSIST); };

    @Override public void onCreate() {
        super.onCreate();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !android.provider.Settings.canDrawOverlays(this)) { stopSelf(); return; }
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        TextView bubble = new TextView(this);
        bubble.setText("J"); bubble.setTextColor(0xFF071018); bubble.setTextSize(22f);
        bubble.setGravity(Gravity.CENTER); bubble.setElevation(16f);
        GradientDrawable bg = new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[]{0xFFB5EEFF,0xFF35B8F4,0xFF147BB8});
        bg.setShape(GradientDrawable.OVAL); bg.setStroke(2,0xEEFFFFFF); bubble.setBackground(bg);
        ObjectAnimator pulse = ObjectAnimator.ofFloat(bubble, "alpha", 0.78f, 1.0f);
        pulse.setDuration(1150); pulse.setRepeatMode(ValueAnimator.REVERSE); pulse.setRepeatCount(ValueAnimator.INFINITE); pulse.start();
        int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY : WindowManager.LayoutParams.TYPE_PHONE;
        params = new WindowManager.LayoutParams(dp(62),dp(62),type,WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,PixelFormat.TRANSLUCENT);
        params.gravity = Gravity.TOP | Gravity.START; params.x = dp(16); params.y = dp(180);
        bubble.setOnTouchListener((v,event) -> {
            switch(event.getAction()) {
                case MotionEvent.ACTION_DOWN:
                    downX=event.getRawX(); downY=event.getRawY(); startX=params.x; startY=params.y; moved=false; longPressed=false;
                    handler.postDelayed(longPressAction,650); return true;
                case MotionEvent.ACTION_MOVE:
                    float dx=event.getRawX()-downX, dy=event.getRawY()-downY;
                    if(Math.abs(dx)>dp(7)||Math.abs(dy)>dp(7)){moved=true;handler.removeCallbacks(longPressAction);}
                    if(moved){params.x=startX+(int)dx;params.y=startY+(int)dy;try{windowManager.updateViewLayout(orb,params);}catch(Exception ignored){}}
                    return true;
                case MotionEvent.ACTION_UP:
                case MotionEvent.ACTION_CANCEL:
                    handler.removeCallbacks(longPressAction);
                    if(!moved&&!longPressed&&event.getAction()==MotionEvent.ACTION_UP){
                        micRequested=!micRequested; bubble.setText(micRequested?"●":"J");
                        launchAssistant(micRequested?"com.padhiyar.jarvis.ACTION_MIC_ON":"com.padhiyar.jarvis.ACTION_MIC_OFF");
                    }
                    return true;
            }
            return false;
        });
        orb=bubble;
        try{windowManager.addView(orb,params);running=true;}catch(Exception e){running=false;stopSelf();}
    }
    private void launchAssistant(String action){
        Intent launch=new Intent(this,MainActivity.class);launch.setAction(action);
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP);
        try{startActivity(launch);}catch(Exception ignored){}
    }
    private int dp(float v){return (int)(v*getResources().getDisplayMetrics().density+0.5f);}
    @Override public int onStartCommand(Intent intent,int flags,int startId){return START_STICKY;}
    @Override public void onDestroy(){running=false;handler.removeCallbacksAndMessages(null);if(windowManager!=null&&orb!=null)try{windowManager.removeView(orb);}catch(Exception ignored){}orb=null;super.onDestroy();}
    @Override public IBinder onBind(Intent intent){return null;}
}