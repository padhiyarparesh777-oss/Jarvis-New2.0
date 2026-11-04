package com.padhiyar.jarvis;

import android.app.Notification;
import android.content.Context;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

public class JarvisNotificationListenerService extends NotificationListenerService {

    public static class CachedNotification {
        public String packageName;
        public String title;
        public String text;
        public long postTime;

        public CachedNotification(String pkg, String t, String b, long time) {
            this.packageName = pkg != null ? pkg : "";
            this.title = t != null ? t : "";
            this.text = b != null ? b : "";
            this.postTime = time;
        }
    }

    private static final List<CachedNotification> sRecentNotifications = Collections.synchronizedList(new ArrayList<>());
    private static final int MAX_CACHE = 25;
    private static boolean sIsConnected = false;

    public static boolean isConnected() {
        return sIsConnected;
    }

    public static JSONArray getRecentNotificationsJson() {
        JSONArray arr = new JSONArray();
        synchronized (sRecentNotifications) {
            for (CachedNotification item : sRecentNotifications) {
                try {
                    JSONObject obj = new JSONObject();
                    obj.put("packageName", item.packageName);
                    obj.put("title", item.title);
                    obj.put("text", item.text);
                    obj.put("postTime", item.postTime);
                    arr.put(obj);
                } catch (Exception ignored) {}
            }
        }
        return arr;
    }

    @Override
    public void onListenerConnected() {
        super.onListenerConnected();
        sIsConnected = true;
    }

    @Override
    public void onListenerDisconnected() {
        super.onListenerDisconnected();
        sIsConnected = false;
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null) return;

        String pkg = sbn.getPackageName();
        if (pkg == null) return;

        // Privacy rule: Exclude banking, financial, authenticator, and sensitive apps
        String lowerPkg = pkg.toLowerCase();
        if (lowerPkg.contains("bank") || lowerPkg.contains("pay") || lowerPkg.contains("auth") || lowerPkg.contains("otp") || lowerPkg.contains("pass")) {
            return;
        }

        Notification notification = sbn.getNotification();
        if (notification == null) return;

        Bundle extras = notification.extras;
        if (extras == null) return;

        CharSequence title = extras.getCharSequence(Notification.EXTRA_TITLE);
        CharSequence text = extras.getCharSequence(Notification.EXTRA_TEXT);

        String titleStr = title != null ? title.toString().trim() : "";
        String textStr = text != null ? text.toString().trim() : "";

        if (titleStr.isEmpty() && textStr.isEmpty()) return;

        CachedNotification item = new CachedNotification(pkg, titleStr, textStr, sbn.getPostTime());
        synchronized (sRecentNotifications) {
            if (sRecentNotifications.size() >= MAX_CACHE) {
                sRecentNotifications.remove(0);
            }
            sRecentNotifications.add(item);
        }
    }

    @Override
    public void onNotificationRemoved(StatusBarNotification sbn) {
        // Handled automatically
    }
}
