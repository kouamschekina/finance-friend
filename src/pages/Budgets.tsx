import { useState } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { formatCurrency, getCategorySpending } from '@/lib/finance-store';
import { getCategoryIcon } from '@/lib/icons';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function Budgets() {
  const { categories, transactions, profile, addCategory, updateCategory, deleteCategory } = useFinance();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formBudget, setFormBudget] = useState('');

  const openNew = () => {
    setEditingId(null); setFormName(''); setFormBudget('');
    setShowForm(true);
  };

  const openEdit = (id: string) => {
    const c = categories.find(x => x.id === id);
    if (!c) return;
    setEditingId(id); setFormName(c.name); setFormBudget(c.budgetLimit.toString());
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (!formName.trim()) return;
    const data = { name: formName.trim(), icon: '', color: 'hsl(210,90%,56%)', budgetLimit: parseFloat(formBudget) || 0 };
    if (editingId) {
      const existing = categories.find(c => c.id === editingId);
      updateCategory({ ...data, id: editingId, icon: existing?.icon || '', color: existing?.color || data.color });
    } else addCategory(data);
    setShowForm(false);
  };

  const budgetCategories = categories.filter(c => c.budgetLimit > 0);
  const otherCategories = categories.filter(c => c.budgetLimit <= 0);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="hidden lg:block">
          <h1 className="text-2xl font-bold text-foreground">Budgets</h1>
          <p className="text-muted-foreground text-sm">Track your spending limits</p>
        </div>
        <Button onClick={openNew} size="sm" className="gap-1.5 rounded-xl ml-auto">
          <Plus className="w-4 h-4" /> Add
        </Button>
      </div>

      {budgetCategories.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">With Budget Limits</h2>
          {budgetCategories.map(cat => {
            const CatIcon = getCategoryIcon(cat.name);
            const spent = getCategorySpending(transactions, cat.name);
            const pct = Math.min((spent / cat.budgetLimit) * 100, 100);
            const overBudget = spent > cat.budgetLimit;
            const warning = pct >= 80 && !overBudget;

            return (
              <div key={cat.id} className="finance-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: cat.color + '18' }}>
                      <CatIcon className="w-5 h-5" style={{ color: cat.color }} />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground text-sm">{cat.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatCurrency(spent, profile.currency)} / {formatCurrency(cat.budgetLimit, profile.currency)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {overBudget && <span className="text-[10px] font-bold text-destructive bg-destructive/10 px-2 py-1 rounded-full">Over!</span>}
                    {warning && <span className="text-[10px] font-bold text-warning bg-warning/10 px-2 py-1 rounded-full">{pct.toFixed(0)}%</span>}
                    <button onClick={() => openEdit(cat.id)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground active:scale-95"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => deleteCategory(cat.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive active:scale-95"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                <div className="progress-bar">
                  <div className={`progress-bar-fill ${overBudget ? 'bg-destructive' : warning ? 'bg-warning' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5 text-right font-medium">
                  {formatCurrency(Math.max(cat.budgetLimit - spent, 0), profile.currency)} remaining
                </p>
              </div>
            );
          })}
        </div>
      )}

      {otherCategories.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Other Categories</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {otherCategories.map(cat => {
              const CatIcon = getCategoryIcon(cat.name);
              return (
                <div key={cat.id} className="finance-card p-3 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: cat.color + '18' }}>
                    <CatIcon className="w-4 h-4" style={{ color: cat.color }} />
                  </div>
                  <span className="text-sm font-medium text-foreground truncate flex-1">{cat.name}</span>
                  <button onClick={() => openEdit(cat.id)} className="p-1 rounded hover:bg-secondary text-muted-foreground"><Edit2 className="w-3 h-3" /></button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-md rounded-2xl border-border/50">
          <DialogHeader><DialogTitle>{editingId ? 'Edit Category' : 'New Category'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Category name" value={formName} onChange={e => setFormName(e.target.value)} className="rounded-xl" />
            <Input type="number" placeholder="Monthly budget limit (0 = no limit)" value={formBudget} onChange={e => setFormBudget(e.target.value)} className="rounded-xl" />
            <Button onClick={handleSubmit} className="w-full rounded-xl">{editingId ? 'Update' : 'Create Category'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
