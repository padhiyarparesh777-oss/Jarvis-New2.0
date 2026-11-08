package com.padhiyar.jarvis;

import android.accessibilityservice.AccessibilityService;
import android.os.Build;
import android.os.Bundle;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

public class JarvisAccessibilityService extends AccessibilityService {

    private static JarvisAccessibilityService sInstance = null;
    private String mForegroundPackage = "";
    private String mForegroundActivity = "";

    public static JarvisAccessibilityService getInstance() {
        return sInstance;
    }

    public static boolean isRunning() {
        return sInstance != null;
    }

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        sInstance = this;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        sInstance = null;
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null) return;
        if (event.getEventType() == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            CharSequence pkg = event.getPackageName();
            CharSequence cls = event.getClassName();
            if (pkg != null) mForegroundPackage = pkg.toString();
            if (cls != null) mForegroundActivity = cls.toString();
        }
    }

    @Override
    public void onInterrupt() {
        // Accessibility feedback interrupted
    }

    public String getForegroundPackage() {
        return mForegroundPackage != null ? mForegroundPackage : "";
    }

    public String getForegroundActivity() {
        return mForegroundActivity != null ? mForegroundActivity : "";
    }

    /**
     * Keep JARVIS screen-reading and UI automation away from high-risk apps.
     * Users can still operate these apps normally; JARVIS simply will not inspect or interact with them.
     */
    private boolean isSensitiveForegroundApp() {
        String pkg = getForegroundPackage().toLowerCase();
        String[] blocked = {
            "bank", "banking", "paytm", "phonepe", "gpay", "googlepay",
            "wallet", "upi", "bhim", "cred", "razorpay", "cashfree",
            "authenticator", "authy", "otp", "password", "bitwarden",
            "1password", "lastpass", "keepass"
        };
        for (String token : blocked) {
            if (pkg.contains(token)) return true;
        }
        return false;
    }

    /**
     * Traverses the active window and returns structured JSON representation of visible UI elements,
     * while strictly protecting user privacy (skipping password fields).
     */
    public JSONArray dumpVisibleUiNodes() {
        JSONArray nodesArray = new JSONArray();
        if (isSensitiveForegroundApp()) return nodesArray;
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return nodesArray;

        try {
            traverseNode(root, nodesArray);
        } finally {
            root.recycle();
        }
        return nodesArray;
    }

    private void traverseNode(AccessibilityNodeInfo node, JSONArray output) {
        if (node == null || !node.isVisibleToUser()) return;

        // Security rule: Never read or dump password fields
        if (node.isPassword()) return;

        CharSequence text = node.getText();
        CharSequence desc = node.getContentDescription();
        String viewId = node.getViewIdResourceName();
        boolean isClickable = node.isClickable();
        boolean isEditable = node.isEditable();

        String meaningfulText = text != null ? text.toString().trim() : (desc != null ? desc.toString().trim() : "");

        if (!meaningfulText.isEmpty() || isClickable || isEditable || viewId != null) {
            try {
                JSONObject obj = new JSONObject();
                obj.put("text", meaningfulText);
                obj.put("viewId", viewId != null ? viewId : "");
                obj.put("className", node.getClassName() != null ? node.getClassName().toString() : "");
                obj.put("clickable", isClickable);
                obj.put("editable", isEditable);
                output.put(obj);
            } catch (Exception ignored) {}
        }

        int childCount = node.getChildCount();
        for (int i = 0; i < childCount; i++) {
            AccessibilityNodeInfo child = node.getChild(i);
            if (child != null) {
                traverseNode(child, output);
                child.recycle();
            }
        }
    }

    /**
     * Taps a control matching target text or view ID.
     */
    public boolean performTap(String query) {
        if (isSensitiveForegroundApp()) return false;
        if (query == null || query.trim().isEmpty()) return false;
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return false;

        String target = query.trim().toLowerCase();
        try {
            return findAndClick(root, target);
        } finally {
            root.recycle();
        }
    }

    private boolean findAndClick(AccessibilityNodeInfo node, String target) {
        if (node == null || !node.isVisibleToUser()) return false;

        CharSequence text = node.getText();
        CharSequence desc = node.getContentDescription();
        String viewId = node.getViewIdResourceName();

        boolean match = false;
        if (text != null && text.toString().toLowerCase().contains(target)) match = true;
        if (desc != null && desc.toString().toLowerCase().contains(target)) match = true;
        if (viewId != null && viewId.toLowerCase().contains(target)) match = true;

        if (match) {
            // Find clickable ancestor if this node itself is not clickable
            AccessibilityNodeInfo clickableNode = node;
            while (clickableNode != null && !clickableNode.isClickable()) {
                AccessibilityNodeInfo parent = clickableNode.getParent();
                clickableNode = parent;
            }
            if (clickableNode != null && clickableNode.isClickable()) {
                return clickableNode.performAction(AccessibilityNodeInfo.ACTION_CLICK);
            }
            return node.performAction(AccessibilityNodeInfo.ACTION_CLICK);
        }

        int count = node.getChildCount();
        for (int i = 0; i < count; i++) {
            AccessibilityNodeInfo child = node.getChild(i);
            if (child != null) {
                boolean clicked = findAndClick(child, target);
                child.recycle();
                if (clicked) return true;
            }
        }
        return false;
    }

    /**
     * Scrolls the active screen forward or backward.
     */
    public boolean performScroll(boolean forward) {
        // Do not allow even navigation gestures inside banking, payment, OTP or password apps.
        if (isSensitiveForegroundApp()) return false;
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return false;

        try {
            return findAndScroll(root, forward);
        } finally {
            root.recycle();
        }
    }

    private boolean findAndScroll(AccessibilityNodeInfo node, boolean forward) {
        if (node == null) return false;

        if (node.isScrollable()) {
            int action = forward
                ? AccessibilityNodeInfo.ACTION_SCROLL_FORWARD
                : AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD;
            return node.performAction(action);
        }

        int count = node.getChildCount();
        for (int i = 0; i < count; i++) {
            AccessibilityNodeInfo child = node.getChild(i);
            if (child != null) {
                boolean scrolled = findAndScroll(child, forward);
                child.recycle();
                if (scrolled) return true;
            }
        }
        return false;
    }

    /**
     * Enters text into the focused or matching editable field.
     */
    public boolean performInputText(String text, String targetHint) {
        if (isSensitiveForegroundApp()) return false;
        if (text == null) return false;
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return false;

        try {
            AccessibilityNodeInfo targetNode = findEditableNode(root, targetHint != null ? targetHint.toLowerCase() : "");
            if (targetNode != null) {
                Bundle arguments = new Bundle();
                arguments.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text);
                return targetNode.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, arguments);
            }
        } finally {
            root.recycle();
        }
        return false;
    }

    private AccessibilityNodeInfo findEditableNode(AccessibilityNodeInfo node, String hint) {
        if (node == null || !node.isVisibleToUser()) return null;

        // Never type into password fields automatically
        if (node.isPassword()) return null;

        if (node.isEditable()) {
            if (hint.isEmpty()) return node;
            CharSequence text = node.getText();
            CharSequence desc = node.getContentDescription();
            String viewId = node.getViewIdResourceName();
            if ((text != null && text.toString().toLowerCase().contains(hint)) ||
                (desc != null && desc.toString().toLowerCase().contains(hint)) ||
                (viewId != null && viewId.toLowerCase().contains(hint))) {
                return node;
            }
        }

        int count = node.getChildCount();
        for (int i = 0; i < count; i++) {
            AccessibilityNodeInfo child = node.getChild(i);
            if (child != null) {
                AccessibilityNodeInfo res = findEditableNode(child, hint);
                if (res != null) return res;
                child.recycle();
            }
        }
        return null;
    }

    public boolean navigateBack() {
        return performGlobalAction(GLOBAL_ACTION_BACK);
    }

    public boolean navigateHome() {
        return performGlobalAction(GLOBAL_ACTION_HOME);
    }

    public boolean openNotifications() {
        return performGlobalAction(GLOBAL_ACTION_NOTIFICATIONS);
    }
}
