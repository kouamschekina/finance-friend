import React from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useLocale } from '@/contexts/LocaleContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { Globe, Palette, Sun, Moon } from 'lucide-react';
import {
    LOCALE_CODES,
    LOCALE_LABELS,
    type LocaleCode,
} from '@/lib/i18n';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface LandingProps {
    onContinueLater: () => void;
}

export const Landing: React.FC<LandingProps> = ({ onContinueLater }) => {
    const { signInWithGoogle } = useAuth();
    const { locale, setLocale, t } = useLocale();
    const { theme, setTheme } = useTheme();

    return (
        <div className="h-[100dvh] w-screen flex flex-col bg-background text-foreground transition-colors duration-500 overflow-hidden relative touch-none">
            {/* Dynamic Background Elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px] animate-pulse" />
                <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
            </div>

            <header className="w-full max-w-6xl mx-auto px-6 py-6 flex justify-end gap-3 z-50">
                {/* Language Toggle */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-11 w-11 rounded-2xl border border-border/40 bg-card/50 shadow-sm">
                            <Globe className="h-5 w-5" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-2xl border-border/50 bg-background/95 backdrop-blur-xl">
                        {LOCALE_CODES.map((code) => (
                            <DropdownMenuItem
                                key={code}
                                onClick={() => setLocale(code as LocaleCode)}
                                className="rounded-xl font-medium"
                            >
                                {LOCALE_LABELS[code]}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* Theme Toggle */}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setTheme(theme === 'light' ? 'midnight' : 'light')}
                    className="h-11 w-11 rounded-2xl border border-border/40 bg-card/50 shadow-sm"
                >
                    {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                </Button>
            </header>

            <main className="flex-1 flex flex-col items-center justify-center px-6 pb-20 text-center relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    className="max-w-md w-full space-y-10"
                >
                    {/* Logo Area - Static & Larger */}
                    <div className="flex justify-center mb-4">
                        <motion.div
                            className="w-44 h-44 flex items-center justify-center pointer-events-none"
                        >
                            <img
                                src="/logowithoutbg.png"
                                alt="FinWise Logo"
                                className="w-full h-full object-contain drop-shadow-[0_20px_50px_rgba(0,0,0,0.15)]"
                            />
                        </motion.div>
                    </div>

                    <div className="space-y-4">
                        <h1 className="text-4xl font-black tracking-tight sm:text-6xl text-foreground bg-clip-text">
                            {t('landing.welcome')}
                        </h1>
                        <p className="text-lg text-muted-foreground/80 font-medium max-w-[280px] mx-auto leading-relaxed">
                            {t('landing.signin')}
                        </p>
                    </div>

                    <div className="flex flex-col gap-4 mt-12">
                        {/* Official Google Button Style */}
                        <Button
                            onClick={signInWithGoogle}
                            size="lg"
                            className="h-14 rounded-2xl font-bold bg-white text-[#3c4043] hover:bg-white/95 transition-all duration-300 shadow-[0_1px_3px_0_rgba(60,64,67,0.30),0_4px_8px_3px_rgba(60,64,67,0.15)] flex items-center justify-center gap-4 active:scale-[0.98] border border-[#e2e8f0]"
                        >
                            <div className="w-6 h-6 flex items-center justify-center shrink-0">
                                <svg viewBox="0 0 24 24" className="w-full h-full">
                                    <path
                                        fill="#4285F4"
                                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                    />
                                    <path
                                        fill="#34A853"
                                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                    />
                                    <path
                                        fill="#FBBC05"
                                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                    />
                                    <path
                                        fill="#EA4335"
                                        d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                    />
                                </svg>
                            </div>
                            <span className="text-base">{t('landing.google')}</span>
                        </Button>

                        <Button
                            variant="ghost"
                            onClick={onContinueLater}
                            className="h-12 rounded-2xl font-bold text-muted-foreground/60 hover:text-foreground hover:bg-secondary/30 transition-all duration-300 active:scale-[0.98]"
                        >
                            {t('landing.later')}
                        </Button>
                    </div>
                </motion.div>
            </main>

            <footer className="py-8 text-center text-[11px] font-bold tracking-widest uppercase text-muted-foreground/40 z-10">
                &copy; 2026 FinWise · Smart Wealth Management
            </footer>
        </div>
    );
};
