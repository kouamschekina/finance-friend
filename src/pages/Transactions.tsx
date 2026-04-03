import { useState, useMemo } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { useUI } from '@/contexts/UIContext';
import { formatCurrency, getFilteredTransactions } from '@/lib/finance-store';
import { getCategoryIcon } from '@/lib/icons';
import { Plus, Search, Trash2, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DateRangePicker } from '@/components/DateRangePicker';

export default function Transactions() {
  const { transactions, categories, profile, dateRange, deleteTransaction } = useFinance();
  const { openTransactionDrawer } = useUI();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const rangeFiltered = getFilteredTransactions(transactions, dateRange.from, dateRange.to);
    return rangeFiltered
      .filter(t => {
        if (filterType !== 'all' && t.type !== filterType) return false;
        if (filterCategory !== 'all' && t.category !== filterCategory) return false;
        if (search && !t.description.toLowerCase().includes(search.toLowerCase()) && !t.category.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, filterType, filterCategory, search, dateRange]);

  const categoryNames = [...new Set(categories.map(c => c.name))];

  return (
    <div className="space-y-5 sm:space-y-6 min-w-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Transactions</h1>
          <p className="text-muted-foreground text-sm font-medium">{filtered.length} shown</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <DateRangePicker className="flex-1 sm:flex-none" />
          <Button
            onClick={() => openTransactionDrawer()}
            size="sm"
            className="gap-1.5 rounded-2xl h-10 px-5 finance-gradient shadow-lg shadow-primary/20 border-0 shrink-0"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline font-semibold">Add</span>
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <Input
            placeholder="Search records..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-11 h-12 rounded-2xl bg-secondary/30 border-0 focus-visible:ring-2 focus-visible:ring-primary/20 font-medium"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 min-w-0 w-full md:w-auto md:flex-none">
          <Select value={filterType} onValueChange={v => setFilterType(v as typeof filterType)}>
            <SelectTrigger className="w-full md:w-40 h-12 rounded-2xl bg-secondary/30 border-0 font-semibold min-w-0"><SelectValue /></SelectTrigger>
            <SelectContent className="rounded-2xl border-border/40">
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="expense">Expense</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-full md:min-w-[200px] h-12 rounded-2xl bg-secondary/30 border-0 font-semibold min-w-0"><SelectValue /></SelectTrigger>
            <SelectContent className="rounded-2xl border-border/40">
              <SelectItem value="all">All Categories</SelectItem>
              {categoryNames.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Transaction List */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout" initial={false}>
          {filtered.map((t, idx) => {
            const CatIcon = getCategoryIcon(t.category);
            const cat = categories.find(c => c.name === t.category);
            const isIncome = t.type === 'income';

            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, delay: idx * 0.03 }}
              >
                <Collapsible
                  open={expandedId === t.id}
                  onOpenChange={(open) => setExpandedId(open ? t.id : null)}
                >
                  <div className="finance-card overflow-hidden bg-card/40 backdrop-blur-sm hover:bg-card/60">
                    <div className="grid grid-cols-[44px_1fr_auto_auto] items-center gap-3 p-3 sm:p-3.5">
                      <CollapsibleTrigger asChild>
                        <div className="contents">
                          <div
                            className="h-11 w-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: (cat?.color || 'hsl(210,90%,56%)') + '25' }}
                          >
                            <CatIcon
                              className="w-5 h-5"
                              style={{ color: cat?.color || 'hsl(210,90%,56%)' }}
                            />
                          </div>

                          <div className="min-w-0 cursor-pointer">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-bold text-foreground truncate">
                                {t.description || t.category}
                              </p>
                            </div>

                            <div className="mt-0.5 flex items-center gap-2 min-w-0">
                              <p className="text-[11px] font-medium text-muted-foreground/80 truncate">
                                {t.category}
                              </p>
                              <span className="w-1 h-1 rounded-full bg-border flex-shrink-0" />
                              <p className="text-[11px] font-medium text-muted-foreground/60 truncate">
                                {new Date(t.date).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </p>
                            </div>
                          </div>
                        </div>
                      </CollapsibleTrigger>

                      <div className="shrink-0 flex flex-col items-end leading-none">
                        <p
                          className={cn(
                            "text-sm sm:text-base font-bold tabular-nums tracking-tight text-right",
                            isIncome ? "text-primary" : "text-destructive",
                          )}
                        >
                          {isIncome ? '+' : '-'}
                          {formatCurrency(t.amount, profile.currency)}
                        </p>
                        <p className="mt-1 text-[11px] font-medium text-muted-foreground/70 text-right">
                          {t.payment_method}
                        </p>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openTransactionDrawer(t.id);
                          }}
                          className="p-1.5 rounded-xl text-muted-foreground/70 hover:text-foreground transition-all active:scale-90"
                          aria-label="Edit transaction"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteTransaction(t.id);
                          }}
                          className="p-1.5 rounded-xl text-muted-foreground/70 hover:text-destructive transition-all active:scale-90"
                          aria-label="Delete transaction"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <CollapsibleContent>
                      <div className="border-t border-border/40 px-4 pb-4 pt-3">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                          <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                              Category
                            </p>
                            <p className="text-sm font-bold text-foreground break-words whitespace-normal leading-tight">
                              {t.category}
                            </p>
                          </div>
                          <div className="min-w-0 text-right">
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                              Date
                            </p>
                            <p className="text-sm font-semibold text-foreground break-words whitespace-normal leading-tight">
                              {new Date(t.date).toLocaleDateString('en-US', {
                                month: 'long',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </p>
                          </div>

                          <div className="min-w-0 col-span-2">
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                              Description
                            </p>
                            <p className="text-sm font-medium text-foreground break-words whitespace-normal leading-tight">
                              {t.description || '—'}
                            </p>
                          </div>

                          <div className="min-w-0 col-span-2">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                                  Payment
                                </p>
                                <p className="text-sm font-bold text-foreground">{t.payment_method}</p>
                              </div>
                              <div className={cn('text-right', isIncome ? 'text-primary' : 'text-destructive')}>
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                                  Amount
                                </p>
                                <p className="text-sm font-bold tabular-nums">
                                  {isIncome ? '+' : '-'}
                                  {formatCurrency(t.amount, profile.currency)}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {filtered.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="w-20 h-20 rounded-3xl bg-secondary/20 flex items-center justify-center mb-4">
              <Search className="w-8 h-8 text-muted-foreground/30" />
            </div>
            <h3 className="text-lg font-bold text-foreground">No transactions found</h3>
            <p className="text-sm text-muted-foreground max-w-[240px]">Try adjusting your filters or search terms to find what you're looking for.</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
