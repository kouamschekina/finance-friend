import { useMemo, useState } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  formatCurrency, getCategorySpending, getFilteredTransactions,
} from '@/lib/finance-store';
import { getCategoryIcon } from '@/lib/icons';
import { TrendingUp, TrendingDown, DollarSign, PiggyBank, Lightbulb } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { DateRangePicker } from '@/components/DateRangePicker';
import { subDays, parseISO, differenceInDays, format } from 'date-fns';
import { useTranslation } from 'react-i18next';

const CHART_COLORS = ['hsl(160,84%,39%)', 'hsl(210,90%,56%)', 'hsl(38,92%,50%)', 'hsl(340,82%,52%)', 'hsl(280,70%,55%)', 'hsl(25,95%,53%)', 'hsl(0,72%,51%)', 'hsl(220,60%,50%)'];

function chartTooltipStyle(light: boolean) {
  return light
    ? {
      backgroundColor: 'hsl(0 0% 100%)',
      border: '1px solid hsl(214 20% 88%)',
      borderRadius: '12px',
      padding: '8px 12px',
      color: 'hsl(222 38% 14%)',
      fontSize: '12px',
    }
    : {
      backgroundColor: 'hsl(222 44% 14%)',
      border: '1px solid hsl(222 26% 20%)',
      borderRadius: '12px',
      padding: '8px 12px',
      color: 'hsl(210 20% 95%)',
      fontSize: '12px',
    };
}

