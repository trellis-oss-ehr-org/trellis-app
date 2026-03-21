import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./useAuth";
import { useApi } from "./useApi";
import { requestPushToken } from "../lib/firebase";

interface PushNotificationState {
  permission: NotificationPermission | "unsupported";
  loading: boolean;
  enabled: boolean;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
}

export function usePushNotifications(): PushNotificationState {
  const { user } = useAuth();
  const api = useApi();
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    "serviceWorker" in navigator && "Notification" in window
      ? Notification.permission
      : "unsupported"
  );
  const [loading, setLoading] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [currentToken, setCurrentToken] = useState<string | null>(null);

  // On mount, if permission is already granted, re-register token (handles rotation)
  useEffect(() => {
    if (permission !== "granted" || !user) return;

    let cancelled = false;
    (async () => {
      try {
        const token = await requestPushToken();
        if (cancelled || !token) return;
        setCurrentToken(token);
        setEnabled(true);
        await api.post("/api/push/register", {
          fcm_token: token,
          device_label: navigator.userAgent.slice(0, 100),
        });
      } catch {
        // Silently fail — user can manually re-enable
      }
    })();
    return () => { cancelled = true; };
  }, [permission, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const enable = useCallback(async () => {
    if (permission === "unsupported") return;
    setLoading(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") return;

      const token = await requestPushToken();
      if (!token) return;
      setCurrentToken(token);

      await api.post("/api/push/register", {
        fcm_token: token,
        device_label: navigator.userAgent.slice(0, 100),
      });
      setEnabled(true);
    } catch (err) {
      console.error("Failed to enable push notifications:", err);
    } finally {
      setLoading(false);
    }
  }, [permission, api]);

  const disable = useCallback(async () => {
    if (!currentToken) return;
    setLoading(true);
    try {
      await api.post("/api/push/unregister", { fcm_token: currentToken });
      setEnabled(false);
      setCurrentToken(null);
    } catch (err) {
      console.error("Failed to disable push notifications:", err);
    } finally {
      setLoading(false);
    }
  }, [currentToken, api]);

  return { permission, loading, enabled, enable, disable };
}
