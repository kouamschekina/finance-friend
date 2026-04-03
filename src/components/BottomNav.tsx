import { useLocation, Link } from 'react-router-dom';
import { LayoutDashboard, ArrowLeftRight, Wallet, Target, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useUI } from '@/contexts/UIContext';
import { useLocale } from '@/contexts/LocaleContext';

export function BottomNav() {
  const location = useLocation();
  const { openTransactionDrawer } = useUI();
  const { t } = useLocale();

  const navItems = [
    { path: '/', label: t('nav.home'), icon: LayoutDashboard },
    { path: '/transactions', label: t('nav.transactions'), icon: ArrowLeftRight, dataTour: 'nav-activity-mobile' },
    { path: '/advisor', label: t('page.advisor'), icon: Brain },
    { path: '/budgets', label: t('nav.budgets'), icon: Wallet, dataTour: 'nav-budgets-mobile' },
    { path: '/goals', label: t('nav.goals'), icon: Target, dataTour: 'nav-goals-mobile' },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border/40 bg-background/85 glass pb-safe">
      <div className="mx-auto flex max-w-lg items-end justify-around px-1 pt-2">
        {navItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex min-w-[56px] flex-col items-center gap-1 px-2 py-1.5',
                active ? 'text-primary' : 'text-muted-foreground',
              )}
              data-tour={(item as any).dataTour}
            >
              <span className="relative flex h-7 w-7 items-center justify-center">
                <item.icon
                  className={cn('h-[22px] w-[22px]', active && 'scale-105')}
                  strokeWidth={active ? 2.4 : 2}
                />
                {active && (
                  <motion.span
                    layoutId="tabDot"
                    className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-primary"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </span>
              <span
                className={cn(
                  'max-w-[4.5rem] truncate text-[10px] font-semibold',
                  active ? 'opacity-100' : 'opacity-80',
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
