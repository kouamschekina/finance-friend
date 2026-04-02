import { useLocation, Link } from 'react-router-dom';
import { LayoutDashboard, ArrowLeftRight, Wallet, Target, User, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { path: '/budgets', label: 'Budgets', icon: Wallet },
  { path: '/goals', label: 'Goals', icon: Target },
  { path: '/advisor', label: 'Advisor', icon: Brain },
  { path: '/profile', label: 'Profile', icon: User },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 border-r bg-card p-4 gap-2 fixed h-full z-20">
        <div className="flex items-center gap-2 px-3 py-4 mb-4">
          <div className="w-9 h-9 rounded-xl finance-gradient flex items-center justify-center">
            <Wallet className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold text-foreground">FinWise</span>
        </div>
        <nav className="flex flex-col gap-1 flex-1">
          {navItems.map(item => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                )}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 lg:ml-64 pb-20 lg:pb-6">
        <div className="max-w-5xl mx-auto p-4 lg:p-6">
          {children}
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t z-30 bottom-nav-safe">
        <div className="flex items-center justify-around py-2">
          {navItems.slice(0, 5).map(item => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors min-w-[48px]',
                  active ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
