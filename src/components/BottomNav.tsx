import { useLocation, Link } from 'react-router-dom';
import { LayoutDashboard, ArrowLeftRight, Wallet, Target, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

export function BottomNav() {
  const location = useLocation();
  const { t } = useTranslation();

  const navItems = [
    { path: '/',             label: t('nav.dashboard'),    icon: LayoutDashboard },
    { path: '/transactions', label: t('nav.transactions'), icon: ArrowLeftRight,  dataTour: 'nav-activity-mobile' },
    { path: '/advisor',      label: t('nav.advisor'),      icon: Brain },
    { path: '/budgets',      label: t('nav.budgets'),      icon: Wallet,          dataTour: 'nav-budgets-mobile' },
    { path: '/goals',        label: t('nav.goals'),        icon: Target,          dataTour: 'nav-goals-mobile' },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border/40 bg-background/85 glass pb-safe">
      {/* Equal-width columns — each item gets exactly 1/5 of the bar */}
      <div className="grid grid-cols-5 pt-1.5 pb-1">
        {navItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              data-tour={(item as any).dataTour}
              className={cn(
                'flex flex-col items-center justify-center gap-1 py-1.5',
                active ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              {/* Icon wrapper — fixed size so the dot never shifts layout */}
              <span className="relative flex h-6 w-6 items-center justify-center">
                <item.icon
                  className="h-5 w-5"
                  strokeWidth={active ? 2.5 : 1.8}
                />
                {active && (
                  <motion.span
                    layoutId="tabDot"
                    className="absolute -bottom-1.5 left-1/2 h-[3px] w-[3px] -translate-x-1/2 rounded-full bg-primary"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </span>

              {/* Label — fixed line-height, no wrapping, centered */}
              <span className={cn(
                'w-full text-center text-[10px] font-semibold leading-none truncate px-1',
                active ? 'opacity-100' : 'opacity-60',
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
