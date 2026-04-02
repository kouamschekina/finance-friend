import { useMemo } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import {
  getCurrentMonthTransactions, getPreviousMonthTransactions,
  formatCurrency, getCategorySpending,
} from '@/lib/finance-store';
import { TrendingUp, TrendingDown, DollarSign, PiggyBank, ArrowUpRight, ArrowDownRight, Lightbulb } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';

const CHART_COLORS = ['hsl(160,84%,39%)', 'hsl(210,90%,56%)', 'hsl(38,92%,50%)', 'hsl(340,82%,52%)', 'hsl(280,70%,55%)', 'hsl(25,95%,53%)', 'hsl(0,72%,51%)', 'hsl(220,60%,50%)'];

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

  // Pie chart data
  const pieData = useMemo(() => {
    const byCategory: Record<string, number> = {};
    current.filter(t => t.type === 'expense').forEach(t => {
      byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
    });
    return Object.entries(byCategory)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [current]);

  // Bar chart: income vs expenses last 4 months
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

  // Daily spending trend
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

  // Smart insights
  const insights = useMemo(() => {
    const result: string[] = [];
    if (expenseChange > 10) result.push(`⚠️ Your spending is up ${Math.abs(expenseChange).toFixed(0)}% compared to last month.`);
    else if (expenseChange < -5) result.push(`🎉 Great job! You spent ${Math.abs(expenseChange).toFixed(0)}% less than last month.`);
    if (savingsRate > 20) result.push(`💪 Excellent savings rate of ${savingsRate.toFixed(0)}%! Keep it up.`);
    else if (savingsRate < 10 && savingsRate >= 0) result.push(`💡 Your savings rate is ${savingsRate.toFixed(0)}%. Try to aim for at least 20%.`);
    const topCategory = pieData[0];
    if (topCategory) result.push(`📊 ${topCategory.name} is your biggest expense at ${formatCurrency(topCategory.value, profile.currency)}.`);
    // Budget warnings
    categories.filter(c => c.budgetLimit > 0).forEach(c => {
      const spent = getCategorySpending(transactions, c.name);
      const pct = (spent / c.budgetLimit) * 100;
      if (pct >= 100) result.push(`🔴 You've exceeded your ${c.name} budget!`);
      else if (pct >= 80) result.push(`🟡 You're at ${pct.toFixed(0)}% of your ${c.name} budget.`);
    });
    return result.length ? result : ['✅ Your finances look healthy this month!'];
  }, [expenseChange, savingsRate, pieData, categories, transactions, profile.currency]);

  const currency = profile.currency;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Spending Distribution */}
        <div className="finance-card p-4">
          <h3 className="font-semibold text-foreground mb-3">Spending by Category</h3>
          {pieData.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={180}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" paddingAngle={2}>
                    {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v, currency)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5">
                {pieData.slice(0, 5).map((entry, i) => (
                  <div key={entry.name} className="flex items-center gap-2 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="text-muted-foreground truncate flex-1">{entry.name}</span>
                    <span className="font-medium text-foreground">{formatCurrency(entry.value, currency)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm py-8 text-center">No expenses this month</p>
          )}
        </div>

        {/* Income vs Expenses */}
        <div className="finance-card p-4">
          <h3 className="font-semibold text-foreground mb-3">Income vs Expenses</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={barData} barGap={4}>
              <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={v => `$${v / 1000}k`} />
              <Tooltip formatter={(v: number) => formatCurrency(v, currency)} />
              <Bar dataKey="income" fill="hsl(160,84%,39%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" fill="hsl(0,72%,51%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Spending Trend */}
        <div className="finance-card p-4 lg:col-span-2">
          <h3 className="font-semibold text-foreground mb-3">Daily Spending Trend</h3>
          {lineData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(150,10%,90%)" />
                <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v: number) => formatCurrency(v, currency)} />
                <Line type="monotone" dataKey="amount" stroke="hsl(160,84%,39%)" strokeWidth={2} dot={{ r: 3 }} />
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
          <Lightbulb className="w-5 h-5 text-warning" />
          <h3 className="font-semibold text-foreground">Smart Insights</h3>
        </div>
        <div className="space-y-2">
          {insights.map((insight, i) => (
            <p key={i} className="text-sm text-muted-foreground leading-relaxed">{insight}</p>
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
  const iconBg = {
    primary: 'bg-primary/10 text-primary',
    destructive: 'bg-destructive/10 text-destructive',
    accent: 'bg-accent/10 text-accent',
  }[variant];

  return (
    <div className="finance-card p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconBg}`}>
          <Icon className="w-4 h-4" />
        </div>
        {badge && (
          <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${badgePositive ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}>
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
