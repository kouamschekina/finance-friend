import { useLocation, Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  Target,
  Menu,
  Settings2,
  User,
  Brain,
  Settings,
  FileText,
  Bell,
  Check,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFinance } from '@/contexts/FinanceContext';
import { useAuth } from '@/contexts/AuthContext';
import { useUI } from '@/contexts/UIContext';
import { useLocale } from '@/contexts/LocaleContext';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { BottomNav } from './BottomNav';
import { TransactionDrawer } from './TransactionDrawer';
import { CategoryDrawer } from './CategoryDrawer';
import { GoalDrawer } from './GoalDrawer';
import { SettingsDrawer } from './SettingsDrawer';
import { OnboardingTour } from './OnboardingTour';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

const pathToTitleKey = {
  '/': 'page.dashboard',
  '/transactions': 'page.transactions',
  '/budgets': 'page.budgets',
  '/goals': 'page.goals',
  '/profile': 'page.profile',
  '/advisor': 'page.advisor',
  '/reports': 'page.reports',
} as const;

export function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, notifications, markNotificationAsRead } = useFinance();
  const { openSettingsDrawer } = useUI();
  const { t } = useLocale();
  const [isQuickMenuOpen, setIsQuickMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;

  const { user } = useAuth();

  const titleKey = pathToTitleKey[location.pathname as keyof typeof pathToTitleKey];
  const title = titleKey ? t(titleKey) : 'FinWise';

  const authAvatarUrl = (user?.user_metadata?.avatar_url as string | undefined) ?? '';
  const avatar_url = authAvatarUrl || profile.avatar_url || '';
  const avatarInitial = (profile.name || user?.email || 'U').trim().slice(0, 1).toUpperCase();

  const navItems = [
    { path: '/', label: t('nav.home'), icon: LayoutDashboard, dataTour: 'nav-home-desktop' },
    { path: '/transactions', label: t('nav.transactions'), icon: ArrowLeftRight, dataTour: 'nav-activity-desktop' },
    { path: '/budgets', label: t('nav.budgets'), icon: Wallet, dataTour: 'nav-budgets-desktop' },
    { path: '/goals', label: t('nav.goals'), icon: Target, dataTour: 'nav-goals-desktop' },
  ];

  return (
    <div className="min-h-[100dvh] flex bg-background text-foreground overflow-x-hidden">
      <OnboardingTour />
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-[17.5rem] shrink-0 border-r border-border/50 bg-sidebar/80 backdrop-blur-xl pt-safe">
        <div className="flex flex-col gap-1 p-5 pb-4 border-b border-border/40">
          <div className="flex items-center gap-3 px-1">
            <div className="w-11 h-11 rounded-2xl p-2 bg-card border border-border/40 shrink-0 shadow-sm overflow-hidden">
              <img src="/logowithoutbg.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0">
              <p className="text-base font-bold tracking-tight truncate">FinWise</p>
              <p className="text-[11px] text-muted-foreground font-medium truncate">
                {profile.name || t('page.dashboard')}
              </p>
            </div>
          </div>
        </div>

        <nav className="flex flex-col gap-0.5 p-3 flex-1">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-secondary/80 hover:text-foreground',
                )}
                data-tour={(item as any).dataTour}
              >
                <item.icon className={cn('w-[18px] h-[18px] shrink-0')} strokeWidth={2.2} />
                <span className="flex-1 truncate">{item.label}</span>
                {active && (
                  <motion.div
                    layoutId="desktopActive"
                    className="w-1 h-5 rounded-full bg-primary-foreground/40 shrink-0"
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 mt-auto border-t border-border/40">
          <button
            type="button"
            onClick={openSettingsDrawer}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-3 rounded-xl border border-border/50',
              'bg-secondary/40 hover:bg-secondary/70 text-foreground transition-colors text-left',
            )}
            data-tour="advisor-link-desktop"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-background/80 border border-border/40">
              <Settings2 className="w-5 h-5 text-muted-foreground" strokeWidth={2} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-semibold">{t('settings.title')}</span>
              <span className="block text-[11px] text-muted-foreground truncate">
                {t('settings.appearance')} · {t('page.advisor')}
              </span>
            </span>
            <Menu className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-40 glass border-b border-border/40 pt-safe">
          <div className="flex items-center justify-between gap-3 px-4 py-3 lg:px-8 lg:py-4 max-w-6xl mx-auto w-full">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setIsQuickMenuOpen(true)}
                className={cn(
                  'shrink-0 flex h-11 w-11 items-center justify-center rounded-2xl',
                  'border border-border/50 bg-card/90 shadow-sm',
                  'active:scale-[0.98] transition-transform',
                )}
                aria-label={t('settings.title')}
                data-tour="quick-menu-mobile"
              >
                <Menu className="w-5 h-5 text-foreground" strokeWidth={2.25} />
              </button>
              <div className="min-w-0">
                <h1 className="text-[15px] font-bold tracking-tight text-foreground truncate">
                  {title}
                </h1>
                <p className="text-[11px] text-muted-foreground font-medium truncate">
                  {profile.currency} · {profile.name || '—'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Notifications */}
              <button
                type="button"
                onClick={() => setIsNotificationsOpen(true)}
                className={cn(
                  'shrink-0 flex h-11 w-11 items-center justify-center rounded-2xl relative',
                  'border border-border/50 bg-card/90 shadow-sm transition-transform active:scale-[0.98]',
                )}
              >
                <Bell className="w-5 h-5 text-foreground" strokeWidth={2.25} />
                {unreadCount > 0 && (
                  <span className="absolute top-2.5 right-2.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground border-2 border-background ring-1 ring-primary/20">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Profile avatar (top-right) */}
              <Link
                to="/profile"
                aria-label={t('page.profile')}
                className={cn(
                  'shrink-0 flex h-11 w-11 items-center justify-center rounded-2xl overflow-hidden',
                  'border border-border/50 bg-card/90 shadow-sm transition-transform active:scale-[0.98]',
                )}
              >
                {avatar_url ? (
                  <img src={avatar_url} alt={profile.name || 'User'} className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
                    <User className="h-5 w-5 text-primary" />
                  </span>
                )}
                <span className="sr-only">{avatarInitial}</span>
              </Link>
            </div>
          </div>
        </header>

        <main className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 pb-28 lg:pb-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="max-w-6xl mx-auto w-full px-4 py-5 sm:px-5 lg:px-8 lg:py-8"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      <BottomNav />
      <TransactionDrawer />
      <CategoryDrawer />
      <GoalDrawer />
      <SettingsDrawer />

      <Sheet open={isNotificationsOpen} onOpenChange={setIsNotificationsOpen}>
        <SheetContent side="right" className="p-0 w-full sm:max-w-md bg-background border-l border-border/50 flex flex-col">
          <SheetHeader className="p-6 border-b border-border/40 shrink-0">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-xl font-bold tracking-tight">Notifications</SheetTitle>
              {unreadCount > 0 && (
                <button
                  onClick={() => notifications.forEach(n => !n.read && markNotificationAsRead(n.id))}
                  className="text-xs font-semibold text-primary hover:underline underline-offset-4"
                >
                  Mark all as read
                </button>
              )}
            </div>
          </SheetHeader>

          <ScrollArea className="flex-1">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                <div className="w-16 h-16 rounded-full bg-secondary/30 flex items-center justify-center mb-4">
                  <Bell className="w-8 h-8 text-muted-foreground/40" />
                </div>
                <h3 className="text-sm font-bold text-foreground mb-1">All caught up!</h3>
                <p className="text-xs text-muted-foreground max-w-[200px]">
                  When something important happens with your finances, we'll let you know.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={cn(
                      "p-5 transition-colors group relative",
                      !n.read ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-secondary/40"
                    )}
                  >
                    {!n.read && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                    )}
                    <div className="flex gap-4">
                      <div className={cn(
                        "w-10 h-10 rounded-xl shrink-0 flex items-center justify-center border",
                        n.type === 'budget_exceeded' ? "bg-destructive/10 border-destructive/20 text-destructive" :
                          n.type === 'budget_warning' ? "bg-warning/10 border-warning/20 text-warning" :
                            n.type === 'goal_reached' ? "bg-success/10 border-success/20 text-success" :
                              "bg-primary/10 border-primary/20 text-primary"
                      )}>
                        {n.type === 'budget_exceeded' || n.type === 'budget_warning' ? <Wallet className="w-5 h-5" /> :
                          n.type === 'goal_reached' || n.type === 'goal_milestone' ? <Target className="w-5 h-5" /> :
                            <Bell className="w-5 h-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h4 className={cn("text-sm font-bold truncate", !n.read ? "text-foreground" : "text-muted-foreground")}>
                            {n.title}
                          </h4>
                          <span className="text-[10px] text-muted-foreground/70 font-medium whitespace-nowrap mt-0.5">
                            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                          {n.message}
                        </p>
                        <div className="flex items-center gap-3">
                          {n.link && (
                            <Link
                              to={n.link}
                              onClick={() => {
                                markNotificationAsRead(n.id);
                                setIsNotificationsOpen(false);
                              }}
                              className="text-[11px] font-bold text-primary hover:underline underline-offset-4"
                            >
                              View details
                            </Link>
                          )}
                          {!n.read && (
                            <button
                              onClick={() => markNotificationAsRead(n.id)}
                              className="text-[11px] font-bold text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                            >
                              <Check className="w-3 h-3" />
                              Mark as read
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <Sheet open={isQuickMenuOpen} onOpenChange={setIsQuickMenuOpen}>
        <SheetContent
          side="left"
          className="p-0 w-[19rem] sm:w-[21rem] bg-background border-r border-border/50"
        >
          <div className="p-5 border-b border-border/40">
            <p className="text-sm font-bold tracking-tight">Menu</p>
            <p className="text-[11px] text-muted-foreground font-medium truncate">
              {profile.name || '—'}
            </p>
          </div>

          <div className="p-4 space-y-2">
            <button
              type="button"
              onClick={() => {
                setIsQuickMenuOpen(false);
                openSettingsDrawer();
              }}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-2xl border border-border/50',
                'bg-card hover:bg-secondary/50 transition-colors text-left',
              )}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Settings className="h-5 w-5" strokeWidth={2} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold">{t('settings.title')}</span>
                <span className="block text-[11px] text-muted-foreground truncate">
                  {t('settings.appearance')} · {t('settings.language')}
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsQuickMenuOpen(false);
                navigate('/advisor');
              }}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-2xl border border-border/50',
                'bg-card hover:bg-secondary/50 transition-colors text-left',
              )}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl finance-gradient text-primary-foreground">
                <Brain className="h-5 w-5" strokeWidth={2} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold">{t('page.advisor')}</span>
                <span className="block text-[11px] text-muted-foreground truncate">Groq</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsQuickMenuOpen(false);
                navigate('/reports');
              }}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-2xl border border-border/50',
                'bg-card hover:bg-secondary/50 transition-colors text-left',
              )}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/50 text-foreground">
                <FileText className="h-5 w-5" strokeWidth={2} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold">{t('page.reports')}</span>
                <span className="block text-[11px] text-muted-foreground truncate">Export PDF</span>
              </span>
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
