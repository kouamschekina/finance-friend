import { useState, useEffect } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { useUI } from '@/contexts/UIContext';
import { useLocale } from '@/contexts/LocaleContext';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AmountInput } from './AmountInput';
import { CategoryGrid } from './CategoryGrid';
import { PaymentMethodChips } from './PaymentMethodChips';
import { cn } from '@/lib/utils';
import { X, Calendar, AlignLeft } from 'lucide-react';

function parseAmountOk(raw: string): boolean {
  const n = parseFloat(raw);
  return Number.isFinite(n) && n > 0;
}

export function TransactionDrawer() {
  const { isTransactionDrawerOpen, closeTransactionDrawer, editingTransactionId } = useUI();
  const { transactions, categories, addTransaction, updateTransaction, profile } = useFinance();
  const { t } = useLocale();

  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [payment_method, setPaymentMethod] = useState('Cash');
  const [goal_id, setGoalId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!isTransactionDrawerOpen) return;
    if (editingTransactionId) {
      const tr = transactions.find((x) => x.id === editingTransactionId);
      if (tr) {
        setAmount(tr.amount.toString());
        setType(tr.type);
        setCategory(tr.category);
        setDescription(tr.description);
        setDate(tr.date);
        setPaymentMethod(tr.payment_method);
        setGoalId(tr.goal_id);
      }
    } else {
      setAmount('');
      setType('expense');
      setCategory(categories[0]?.name || '');
      setDescription('');
      setDate(new Date().toISOString().split('T')[0]);
      setPaymentMethod('Cash');
      setGoalId(undefined);
    }
  }, [editingTransactionId, transactions, isTransactionDrawerOpen, categories]);

  const { goals } = useFinance();

  const handleSubmit = () => {
    const numAmount = parseFloat(amount);
    if (!parseAmountOk(amount) || !category) return;

    const data = {
      amount: numAmount,
      type,
      category,
      description,
      date,
      payment_method: payment_method,
      goal_id: type === 'expense' ? goal_id : undefined,
    };

    if (editingTransactionId) {
      updateTransaction({ ...data, id: editingTransactionId });
    } else {
      addTransaction(data);
    }
    closeTransactionDrawer();
  };

  const filteredCategories = categories.filter((c) =>
    type === 'expense' ? c.name !== 'Salary' : true,
  );

  const canSave = parseAmountOk(amount) && Boolean(category);

  return (
    <Drawer open={isTransactionDrawerOpen} onOpenChange={(open) => !open && closeTransactionDrawer()}>
      <DrawerContent className="max-h-[96dvh] rounded-t-[24px] border-t border-border/50 p-0 overflow-hidden bg-background">
        <div className="mx-auto mt-2 mb-1 h-1 w-10 rounded-full bg-muted-foreground/25" />

        <div className="max-h-[inherit] overflow-y-auto px-5 pb-8 pt-1 no-scrollbar">
          <DrawerHeader className="space-y-4 px-0 pb-4 pt-0">
            <div className="flex items-start justify-between gap-3">
              <DrawerTitle className="text-lg font-bold tracking-tight pr-2">
                {editingTransactionId ? t('transaction.edit') : t('transaction.new')}
              </DrawerTitle>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={closeTransactionDrawer}
                className="h-10 w-10 shrink-0 rounded-full"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div
              className="grid grid-cols-2 gap-1 rounded-2xl bg-muted/40 p-1"
              role="tablist"
              aria-label="Transaction type"
            >
              {(['expense', 'income'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={type === tab}
                  onClick={() => setType(tab)}
                  className={cn(
                    'relative rounded-xl py-2.5 text-sm font-semibold transition-colors',
                    type === tab
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {tab === 'expense' ? t('transaction.expense') : t('transaction.income')}
                </button>
              ))}
            </div>

            <AmountInput value={amount} onChange={setAmount} currency={profile.currency} />
          </DrawerHeader>

          <div className="space-y-8">
            <section>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('transaction.category')}
              </h3>
              <CategoryGrid
                categories={filteredCategories}
                onSelect={setCategory}
                selected={category}
                type={type}
              />
            </section>

            {type === 'expense' && goals.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Link to Savings Goal
                </h3>
                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                  <button
                    type="button"
                    onClick={() => setGoalId(undefined)}
                    className={cn(
                      'flex shrink-0 flex-col items-center gap-1.5 rounded-xl border px-4 py-2 text-center transition-all',
                      !goal_id
                        ? 'border-primary bg-primary/10 text-primary font-bold shadow-sm'
                        : 'border-border/50 bg-secondary/25 text-muted-foreground hover:bg-secondary/40',
                    )}
                  >
                    <span className="text-[10px]">None</span>
                  </button>
                  {goals.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setGoalId(g.id)}
                      className={cn(
                        'flex shrink-0 flex-col items-center gap-1.5 rounded-xl border px-4 py-2 text-center transition-all min-w-[80px]',
                        goal_id === g.id
                          ? 'border-primary bg-primary/10 text-primary font-bold shadow-sm'
                          : 'border-border/50 bg-secondary/25 text-muted-foreground hover:bg-secondary/40',
                      )}
                    >
                      <span className="text-[10px] whitespace-nowrap">{g.name}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            <section className="space-y-4">
              <div className="relative">
                <AlignLeft className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Note (optional)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="h-12 rounded-2xl border-border/50 bg-secondary/25 pl-11 text-[15px] font-medium"
                />
              </div>

              <div className="relative">
                <Calendar className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-12 rounded-2xl border-border/50 bg-secondary/25 pl-11 text-sm font-medium"
                />
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Payment
                </p>
                <PaymentMethodChips value={payment_method} onChange={setPaymentMethod} />
              </div>
            </section>
          </div>

          <DrawerFooter className="px-0 pt-8">
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!canSave}
              className="h-14 w-full rounded-2xl text-base font-bold finance-gradient border-0 shadow-lg shadow-primary/20 disabled:opacity-50"
            >
              {t('transaction.save')}
            </Button>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
