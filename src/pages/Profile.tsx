import { useFinance } from '@/contexts/FinanceContext';
import { formatCurrency, getCurrentMonthTransactions } from '@/lib/finance-store';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, BarChart3, PiggyBank, ArrowLeftRight } from 'lucide-react';
import { useMemo } from 'react';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'INR', 'BRL', 'NGN'];

export default function Profile() {
  const { profile, updateProfile, transactions } = useFinance();

  const current = useMemo(() => getCurrentMonthTransactions(transactions), [transactions]);
  const totalIncome = current.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpenses = current.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome * 100) : 0;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="hidden lg:block">
        <h1 className="text-2xl font-bold text-foreground">Profile</h1>
        <p className="text-muted-foreground text-sm">Manage your preferences</p>
      </div>

      <div className="finance-card p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl finance-gradient flex items-center justify-center shadow-lg" style={{ boxShadow: 'var(--shadow-glow)' }}>
            <User className="w-8 h-8 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">{profile.name || 'Your Name'}</h2>
            <p className="text-xs text-muted-foreground font-medium">Personal Finance Dashboard</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-secondary/50 rounded-xl p-3 text-center">
            <ArrowLeftRight className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
            <p className="stat-value text-foreground text-lg">{transactions.length}</p>
            <p className="stat-label text-[9px]">Transactions</p>
          </div>
          <div className="bg-primary/10 rounded-xl p-3 text-center">
            <PiggyBank className="w-4 h-4 mx-auto text-primary mb-1" />
            <p className="stat-value text-primary text-lg">{savingsRate.toFixed(0)}%</p>
            <p className="stat-label text-[9px]">Savings Rate</p>
          </div>
          <div className="bg-secondary/50 rounded-xl p-3 text-center">
            <BarChart3 className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
            <p className="stat-value text-foreground text-lg">{formatCurrency(totalIncome - totalExpenses, profile.currency)}</p>
            <p className="stat-label text-[9px]">Net Month</p>
          </div>
        </div>
      </div>

      <div className="finance-card p-4 space-y-4">
        <h3 className="font-semibold text-foreground text-sm">Settings</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Name</label>
            <Input value={profile.name} onChange={e => updateProfile({ name: e.target.value })} placeholder="Your name" className="rounded-xl" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Currency</label>
            <Select value={profile.currency} onValueChange={v => updateProfile({ currency: v })}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Monthly Income</label>
            <Input type="number" value={profile.monthlyIncome} onChange={e => updateProfile({ monthlyIncome: parseFloat(e.target.value) || 0 })} className="rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
