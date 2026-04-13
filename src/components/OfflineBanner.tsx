import { useEffect, useState } from 'react';
import { WifiOff, RefreshCw, Wifi } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFinance } from '@/contexts/FinanceContext';

export function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);
  const [showToast, setShowToast] = useState(false);
  const [toastType, setToastType] = useState<'offline' | 'online'>('offline');
  const { pendingSyncCount, syncing } = useFinance();

  useEffect(() => {
    const handleOnline = () => {
      setOffline(false);
      setToastType('online');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    };
    const handleOffline = () => {
      setOffline(true);
      setToastType('offline');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3500);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Show toast on first load if already offline
  useEffect(() => {
    if (!navigator.onLine) {
      setToastType('offline');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3500);
    }
  }, []);

  return (
    <>
      {/* Toast banner — slides in, auto-dismisses */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            key="toast"
            initial={{ y: -64, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -64, opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="fixed top-4 left-1/2 z-[300] -translate-x-1/2 pointer-events-none"
          >
            <div
              className={`
                flex items-center gap-2.5 px-4 py-2.5 rounded-2xl shadow-2xl
                border backdrop-blur-xl text-sm font-semibold whitespace-nowrap
                ${toastType === 'offline'
                  ? 'bg-background/95 border-border/60 text-foreground'
                  : 'bg-background/95 border-emerald-500/30 text-emerald-400'}
              `}
            >
              {toastType === 'offline' ? (
                <>
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/15">
                    <WifiOff className="h-3 w-3 text-amber-400" />
                  </span>
                  <span className="text-foreground/90">You're offline</span>
                  <span className="text-muted-foreground font-normal text-xs">· changes saved locally</span>
                </>
              ) : (
                <>
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15">
                    <Wifi className="h-3 w-3 text-emerald-400" />
                  </span>
                  <span>Back online</span>
                  {pendingSyncCount > 0 && (
                    <span className="text-muted-foreground font-normal text-xs">· syncing {pendingSyncCount} change{pendingSyncCount > 1 ? 's' : ''}</span>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Persistent small indicator — only visible while offline or syncing */}
      <AnimatePresence>
        {(offline || syncing) && (
          <motion.div
            key="pill"
            initial={{ opacity: 0, scale: 0.8, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed bottom-[5.5rem] right-4 z-[200] lg:bottom-6"
          >
            <div
              className={`
                flex items-center gap-1.5 px-2.5 py-1.5 rounded-full shadow-lg
                border backdrop-blur-xl text-[11px] font-semibold
                ${syncing
                  ? 'bg-background/90 border-blue-500/30 text-blue-400'
                  : 'bg-background/90 border-border/50 text-muted-foreground'}
              `}
            >
              {syncing ? (
                <>
                  <RefreshCw className="h-3 w-3 animate-spin text-blue-400" />
                  <span>Syncing</span>
                </>
              ) : (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                  <span>Offline</span>
                  {pendingSyncCount > 0 && (
                    <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-400/20 px-1 text-[10px] font-bold text-amber-400">
                      {pendingSyncCount}
                    </span>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
