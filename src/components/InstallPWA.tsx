import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function InstallPWA() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isVisible, setIsVisible] = useState(false);

    const [isDev, setIsDev] = useState(false);
    const [swStatus, setSwStatus] = useState('Checking...');

    useEffect(() => {
        setIsDev(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(() => setSwStatus('Ready'))
                .catch(err => setSwStatus('Error: ' + err.message));
        } else {
            setSwStatus('Not Supported');
        }

        console.log('InstallPWA: Mounting component...');

        const handler = (e: Event) => {
            console.log('InstallPWA: beforeinstallprompt event caught!', e);
            e.preventDefault();
            setDeferredPrompt(e);

            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const hasDismissed = localStorage.getItem('pwa-install-dismissed');

            console.log('InstallPWA: isLocalhost:', isLocalhost, 'hasDismissed:', !!hasDismissed);

            if (!hasDismissed || isLocalhost) {
                console.log('InstallPWA: Showing banner in 3s...');
                setTimeout(() => setIsVisible(true), 3000);
            }
        };

        window.addEventListener('beforeinstallprompt', handler);

        // Also check if app is already installed
        window.addEventListener('appinstalled', () => {
            console.log('InstallPWA: App was installed');
            setIsVisible(false);
            setDeferredPrompt(null);
        });

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setDeferredPrompt(null);
            setIsVisible(false);
        }
    };

    const handleDismiss = () => {
        setIsVisible(false);
        localStorage.setItem('pwa-install-dismissed', 'true');
    };

    return (
        <>
            <AnimatePresence>
                {isVisible && (
                    <motion.div
                        initial={{ y: -100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -100, opacity: 0 }}
                        className="fixed top-4 left-4 right-4 z-[100] lg:left-auto lg:right-8 lg:top-8 lg:w-96"
                    >
                        <div className="glass border border-primary/20 p-5 rounded-[2.5rem] shadow-2xl shadow-primary/20 flex items-center gap-4 relative overflow-hidden group">
                            <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />

                            <div className="w-14 h-14 rounded-2xl p-2.5 bg-card border border-border/40 shrink-0 shadow-sm overflow-hidden z-10">
                                <img src="/logowithoutbg.png" alt="Logo" className="w-full h-full object-contain" />
                            </div>

                            <div className="flex-1 min-w-0 z-10">
                                <h3 className="text-sm font-bold text-foreground leading-tight">Install Fenowa</h3>
                                <p className="text-[11px] text-muted-foreground font-medium mt-0.5">Install for better experience.</p>
                            </div>

                            <div className="flex flex-col gap-2 z-10">
                                <Button
                                    size="sm"
                                    onClick={handleInstall}
                                    className="rounded-xl h-9 px-4 finance-gradient border-none shadow-lg shadow-primary/20 text-[11px] font-bold"
                                >
                                    <Download className="w-3.5 h-3.5 mr-1.5" />
                                    Install
                                </Button>
                                <button
                                    onClick={handleDismiss}
                                    className="absolute top-3 right-3 text-muted-foreground/40 hover:text-foreground transition-colors"
                                    aria-label="Dismiss"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
