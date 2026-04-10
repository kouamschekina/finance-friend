import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;
const STORAGE_KEY = 'fenowa-push-enabled';

export type PushStatus = 'idle' | 'loading' | 'granted' | 'denied' | 'unsupported';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function usePushNotifications() {
  const [status, setStatus] = useState<PushStatus>('idle');
  const [isEnabled, setIsEnabled] = useState(() => {
    // Consider enabled if permission already granted (auto-subscribed on first visit)
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission === 'granted' || localStorage.getItem(STORAGE_KEY) === 'true';
    }
    return localStorage.getItem(STORAGE_KEY) === 'true';
  });

  // Check current permission state on mount
  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported');
      return;
    }
    if (Notification.permission === 'denied') setStatus('denied');
    else if (Notification.permission === 'granted' && isEnabled) setStatus('granted');
  }, [isEnabled]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!VAPID_PUBLIC_KEY) {
      console.error('VITE_VAPID_PUBLIC_KEY is not set in .env');
      return false;
    }
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;

    setStatus('loading');
    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus('denied');
        return false;
      }

      // Get the service worker registration
      const reg = await navigator.serviceWorker.ready;

      // Check if already subscribed
      let pushSub = await reg.pushManager.getSubscription();

      // If not subscribed, create a new subscription
      if (!pushSub) {
        pushSub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }

      // Save subscription to Supabase
      const subJson = pushSub.toJSON();
      const keys = subJson.keys as { p256dh: string; auth: string };

      const { error } = await (supabase as any)
        .from('push_subscriptions')
        .upsert(
          {
            endpoint: pushSub.endpoint,
            p256dh: keys.p256dh,
            auth: keys.auth,
          },
          { onConflict: 'endpoint' }
        );

      if (error) throw error;

      localStorage.setItem(STORAGE_KEY, 'true');
      setIsEnabled(true);
      setStatus('granted');
      return true;
    } catch (e) {
      console.error('Push subscription failed:', e);
      setStatus('idle');
      return false;
    }
  }, []);

  const unsubscribe = useCallback(async (): Promise<void> => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const pushSub = await reg.pushManager.getSubscription();
      if (pushSub) {
        // Remove from Supabase
        await (supabase as any)
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', pushSub.endpoint);
        await pushSub.unsubscribe();
      }
    } catch (e) {
      console.error('Unsubscribe failed:', e);
    } finally {
      localStorage.removeItem(STORAGE_KEY);
      setIsEnabled(false);
      setStatus('idle');
    }
  }, []);

  return { status, isEnabled, subscribe, unsubscribe };
}
