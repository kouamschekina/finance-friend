import { useMemo, useState } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import {
  formatCurrency,
  getFilteredTransactions,
  type Transaction,
} from '@/lib/finance-store';
import { getCategoryIcon } from '@/lib/icons';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { DateRangePicker } from '@/components/DateRangePicker';
import { format } from 'date-fns';
import { generateFinancialReport } from '@/lib/pdf-report';
import { useTranslation } from 'react-i18next';

type CategoryRow = {
  name: string;
  spent: number;
  budget_limit: number;
  color: string;
};

function formatRange(from: string, to?: string) {
  const fromDate = new Date(from);
  if (!to) return format(fromDate, 'MMMM d, yyyy');
  const toDate = new Date(to);
  if (format(fromDate, 'MMM yyyy') === format(toDate, 'MMM yyyy')) {
    return `${format(fromDate, 'MMMM yyyy')}`;
  }
  return `${format(fromDate, 'MMM d')} - ${format(toDate, 'MMM d, yyyy')}`;
}

export default function Reports() {
  const { t } = useTranslation();
  const { transactions, categories, goals, profile, dateRange } = useFinance();
  const [isGenerating, setIsGenerating] = useState(false);

  const current = useMemo(() =>
    getFilteredTransactions(transactions, dateRange.from, dateRange.to),
    [transactions, dateRange]
  );

  const totals = useMemo(() => {
    const income = current.filter((x) => x.type === 'income').reduce((s, x) => s + x.amount, 0);
    const expenses = current.filter((x) => x.type === 'expense').reduce((s, x) => s + x.amount, 0);
    const net = income - expenses;
    const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0;
    return { income, expenses, net, savingsRate };
  }, [current]);

  const categoryRows = useMemo<CategoryRow[]>(() => {
    const spentByCategory = new Map<string, number>();
    current
      .filter((x) => x.type === 'expense')
      .forEach((x) => {
        spentByCategory.set(x.category, (spentByCategory.get(x.category) ?? 0) + x.amount);
      });

    const rows = categories
      .map((c) => {
        const spent = spentByCategory.get(c.name) ?? 0;
        return {
          name: c.name,
          spent,
          budget_limit: c.budget_limit ?? 0,
          color: c.color,
        };
      })
      .filter((r) => r.spent > 0)
      .sort((a, b) => b.spent - a.spent);

    return rows;
  }, [categories, current]);

  const topTransactions = useMemo<Transaction[]>(() => {
    return [...current]
      .filter((x) => x.type === 'expense')
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);
  }, [current]);

  const handleExportPdf = async () => {
    setIsGenerating(true);
    try {
      await generateFinancialReport({
        transactions,
        categories,
        goals,
        profile,
        dateRange,
      });
    } catch (error) {
      console.error('Failed to generate PDF:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between no-print">
        <div className="min-w-0">
          <h1 className="text-2xl font-black tracking-tight text-foreground leading-none mb-2">{t('reports.title')}</h1>
          <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] opacity-70">
            {t('reports.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <DateRangePicker />
          <Button
            type="button"
            onClick={handleExportPdf}
            disabled={isGenerating}
            className="rounded-2xl h-10 px-4 finance-gradient border-0 shadow-lg shadow-primary/20"
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            <span className="hidden sm:inline">{isGenerating ? t('common.loading') : t('reports.export_pdf')}</span>
            <span className="sm:hidden">{isGenerating ? '...' : t('reports.pdf')}</span>
          </Button>
        </div>
      </div>

      <div id="report-root" className="print-area">
        <div className="finance-card p-6 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl finance-gradient" />
                <div>
                  <p className="text-sm font-black tracking-tight text-foreground leading-none">
                    Fenowa
                  </p>
                  <p className="text-[11px] text-muted-foreground font-medium">
                    {t('reports.financial_report')}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <p className="text-sm font-semibold text-foreground">
                  {profile.name || 'User'}
                </p>
                <p className="text-[11px] text-muted-foreground font-medium">
                  {t('reports.currency_label')}: {profile.currency}
                </p>
              </div>
            </div>

            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
                {t('reports.period')}
              </p>
              <p className="text-sm font-semibold text-foreground">{formatRange(dateRange.from, dateRange.to)}</p>
              <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
                {t('reports.generated')}
              </p>
              <p className="text-sm font-semibold text-foreground">
                {new Date().toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-border/50 bg-secondary/20 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                {t('reports.income')}
              </p>
              <p className="mt-1 text-lg font-black text-primary tabular-nums">
                {formatCurrency(totals.income, profile.currency)}
              </p>
            </div>
            <div className="rounded-2xl border border-border/50 bg-secondary/20 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                {t('reports.expenses')}
              </p>
              <p className="mt-1 text-lg font-black text-destructive tabular-nums">
                {formatCurrency(totals.expenses, profile.currency)}
              </p>
            </div>
            <div className="rounded-2xl border border-border/50 bg-secondary/20 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                {t('reports.net')}
              </p>
              <p className="mt-1 text-lg font-black text-foreground tabular-nums">
                {formatCurrency(totals.net, profile.currency)}
              </p>
            </div>
            <div className="rounded-2xl border border-border/50 bg-secondary/20 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                {t('reports.savings_rate')}
              </p>
              <p className="mt-1 text-lg font-black text-foreground tabular-nums">
                {totals.savingsRate.toFixed(0)}%
              </p>
            </div>
          </div>

          <div className="mt-7 grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="rounded-2xl border border-border/50 bg-card/40 p-5">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-3">
                {t('reports.spending_by_category')}
              </p>

              <div className="space-y-2">
                {categoryRows.length === 0 && (
                  <p className="text-sm text-muted-foreground font-medium">{t('reports.no_expenses')}</p>
                )}

                {categoryRows.slice(0, 8).map((r) => {
                  const Icon = getCategoryIcon(r.name);
                  const pct = r.budget_limit > 0 ? Math.min(100, (r.spent / r.budget_limit) * 100) : 0;
                  return (
                    <div key={r.name} className="flex items-center gap-3">
                      <div
                        className="h-10 w-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: (r.color || 'hsl(210,90%,56%)') + '25' }}
                      >
                        <Icon className="h-5 w-5" style={{ color: r.color }} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-foreground truncate">{r.name}</p>
                          <p className="text-sm font-bold text-foreground tabular-nums">
                            {formatCurrency(r.spent, profile.currency)}
                          </p>
                        </div>
                        <div className="mt-1 h-2 w-full rounded-full bg-secondary/40 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${pct}%`,
                              background: `linear-gradient(135deg, ${r.color}, hsl(var(--finance-gradient-to)))`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-border/50 bg-card/40 p-5">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-3">
                {t('reports.largest_expenses')}
              </p>

              <div className="space-y-2">
                {topTransactions.length === 0 && (
                  <p className="text-sm text-muted-foreground font-medium">{t('reports.no_expenses')}</p>
                )}

                {topTransactions.map((x) => (
                  <div
                    key={x.id}
                    className="flex items-start justify-between gap-3 rounded-2xl border border-border/40 bg-secondary/15 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {x.description || x.category}
                      </p>
                      <p className="text-[11px] text-muted-foreground font-medium truncate">
                        {x.category} · {new Date(x.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-destructive tabular-nums">
                        -{formatCurrency(x.amount, profile.currency)}
                      </p>
                      <p className="text-[11px] text-muted-foreground font-medium">
                        {x.payment_method}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-7 flex items-center justify-between gap-3">
            <p className="text-[11px] text-muted-foreground font-medium">
              {t('reports.generated_by')}
            </p>
            <p className="text-[11px] text-muted-foreground font-medium">
              {t('reports.currency_label')} · {profile.currency}
            </p>
          </div>
        </div>
      </div>

      <div className="no-print text-[11px] text-muted-foreground font-medium">
        {t('reports.pdf_tip')}
      </div>
    </div>
  );
}
