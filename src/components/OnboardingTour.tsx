import React, { useState, useEffect } from 'react';
import { Joyride, Step, STATUS } from 'react-joyride';
import { useFinance } from '@/contexts/FinanceContext';
import { useTheme } from '@/contexts/ThemeContext';

import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Tooltip = ({
    index,
    step,
    backProps,
    primaryProps,
    skipProps,
    isLastStep,
    size,
    tooltipProps,
}: any) => {
    return (
        <div {...tooltipProps} className="max-w-[340px] w-full px-4 outline-none">
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-card shadow-2xl border border-border/50 rounded-[1.75rem] overflow-hidden p-6 relative"
            >
                {/* Header Decoration */}
                <div className="absolute top-0 left-0 right-0 h-1 finance-gradient opacity-80" />

                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                            <Sparkles className="w-4 h-4 text-primary" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Step {index + 1} of {size}</span>
                    </div>
                </div>

                <div className="space-y-2 mb-6">
                    <h3 className="text-lg font-black tracking-tight text-foreground leading-tight">
                        {step.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed font-medium">
                        {step.content}
                    </p>
                </div>

                <div className="flex items-center justify-between gap-3 pt-2">
                    <button
                        {...skipProps}
                        className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/60 hover:text-foreground transition-colors outline-none"
                    >
                        Skip Tour
                    </button>

                    <div className="flex items-center gap-2">
                        {index > 0 && (
                            <button
                                {...backProps}
                                className="w-10 h-10 rounded-xl bg-secondary/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors outline-none border border-border/40"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                        )}
                        <button
                            {...primaryProps}
                            className="h-10 px-5 rounded-xl finance-gradient text-primary-foreground text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all outline-none flex items-center gap-2"
                        >
                            {isLastStep ? 'Get Started' : 'Next'}
                            {!isLastStep && <ChevronRight className="w-4 h-4" />}
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export const OnboardingTour: React.FC = () => {
    const { profile, completeOnboarding } = useFinance();
    const { theme } = useTheme();
    const [run, setRun] = useState(false);
    const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 1024);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 1024);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (profile && profile.onboarding_completed !== true) {
            const timer = setTimeout(() => {
                console.log('FinWise: Starting Onboarding Tour');
                setRun(true);
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [profile]);

    const steps: any[] = [
        {
            target: 'body',
            placement: 'center',
            title: 'Welcome to FinWise! 🏦',
            content: 'Take a quick tour of your financial command center. We\'ll show you how to track, save, and grow your wealth.',
            disableBeacon: true,
        },
        {
            target: '[data-tour="date-picker"]',
            title: 'Control Your View 📅',
            content: 'Analyze your finances by any date range. Use the picker to filter charts and transactions instantly.',
            placement: 'bottom' as const,
            disableBeacon: true,
        },
        {
            target: '[data-tour="monthly-summary"]',
            title: 'Visual Insights 📊',
            content: 'Stay on top of your spending with dynamic charts. See exactly where your money goes by category.',
            placement: 'top' as const,
            disableBeacon: true,
        },
        {
            target: isMobile ? '[data-tour="nav-activity-mobile"]' : '[data-tour="nav-activity-desktop"]',
            title: 'Detailed Activity 📋',
            content: 'View every single transaction in detail. Filter, search, and manage your history with ease.',
            placement: isMobile ? 'top' : 'right',
            disableBeacon: true,
        },
        {
            target: isMobile ? '[data-tour="nav-budgets-mobile"]' : '[data-tour="nav-budgets-desktop"]',
            title: 'Smart Budgets 💰',
            content: 'Set monthly limits for categories like Food or Travel. We\'ll notify you when you\'re approaching your limit!',
            placement: isMobile ? 'top' : 'right',
            disableBeacon: true,
        },
        {
            target: isMobile ? '[data-tour="nav-goals-mobile"]' : '[data-tour="nav-goals-desktop"]',
            title: 'Savings Goals 🎯',
            content: 'Dreaming of a new car or a vacation? Create goals and track your progress as you save bit by bit.',
            placement: isMobile ? 'top' : 'right',
            disableBeacon: true,
        },
        {
            target: isMobile ? '[data-tour="add-transaction-mobile"]' : '[data-tour="add-transaction-desktop"]',
            title: 'Track Your Money 💸',
            content: 'Click here to add your first income or expense. We support over 40 categories with automatic budget tracking!',
            placement: isMobile ? 'top' : 'bottom',
            disableBeacon: true,
        },
        {
            target: isMobile ? '[data-tour="quick-menu-mobile"]' : '[data-tour="advisor-link-desktop"]',
            title: 'AI Financial Advisor 🧠',
            content: 'Meet Groq, your personal financial genius. Get context-aware advice based on your real transactions and goals.',
            placement: isMobile ? 'bottom' : 'right',
            disableBeacon: true,
        },
        {
            target: 'body',
            placement: 'center',
            title: 'Ready to Fly! 🚀',
            content: 'You\'re all set! Head over to the Profile section to finish setting up your currency and monthly income. Happy saving!',
            disableBeacon: true,
        },
    ];

    const handleJoyrideCallback = (data: any) => {
        const { status } = data;
        if (([STATUS.FINISHED, STATUS.SKIPPED] as string[]).includes(status)) {
            setRun(false);
            completeOnboarding();
        }
    };

    const isDark = theme !== 'light';
    const JoyrideComponent = Joyride as any;

    return (
        <JoyrideComponent
            steps={steps}
            run={run}
            continuous
            showProgress={false}
            showSkipButton
            callback={handleJoyrideCallback}
            tooltipComponent={Tooltip}
            styles={{
                options: {
                    zIndex: 1000,
                    overlayColor: 'rgba(0, 0, 0, 0.7)',
                },
                spotlight: {
                    borderRadius: '1rem',
                }
            }}
        />
    );
};
