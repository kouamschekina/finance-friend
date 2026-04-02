import { useLocation, Link } from 'react-router-dom';
import { LayoutDashboard, ArrowLeftRight, Wallet, Target, Brain, User, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFinance } from '@/contexts/FinanceContext';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { path: '/budgets', label: 'Budgets', icon: Wallet },
  { path: '/goals', label: 'Goals', icon: Target },
  { path: '/advisor', label: 'Advisor', icon: Brain },
];

const pageTitle: Record<string, string> = {
  '/': 'Dashboard',
  '/transactions': 'Transactions',
  '/budgets': 'Budgets',
  '/goals': 'Goals',
  '/advisor': 'AI Advisor',
  '/profile': 'Profile',
};

export function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { profile } = useFinance();
  const title = pageTitle[location.pathname] || 'FinWise';

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 border-r border-border/50 bg-sidebar p-4 gap-2 fixed h-full z-20">
        <div className="flex items-center gap-3 px-3 py-4 mb-2">
          <div className="w-10 h-10 rounded-2xl finance-gradient flex items-center justify-center shadow-lg" style={{ boxShadow: 'var(--shadow-glow)' }}>
            <Wallet className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <span className="text-base font-bold text-foreground">FinWise</span>
            <p className="text-[10px] text-muted-foreground font-medium">Smart Finance</p>
          </div>
        </div>

        <nav className="flex flex-col gap-0.5 flex-1">
          {navItems.map(item => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                  active
                    ? 'bg-primary/15 text-primary shadow-sm'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                )}
              >
                <item.icon className={cn('w-[18px] h-[18px]', active && 'drop-shadow-sm')} />
                <span>{item.label}</span>
                {active && <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-50" />}
              </Link>
            );
          })}
        </nav>

        {/* Desktop profile link */}
        <Link to="/profile" className={cn(
          'flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 border border-border/50',
          location.pathname === '/profile' ? 'bg-primary/15 text-primary' : 'hover:bg-secondary text-muted-foreground hover:text-foreground'
        )}>
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <User className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{profile.name || 'Set up profile'}</p>
            <p className="text-[10px] text-muted-foreground">{profile.currency}</p>
          </div>
        </Link>
      </aside>

      {/* Main content */}
      <main className="flex-1 lg:ml-64 pb-24 lg:pb-6">
        {/* Mobile Header */}
        <header className="lg:hidden sticky top-0 z-20 bg-background/80 glass border-b border-border/30 px-4 py-3">
          <div className="flex items-center justify-between">
            <Link to="/profile" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
                <User className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{profile.name || 'User'}</p>
                <p className="text-[10px] text-muted-foreground font-medium">
                  {title}
                </p>
              </div>
            </Link>
            <div className="w-9 h-9 rounded-xl finance-gradient flex items-center justify-center">
              <Wallet className="w-4 h-4 text-primary-foreground" />
            </div>
          </div>
        </header>

        <div className="max-w-5xl mx-auto p-4 lg:p-6">
          {children}
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-card/90 glass border-t border-border/30 z-30 bottom-nav-safe">
        <div className="flex items-center justify-around py-1.5 px-2">
          {navItems.map(item => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-200 min-w-[52px]',
                  active ? 'text-primary' : 'text-muted-foreground active:scale-95'
                )}
              >
                <div className={cn(
                  'p-1 rounded-lg transition-all duration-200',
                  active && 'bg-primary/15'
                )}>
                  <item.icon className="w-5 h-5" />
                </div>
                <span className={cn('text-[10px] font-medium', active && 'font-semibold')}>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
