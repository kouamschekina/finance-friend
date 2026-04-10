import { useEffect } from 'react';
import { usePushNotifications } from '@/hooks/use-push-notifications';

const PROMPTED_KEY = 'fenowa-push-prompted';

/**
 * Silently subscribes the user to push notifications on first visit.
 * The browser will show its native "Allow notifications?" prompt automatically.
 * If the user denies, we never ask again (browser blocks it anyway).
 */
export function AutoPushPrompt() {
  const { subscribe, status } = usePushNotifications();

  useEffect(() => {
    // Don't ask if already denied, unsupported, or already prompted before
    if (status === 'denied' || status === 'unsupported' || status === 'granted') return;
    if (localStorage.getItem(PROMPTED_KEY)) return;
    if (!('Notification' in window) || !('PushManager' in window)) return;

    // Wait 5 seconds after app load — feels less aggressive than instant
    const timer = setTimeout(async () => {
      localStorage.setItem(PROMPTED_KEY, 'true');
      await subscribe();
    }, 5000);

    return () => clearTimeout(timer);
  }, [status, subscribe]);

  return null;
}
