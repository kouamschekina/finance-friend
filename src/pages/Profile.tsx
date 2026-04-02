import { useFinance } from '@/contexts/FinanceContext';
import { formatCurrency, getCurrentMonthTransactions } from '@/lib/finance-store';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, DollarSign, TrendingUp, PiggyBank } from 'lucide-react';
import { useMemo } from 'react';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'INR', 'BRL', 'NGN'];

export default function Profile() {
  const { profile, updateProfile, transactions } = useFinance();

  const current = useMemo(() => getCurrentMonthTransactions(transactions), [transactions]);
  const totalIncome = current.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpenses = current.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome * 100) : 0;
  const totalTransactions = transactions.length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Profile</h1>
        <p className="text-muted-foreground text-sm">Manage your preferences</p>
      </div>

      {/* User card */}
      <div className="finance-card p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl finance-gradient flex items-center justify-center">
            <User className="w-8 h-8 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">{profile.name || 'Your Name'}</h2>
            <p className="text-sm text-muted-foreground">Personal Finance Dashboard</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 p-4 bg-secondary/50 rounded-xl">
          <div className="text-center">
            <p className="stat-value text-foreground">{totalTransactions}</p>
            <p className="stat-label">Transactions</p>
          </div>
          <div className="text-center">
            <p className="stat-value text-primary">{savingsRate.toFixed(0)}%</p>
            <p className="stat-label">Savings Rate</p>
          </div>
          <div className="text-center">
            <p className="stat-value text-foreground">{formatCurrency(totalIncome - totalExpenses, profile.currency)}</p>
            <p className="stat-label">Net This Month</p>
          </div>
        </div>
      </div>

      {/* Settings */}
      <div className="finance-card p-4 space-y-4">
        <h3 className="font-semibold text-foreground">Settings</h3>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Name</label>
            <Input value={profile.name} onChange={e => updateProfile({ name: e.target.value })} placeholder="Your name" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Currency</label>
            <Select value={profile.currency} onValueChange={v => updateProfile({ currency: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Monthly Income</label>
            <Input type="number" value={profile.monthlyIncome} onChange={e => updateProfile({ monthlyIncome: parseFloat(e.target.value) || 0 })} />
          </div>
        </div>
      </div>
    </div>
  );
}