export default function Dashboard() {
  const { transactions, categories, profile, dateRange } = useFinance();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const tooltipStyle = chartTooltipStyle(theme === 'light');
  const axisColor = theme === 'light' ? 'hsl(220 12% 40%)' : 'hsl(215 15% 55%)';
  const gridColor = theme === 'light' ? 'hsl(214 20% 90%)' : 'hsl(222 26% 18%)';

  const current = useMemo(() =>
    getFilteredTransactions(transactions, dateRange.from, dateRange.to),
    [transactions, dateRange]);

  const previous = useMemo(() => {
    const from = parseISO(dateRange.from);
    const to = parseISO(dateRange.to);
    const days = differenceInDays(to, from) + 1;
    const prevTo = subDays(from, 1);
    const prevFrom = subDays(prevTo, days - 1);

    return getFilteredTransactions(
      transactions,
      format(prevFrom, 'yyyy-MM-dd'),
      format(prevTo, 'yyyy-MM-dd')
    );
  }, [transactions, dateRange]);

  const totalIncome = current.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpenses = current.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const netBalance = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome * 100) : 0;

  const prevIncome = previous.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const prevExpenses = previous.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const prevBalance = prevIncome - prevExpenses;
  const prevSavingsRate = prevIncome > 0 ? ((prevIncome - prevExpenses) / prevIncome * 100) : 0;

  const incomeChange = prevIncome > 0 ? ((totalIncome - prevIncome) / prevIncome * 100) : 0;
  const expenseChange = prevExpenses > 0 ? ((totalExpenses - prevExpenses) / prevExpenses * 100) : 0;
  const balanceChange = prevBalance !== 0 ? ((netBalance - prevBalance) / Math.abs(prevBalance) * 100) : 0;
  const savingsChange = prevSavingsRate > 0 ? ((savingsRate - prevSavingsRate) / prevSavingsRate * 100) : 0;

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
    // Use last 4 months for comparison context in bar chart (can stay current-based or interval-based)
    // To keep it simple, let's keep the last 4 months context
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
        date: format(parseISO(date), 'MMM dd'),
        amount,
      }));
  }, [current]);

  const insights = useMemo(() => {
    const result: { text: string; type: 'success' | 'warning' | 'info' }[] = [];
    if (expenseChange > 10) result.push({ text: t('dashboard.insight_spending_up', { pct: Math.abs(expenseChange).toFixed(0) }), type: 'warning' });
    else if (expenseChange < -5) result.push({ text: t('dashboard.insight_spending_down', { pct: Math.abs(expenseChange).toFixed(0) }), type: 'success' });

    if (savingsRate > 20) result.push({ text: t('dashboard.insight_savings_excellent', { pct: savingsRate.toFixed(0) }), type: 'success' });
    else if (savingsRate < 10 && savingsRate >= 0) result.push({ text: t('dashboard.insight_savings_low', { pct: savingsRate.toFixed(0) }), type: 'info' });

    const topCategory = pieData[0];
    if (topCategory) result.push({ text: t('dashboard.insight_top_category', { name: topCategory.name, amount: formatCurrency(topCategory.value, profile.currency) }), type: 'info' });

    categories.filter(c => c.budget_limit > 0).forEach(c => {
      const spent = getCategorySpending(transactions, c.name, dateRange);
      const pct = (spent / c.budget_limit) * 100;
      if (pct >= 100) result.push({ text: t('dashboard.insight_budget_exceeded', { name: c.name }), type: 'warning' });
      else if (pct >= 80) result.push({ text: t('dashboard.insight_budget_warning', { name: c.name, pct: pct.toFixed(0) }), type: 'warning' });
    });
    return result.length ? result : [{ text: t('dashboard.insight_healthy'), type: 'success' as const }];
  }, [expenseChange, savingsRate, pieData, categories, transactions, profile.currency, dateRange]);

  const currency = profile.currency;

  return (
    <div className="space-y-6 pb-8 sm:space-y-8 sm:pb-10">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
            {t('dashboard.title')}
          </h1>
          <p className="text-muted-foreground text-sm font-medium">{t('dashboard.subtitle')}</p>
        </div>
        <div data-tour="date-picker">
          <DateRangePicker />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
        <StatCard
          icon={DollarSign}
          label={t('dashboard.income')}
          value={formatCurrency(totalIncome, currency)}
          variant="primary"
          badge={`${incomeChange > 0 ? '+' : ''}${incomeChange.toFixed(0)}%`}
          badgePositive={incomeChange >= 0}
        />
        <StatCard
          icon={TrendingDown}
          label={t('dashboard.expenses')}
          value={formatCurrency(totalExpenses, currency)}
          variant="destructive"
          badge={`${expenseChange > 0 ? '+' : ''}${expenseChange.toFixed(0)}%`}
          badgePositive={expenseChange <= 0}
        />
        <StatCard
          icon={TrendingUp}
          label={t('dashboard.balance')}
          value={formatCurrency(netBalance, currency)}
          variant={netBalance >= 0 ? 'primary' : 'destructive'}
          badge={`${balanceChange > 0 ? '+' : ''}${balanceChange.toFixed(0)}%`}
          badgePositive={balanceChange >= 0}
        />
        <StatCard
          icon={PiggyBank}
          label={t('profile.savings')}
          value={`${savingsRate.toFixed(0)}%`}
          variant="accent"
          badge={`${savingsChange > 0 ? '+' : ''}${savingsChange.toFixed(0)}%`}
          badgePositive={savingsChange >= 0}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4">
        <div className="finance-card p-4 sm:p-5 min-w-0" data-tour="monthly-summary">
          <h3 className="font-semibold text-foreground text-sm mb-3">{t('dashboard.spending_by_category')}</h3>
          {pieData.length > 0 ? (
            <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center">
              <div className="mx-auto w-full max-w-[200px] h-[180px] sm:mx-0 sm:w-1/2 sm:max-w-none shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={44} outerRadius={72} dataKey="value" paddingAngle={3} strokeWidth={0}>
                      {pieData.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={CHART_COLORS[i % CHART_COLORS.length]}
                          onClick={() => setActiveCategory(activeCategory === entry.name ? null : entry.name)}
                          style={{ cursor: 'pointer', outline: 'none' }}
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v, currency)} contentStyle={tooltipStyle} itemStyle={{ color: 'hsl(160,84%,39%)' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2 min-w-0 w-full">
                {pieData.slice(0, 5).map((entry, i) => {
                  const Icon = getCategoryIcon(entry.name);
                  const isActive = activeCategory === entry.name;
                  return (
                    <div key={entry.name} className="flex items-center gap-2 text-xs">
                      <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] + '20' }}>
                        <Icon className="w-3 h-3" style={{ color: CHART_COLORS[i % CHART_COLORS.length] }} />
                      </div>
                      <span className={cn("truncate flex-1 transition-colors", isActive ? "font-semibold" : "text-muted-foreground")} style={{ color: isActive ? CHART_COLORS[0] : undefined }}>{entry.name}</span>
                      <span className={cn("font-semibold transition-colors", isActive ? "" : "text-foreground")} style={{ color: isActive ? CHART_COLORS[0] : undefined }}>{formatCurrency(entry.value, currency)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm py-8 text-center">{t('dashboard.no_expenses_month')}</p>
          )}
        </div>

        <div className="finance-card p-4 sm:p-5 min-w-0 overflow-hidden">
          <h3 className="font-semibold text-foreground text-sm mb-3">{t('dashboard.income_vs_expenses')}</h3>
          <div className="h-[200px] w-full min-w-0 sm:h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} barGap={4} margin={{ left: -8, right: 4 }}>
                <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} stroke={axisColor} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `${profile.currency}${v >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : v}`} stroke={axisColor} width={44} />
                <Tooltip formatter={(v: number) => formatCurrency(v, currency)} contentStyle={tooltipStyle} />
                <Bar dataKey="income" fill="hsl(160,84%,39%)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="expenses" fill="hsl(0,72%,51%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="finance-card p-4 sm:p-5 lg:col-span-2 min-w-0 overflow-hidden">
          <h3 className="font-semibold text-foreground text-sm mb-3">{t('dashboard.daily_spending')}</h3>
          {lineData.length > 0 ? (
            <div className="h-[200px] w-full min-w-0 sm:h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineData} margin={{ left: -8, right: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis dataKey="date" fontSize={11} tickLine={false} axisLine={false} stroke={axisColor} />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} stroke={axisColor} width={44} />
                  <Tooltip formatter={(v: number) => formatCurrency(v, currency)} contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="amount" stroke="hsl(160,84%,39%)" strokeWidth={2.5} dot={{ r: 3, fill: 'hsl(160,84%,39%)', strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm py-8 text-center">{t('dashboard.no_data_yet')}</p>
          )}
        </div>
      </div>

      {/* Smart Insights */}
      <div className="finance-card p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-warning/15 flex items-center justify-center">
            <Lightbulb className="w-4 h-4 text-warning" />
          </div>
          <h3 className="font-semibold text-foreground text-sm">{t('dashboard.smart_insights')}</h3>
        </div>
        <div className="space-y-2">
          {insights.map((insight, i) => (
            <div key={i} className={`flex items-start gap-2 text-sm p-2.5 rounded-xl ${insight.type === 'success' ? 'bg-primary/8 text-primary' :
              insight.type === 'warning' ? 'bg-warning/8 text-warning' :
                'bg-info/8 text-info'
              }`}>
              <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${insight.type === 'success' ? 'bg-primary' :
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

function StatCard({ icon: Icon, label, value, variant, badge, badgePositive, trend }: {
  icon: React.ElementType; label: string; value: string;
  variant: 'primary' | 'destructive' | 'accent';
  badge?: string; badgePositive?: boolean; trend?: string;
}) {
  const styles = {
    primary: {
      bg: 'bg-primary/10',
      text: 'text-primary',
      glow: 'shadow-primary/5',
      gradient: 'from-primary/10 to-transparent'
    },
    destructive: {
      bg: 'bg-destructive/10',
      text: 'text-destructive',
      glow: 'shadow-destructive/5',
      gradient: 'from-destructive/10 to-transparent'
    },
    accent: {
      bg: 'bg-accent/10',
      text: 'text-accent',
      glow: 'shadow-accent/5',
      gradient: 'from-accent/10 to-transparent'
    },
  }[variant];

  return (
    <motion.div
      whileHover={{ y: -3 }}
      className="finance-card p-3.5 sm:p-5 space-y-3 sm:space-y-4 group overflow-hidden relative min-h-[128px] sm:min-h-[152px]"
    >
      <div className={`absolute top-0 right-0 w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br ${styles.gradient} blur-2xl opacity-50 -mr-8 -mt-8`} />

      <div className="flex items-center justify-between relative z-10">
        <div className={cn("w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:scale-110", styles.bg)}>
          <Icon className={cn("w-4 h-4 sm:w-6 sm:h-6", styles.text)} />
        </div>
        {(badge || trend) && (
          <div className={cn(
            "flex items-center gap-1 px-2 py-1 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-tight",
            badgePositive !== false ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
          )}>
            {badgePositive !== false ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {badge || trend}
          </div>
        )}
      </div>
      <div className="relative z-10">
        <p className="text-[9px] sm:text-[11px] font-black uppercase tracking-[0.12em] sm:tracking-[0.15em] text-muted-foreground/70 mb-0.5 line-clamp-1">
          {label}
        </p>
        <p className="text-lg sm:text-2xl font-black text-foreground tracking-tight tabular-nums break-words">
          {value}
        </p>
      </div>
    </motion.div>
  );
}
