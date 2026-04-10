import { useEffect, useCallback, useRef } from 'react';

const STORAGE_KEY = 'fenowa-reminders';
const PERMISSION_KEY = 'fenowa-notif-permission';

export interface ReminderSettings {
  enabled: boolean;
  times: string[]; // HH:MM strings, e.g. ["08:00", "13:00", "20:00"]
}

const DEFAULT_SETTINGS: ReminderSettings = {
  enabled: false,
  times: ['08:00', '13:00', '20:00'],
};

export function loadReminderSettings(): ReminderSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

export function saveReminderSettings(s: ReminderSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

const MESSAGES = [
  { title: "💰 Log your spending", body: "Take 30 seconds to record today's transactions in Fenowa." },
  { title: "📊 Stay on track", body: "Don't forget to log your expenses — your budget will thank you!" },
  { title: "🎯 Quick check-in", body: "How's your spending today? Open Fenowa and add your transactions." },
  { title: "💡 Money tip", body: "Tracking every transaction is the #1 habit of people who reach their savings goals." },
  { title: "📝 Record it now", body: "A few seconds of logging today keeps financial stress away tomorrow." },
];

function getRandomMessage() {
  return MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
}

/** Returns ms until the next occurrence of HH:MM today or tomorrow */
function msUntil(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  const now = new Date();
  const target = new Date(now);
  target.setHours(h, m, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  return target.getTime() - now.getTime();
}

function showNotification(title: string, body: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  // Prefer service worker notification (works in background)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then((reg) => {
      reg.showNotification(title, {
        body,
        icon: '/android-chrome-192x192.png',
        badge: '/favicon-32x32.png',
        tag: 'fenowa-reminder',
        renotify: true,
        data: { url: '/transactions' },
      });
    }).catch(() => {
      new Notification(title, { body, icon: '/android-chrome-192x192.png' });
    });
  } else {
    new Notification(title, { body, icon: '/android-chrome-192x192.png' });
  }
}

export function useDailyReminders() {
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const scheduleReminders = useCallback((settings: ReminderSettings) => {
    clearTimers();
    if (!settings.enabled || Notification.permission !== 'granted') return;

    settings.times.forEach((hhmm) => {
      const delay = msUntil(hhmm);
      const fire = () => {
        const msg = getRandomMessage();
        showNotification(msg.title, msg.body);
        // Re-schedule for next day
        const nextDelay = msUntil(hhmm);
        const t = setTimeout(fire, nextDelay);
        timersRef.current.push(t);
      };
      const t = setTimeout(fire, delay);
      timersRef.current.push(t);
    });
  }, [clearTimers]);

  const requestPermissionAndEnable = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const result = await Notification.requestPermission();
    localStorage.setItem(PERMISSION_KEY, result);
    return result === 'granted';
  }, []);

  // Boot: load settings and schedule on mount
  useEffect(() => {
    const settings = loadReminderSettings();
    if (settings.enabled) scheduleReminders(settings);
    return clearTimers;
  }, [scheduleReminders, clearTimers]);

  return { scheduleReminders, requestPermissionAndEnable, clearTimers };
}
