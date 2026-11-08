package com.padhiyar.jarvis;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import fi.iki.elonen.NanoHTTPD;
import java.io.IOException;
import java.util.Map;

/**
 * Loopback-only embedded JARVIS API host.
 * It is intentionally bound to 127.0.0.1; it is not exposed to the LAN or public internet.
 */
public class JarvisLocalServerService extends Service {
    public static final int PORT = 8765;
    private static final String CHANNEL = "jarvis_local_server";
    private static final int NOTIFICATION_ID = 8765;
    private static volatile boolean running = false;
    private LocalApiServer server;

    public static boolean isRunning() { return running; }

    @Override public void onCreate() {
        super.onCreate();
        createChannel();
        startForeground(NOTIFICATION_ID, buildNotification());
        try {
            server = new LocalApiServer();
            server.start(NanoHTTPD.SOCKET_READ_TIMEOUT, false);
            running = true;
        } catch (IOException | RuntimeException error) {
            running = false;
            stopSelf();
        }
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        return START_STICKY;
    }

    private Notification buildNotification() {
        return new Notification.Builder(this, CHANNEL)
            .setContentTitle("JARVIS Local Server")
            .setContentText("Private on-device API is running on localhost.")
            .setSmallIcon(android.R.drawable.stat_sys_upload_done)
            .setOngoing(true)
            .build();
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL, "JARVIS Local Server", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Keeps the private on-device JARVIS API available.");
            ((NotificationManager)getSystemService(Context.NOTIFICATION_SERVICE)).createNotificationChannel(channel);
        }
    }

    @Override public void onDestroy() {
        running = false;
        if (server != null) {
            server.stop();
            server = null;
        }
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent intent) { return null; }

    private static final class LocalApiServer extends NanoHTTPD {
        LocalApiServer() { super("127.0.0.1", PORT); }

        @Override public Response serve(IHTTPSession session) {
            String path = session.getUri();
            if ("/health".equals(path) || "/api/local/status".equals(path)) {
                String json = "{\"status\":\"ok\",\"service\":\"jarvis-local-android\",\"running\":true,\"host\":\"127.0.0.1\",\"port\":" + PORT + ",\"aiRoutes\":\"migration_pending\"}";
                return newFixedLengthResponse(Response.Status.OK, "application/json; charset=utf-8", json);
            }
            return newFixedLengthResponse(Response.Status.NOT_FOUND, "application/json; charset=utf-8",
                "{\"error\":\"NOT_FOUND\",\"message\":\"This local API route has not been migrated yet.\"}");
        }
    }
}
