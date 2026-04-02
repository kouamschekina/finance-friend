import { useMemo } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import {
  getCurrentMonthTransactions, getPreviousMonthTransactions,
  formatCurrency, getCategorySpending,
} from '@/lib/finance-store';
import { getCategoryIcon } from '@/lib/icons';
import { TrendingUp, TrendingDown, DollarSign, PiggyBank, ArrowUpRight, ArrowDownRight, Lightbulb } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';

const CHART_COLORS = ['hsl(160,84%,39%)', 'hsl(210,90%,56%)', 'hsl(38,92%,50%)', 'hsl(340,82%,52%)', 'hsl(280,70%,55%)', 'hsl(25,95%,53%)', 'hsl(0,72%,51%)', 'hsl(220,60%,50%)'];

const CustomTooltipStyle = {
  backgroundColor: 'hsl(220, 15%, 13%)',
  border: '1px solid hsl(220, 12%, 18%)',
  borderRadius: '12px',
  padding: '8px 12px',
  color: 'hsl(210, 20%, 95%)',
  fontSize: '12px',
};

export default function Dashboard() {
  const { transactions, categories, profile } = useFinance();

  const current = useMemo(() => getCurrentMonthTransactions(transactions), [transactions]);
  const previous = useMemo(() => getPreviousMonthTransactions(transactions), [transactions]);

  const totalIncome = current.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpenses = current.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const netBalance = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome * 100) : 0;

  const prevExpenses = previous.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const expenseChange = prevExpenses > 0 ? ((totalExpenses - prevExpenses) / prevExpenses * 100) : 0;

  const pieData = useMemo(() => {
    const byCategory: Record<string, number> = {};
    current.filter(t => t.type === 'expense').forEach(t => {
      byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
    });
    return Object.entries(byCategory)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [current]);

  const barData = useMemo(() => {
    const months: { name: string; income: number; expenses: number }[] = [];
    const now = new Date();
    for (let i = 3; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const monthTx = transactions.filter(t => {
        const td = new Date(t.date);
        return td >= d && td <= end;
      });
      months.push({
        name: d.toLocaleDateString('en-US', { month: 'short' }),
        income: monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
        expenses: monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
      });
    }
    return months;
  }, [transactions]);

  const lineData = useMemo(() => {
    const dailyMap: Record<string, number> = {};
    current.filter(t => t.type === 'expense').forEach(t => {
      dailyMap[t.date] = (dailyMap[t.date] || 0) + t.amount;
    });
    return Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, amount]) => ({
        date: new Date(date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
        amount,
      }));
  }, [current]);

  const insights = useMemo(() => {
    const result: { text: string; type: 'success' | 'warning' | 'info' }[] = [];
    if (expenseChange > 10) result.push({ text: `Your spending is up ${Math.abs(expenseChange).toFixed(0)}% compared to last month.`, type: 'warning' });
    else if (expenseChange < -5) result.push({ text: `Great job! You spent ${Math.abs(expenseChange).toFixed(0)}% less than last month.`, type: 'success' });
    if (savingsRate > 20) result.push({ text: `Excellent savings rate of ${savingsRate.toFixed(0)}%! Keep it up.`, type: 'success' });
    else if (savingsRate < 10 && savingsRate >= 0) result.push({ text: `Your savings rate is ${savingsRate.toFixed(0)}%. Try to aim for at least 20%.`, type: 'info' });
    const topCategory = pieData[0];
    if (topCategory) result.push({ text: `${topCategory.name} is your biggest expense at ${formatCurrency(topCategory.value, profile.currency)}.`, type: 'info' });
    categories.filter(c => c.budgetLimit > 0).forEach(c => {
      const spent = getCategorySpending(transactions, c.name);
      const pct = (spent / c.budgetLimit) * 100;
      if (pct >= 100) result.push({ text: `You've exceeded your ${c.name} budget!`, type: 'warning' });
      else if (pct >= 80) result.push({ text: `You're at ${pct.toFixed(0)}% of your ${c.name} budget.`, type: 'warning' });
    });
    return result.length ? result : [{ text: 'Your finances look healthy this month!', type: 'success' as const }];
  }, [expenseChange, savingsRate, pieData, categories, transactions, profile.currency]);

  const currency = profile.currency;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="hidden lg:block">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Your financial overview</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={DollarSign} label="Income" value={formatCurrency(totalIncome, currency)} variant="primary" />
        <StatCard icon={TrendingDown} label="Expenses" value={formatCurrency(totalExpenses, currency)} variant="destructive"
          badge={expenseChange !== 0 ? `${expenseChange > 0 ? '+' : ''}${expenseChange.toFixed(0)}%` : undefined}
          badgePositive={expenseChange <= 0}
        />
        <StatCard icon={TrendingUp} label="Net Balance" value={formatCurrency(netBalance, currency)} variant={netBalance >= 0 ? 'primary' : 'destructive'} />
        <StatCard icon={PiggyBank} label="Savings Rate" value={`${savingsRate.toFixed(0)}%`} variant="accent" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="finance-card p-4">
          <h3 className="font-semibold text-foreground text-sm mb-3">Spending by Category</h3>
          {pieData.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={160}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={68} dataKey="value" paddingAngle={3} strokeWidth={0}>
                    {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v, currency)} contentStyle={CustomTooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {pieData.slice(0, 5).map((entry, i) => {
                  const Icon = getCategoryIcon(entry.name);
                  return (
                    <div key={entry.name} className="flex items-center gap-2 text-xs">
                      <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] + '20' }}>
                        <Icon className="w-3 h-3" style={{ color: CHART_COLORS[i % CHART_COLORS.length] }} />
                      </div>
                      <span className="text-muted-foreground truncate flex-1">{entry.name}</span>
                      <span className="font-semibold text-foreground">{formatCurrency(entry.value, currency)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm py-8 text-center">No expenses this month</p>
          )}
        </div>

        <div className="finance-card p-4">
          <h3 className="font-semibold text-foreground text-sm mb-3">Income vs Expenses</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={barData} barGap={4}>
              <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} stroke="hsl(215,12%,40%)" />
              <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `$${v / 1000}k`} stroke="hsl(215,12%,40%)" />
              <Tooltip formatter={(v: number) => formatCurrency(v, currency)} contentStyle={CustomTooltipStyle} />
              <Bar dataKey="income" fill="hsl(160,84%,39%)" radius={[6, 6, 0, 0]} />
              <Bar dataKey="expenses" fill="hsl(0,72%,51%)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="finance-card p-4 lg:col-span-2">
          <h3 className="font-semibold text-foreground text-sm mb-3">Daily Spending Trend</h3>
          {lineData.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,12%,14%)" />
                <XAxis dataKey="date" fontSize={11} tickLine={false} axisLine={false} stroke="hsl(215,12%,40%)" />
                <YAxis fontSize={11} tickLine={false} axisLine={false} stroke="hsl(215,12%,40%)" />
                <Tooltip formatter={(v: number) => formatCurrency(v, currency)} contentStyle={CustomTooltipStyle} />
                <Line type="monotone" dataKey="amount" stroke="hsl(160,84%,39%)" strokeWidth={2.5} dot={{ r: 3, fill: 'hsl(160,84%,39%)', strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-muted-foreground text-sm py-8 text-center">No data yet</p>
          )}
        </div>
      </div>

      {/* Smart Insights */}
      <div className="finance-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-warning/15 flex items-center justify-center">
            <Lightbulb className="w-4 h-4 text-warning" />
          </div>
          <h3 className="font-semibold text-foreground text-sm">Smart Insights</h3>
        </div>
        <div className="space-y-2">
          {insights.map((insight, i) => (
            <div key={i} className={`flex items-start gap-2 text-sm p-2.5 rounded-xl ${
              insight.type === 'success' ? 'bg-primary/8 text-primary' :
              insight.type === 'warning' ? 'bg-warning/8 text-warning' :
              'bg-info/8 text-info'
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                insight.type === 'success' ? 'bg-primary' :
                insight.type === 'warning' ? 'bg-warning' :
                'bg-info'
              }`} />
              <span className="leading-relaxed">{insight.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, variant, badge, badgePositive }: {
  icon: React.ElementType; label: string; value: string;
  variant: 'primary' | 'destructive' | 'accent';
  badge?: string; badgePositive?: boolean;
}) {
  const styles = {
    primary: { bg: 'bg-primary/10', text: 'text-primary' },
    destructive: { bg: 'bg-destructive/10', text: 'text-destructive' },
    accent: { bg: 'bg-accent/10', text: 'text-accent' },
  }[variant];

  return (
    <div className="finance-card p-3.5 space-y-2">
      <div className="flex items-center justify-between">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${styles.bg}`}>
          <Icon className={`w-4 h-4 ${styles.text}`} />
        </div>
        {badge && (
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${badgePositive ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}>
            {badgePositive ? <ArrowDownRight className="w-3 h-3 inline" /> : <ArrowUpRight className="w-3 h-3 inline" />}
            {badge}
          </span>
        )}
      </div>
      <div>
        <p className="stat-label">{label}</p>
        <p className="stat-value text-foreground">{value}</p>
      </div>
    </div>
  );
}
