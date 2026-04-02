import { useState, useMemo } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { formatCurrency } from '@/lib/finance-store';
import { Plus, Search, Trash2, Edit2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function Transactions() {
  const { transactions, categories, profile, addTransaction, updateTransaction, deleteTransaction } = useFinance();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [formAmount, setFormAmount] = useState('');
  const [formType, setFormType] = useState<'income' | 'expense'>('expense');
  const [formCategory, setFormCategory] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formPayment, setFormPayment] = useState('Cash');

  const filtered = useMemo(() => {
    return transactions
      .filter(t => {
        if (filterType !== 'all' && t.type !== filterType) return false;
        if (filterCategory !== 'all' && t.category !== filterCategory) return false;
        if (search && !t.description.toLowerCase().includes(search.toLowerCase()) && !t.category.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, filterType, filterCategory, search]);

  const openNew = () => {
    setEditingId(null);
    setFormAmount('');
    setFormType('expense');
    setFormCategory(categories[0]?.name || '');
    setFormDescription('');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormPayment('Cash');
    setShowForm(true);
  };

  const openEdit = (id: string) => {
    const t = transactions.find(x => x.id === id);
    if (!t) return;
    setEditingId(id);
    setFormAmount(t.amount.toString());
    setFormType(t.type);
    setFormCategory(t.category);
    setFormDescription(t.description);
    setFormDate(t.date);
    setFormPayment(t.paymentMethod);
    setShowForm(true);
  };

  const handleSubmit = () => {
    const amount = parseFloat(formAmount);
    if (!amount || !formCategory) return;
    const data = {
      amount, type: formType, category: formCategory,
      description: formDescription, date: formDate, paymentMethod: formPayment,
    };
    if (editingId) updateTransaction({ ...data, id: editingId });
    else addTransaction(data);
    setShowForm(false);
  };

  const categoryNames = [...new Set(categories.map(c => c.name))];

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Transactions</h1>
          <p className="text-muted-foreground text-sm">{filtered.length} transactions</p>
        </div>
        <Button onClick={openNew} size="sm" className="gap-1.5">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Add</span>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterType} onValueChange={v => setFilterType(v as typeof filterType)}>
          <SelectTrigger className="w-full sm:w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="income">Income</SelectItem>
            <SelectItem value="expense">Expense</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categoryNames.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Transaction List */}
      <div className="space-y-2">
        {filtered.map(t => {
          const cat = categories.find(c => c.name === t.category);
          return (
            <div key={t.id} className="finance-card p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center text-lg flex-shrink-0">
                {cat?.icon || '💰'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{t.description || t.category}</p>
                <p className="text-xs text-muted-foreground">{t.category} · {new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className={`text-sm font-semibold ${t.type === 'income' ? 'text-primary' : 'text-destructive'}`}>
                  {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount, profile.currency)}
                </p>
                <p className="text-xs text-muted-foreground">{t.paymentMethod}</p>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => openEdit(t.id)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => deleteTransaction(t.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-12">No transactions found</p>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Transaction' : 'Add Transaction'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button variant={formType === 'expense' ? 'default' : 'outline'} size="sm" onClick={() => setFormType('expense')} className="flex-1">Expense</Button>
              <Button variant={formType === 'income' ? 'default' : 'outline'} size="sm" onClick={() => setFormType('income')} className="flex-1">Income</Button>
            </div>
            <Input type="number" placeholder="Amount" value={formAmount} onChange={e => setFormAmount(e.target.value)} />
            <Select value={formCategory} onValueChange={setFormCategory}>
              <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                {categoryNames.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="Description" value={formDescription} onChange={e => setFormDescription(e.target.value)} />
            <Input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} />
            <Select value={formPayment} onValueChange={setFormPayment}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['Cash', 'Credit Card', 'Debit Card', 'Bank Transfer', 'PayPal', 'Auto Pay'].map(m => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleSubmit} className="w-full">{editingId ? 'Update' : 'Add Transaction'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
