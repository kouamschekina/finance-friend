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
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission === 'granted' || localStorage.getItem(STORAGE_KEY) === 'true';
    }
    return localStorage.getItem(STORAGE_KEY) === 'true';
  });

  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported');
      return;
    }
    if (Notification.permission === 'denied') setStatus('denied');
    else if (Notification.permission === 'granted' && isEnabled) setStatus('granted');
  }, [isEnabled]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    console.log('[Push] Starting subscribe, VAPID key present:', !!VAPID_PUBLIC_KEY, 'length:', VAPID_PUBLIC_KEY?.length);
    if (!VAPID_PUBLIC_KEY) {
      console.error('[Push] VITE_VAPID_PUBLIC_KEY is not set');
      setStatus('idle');
      return false;
    }
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.error('[Push] ServiceWorker or PushManager not supported');
      setStatus('unsupported');
      return false;
    }

    setStatus('loading');
    try {
      console.log('[Push] Requesting notification permission...');
      const permission = await Notification.requestPermission();
      console.log('[Push] Permission result:', permission);
      if (permission !== 'granted') {
        setStatus('denied');
        return false;
      }

      console.log('[Push] Waiting for SW ready...');
      const reg = await navigator.serviceWorker.ready;
      console.log('[Push] SW ready, scope:', reg.scope);

      let pushSub = await reg.pushManager.getSubscription();
      console.log('[Push] Existing subscription:', !!pushSub);

      if (!pushSub) {
        console.log('[Push] Creating new push subscription...');
        pushSub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
        console.log('[Push] Push subscription created:', pushSub.endpoint);
      }

      const subJson = pushSub.toJSON();
      const keys = subJson.keys as { p256dh: string; auth: string };

      const { data: { user } } = await supabase.auth.getUser();
      console.log('[Push] User:', user?.id ?? 'guest');

      const row: Record<string, string> = {
        endpoint: pushSub.endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      };
      if (user?.id) row.user_id = user.id;

      console.log('[Push] Saving to Supabase...');
      const { error } = await (supabase as any)
        .from('push_subscriptions')
        .upsert(row, { onConflict: 'endpoint' });

      if (error) {
        console.error('[Push] Supabase error:', JSON.stringify(error));
        throw error;
      }

      localStorage.setItem(STORAGE_KEY, 'true');
      setIsEnabled(true);
      setStatus('granted');
      console.log('[Push] ✅ Subscribed successfully');
      return true;
    } catch (e) {
      console.error('[Push] Subscribe failed:', e);
      setStatus('idle');
      return false;
    }
  }, []);

  const unsubscribe = useCallback(async (): Promise<void> => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const pushSub = await reg.pushManager.getSubscription();
      if (pushSub) {
        await (supabase as any)
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', pushSub.endpoint);
        await pushSub.unsubscribe();
      }
    } catch (e) {
      console.error('[Push] Unsubscribe failed:', e);
    } finally {
      localStorage.removeItem(STORAGE_KEY);
      setIsEnabled(false);
      setStatus('idle');
    }
  }, []);

  return { status, isEnabled, subscribe, unsubscribe };
}
