import { useState } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { formatCurrency } from '@/lib/finance-store';
import { Plus, Edit2, Trash2, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function Goals() {
  const { goals, profile, addGoal, updateGoal, deleteGoal } = useFinance();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formTarget, setFormTarget] = useState('');
  const [formCurrent, setFormCurrent] = useState('');
  const [formDeadline, setFormDeadline] = useState('');
  const [formIcon, setFormIcon] = useState('🎯');

  const openNew = () => {
    setEditingId(null);
    setFormName(''); setFormTarget(''); setFormCurrent('0'); setFormDeadline(''); setFormIcon('🎯');
    setShowForm(true);
  };

  const openEdit = (id: string) => {
    const g = goals.find(x => x.id === id);
    if (!g) return;
    setEditingId(id);
    setFormName(g.name); setFormTarget(g.targetAmount.toString()); setFormCurrent(g.currentAmount.toString());
    setFormDeadline(g.deadline); setFormIcon(g.icon);
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (!formName.trim() || !formTarget) return;
    const data = {
      name: formName.trim(), targetAmount: parseFloat(formTarget), currentAmount: parseFloat(formCurrent) || 0,
      deadline: formDeadline, icon: formIcon,
    };
    if (editingId) updateGoal({ ...data, id: editingId });
    else addGoal(data);
    setShowForm(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Savings Goals</h1>
          <p className="text-muted-foreground text-sm">Track your financial goals</p>
        </div>
        <Button onClick={openNew} size="sm" className="gap-1.5">
          <Plus className="w-4 h-4" /> New Goal
        </Button>
      </div>

      {goals.length === 0 ? (
        <div className="finance-card p-12 text-center">
          <Target className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No goals yet. Create one to start tracking!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {goals.map(goal => {
            const pct = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
            const remaining = goal.targetAmount - goal.currentAmount;
            const daysLeft = goal.deadline ? Math.max(0, Math.ceil((new Date(goal.deadline).getTime() - Date.now()) / 86400000)) : null;
            const completed = pct >= 100;

            return (
              <div key={goal.id} className={`finance-card p-4 ${completed ? 'ring-2 ring-primary/30' : ''}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center text-2xl">
                      {goal.icon}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{goal.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(goal.currentAmount, profile.currency)} of {formatCurrency(goal.targetAmount, profile.currency)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(goal.id)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => deleteGoal(goal.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                <div className="progress-bar mb-2">
                  <div className={`progress-bar-fill ${completed ? 'bg-primary' : 'bg-info'}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{pct.toFixed(0)}% complete</span>
                  {completed ? (
                    <span className="text-primary font-medium">🎉 Goal reached!</span>
                  ) : (
                    <span>
                      {formatCurrency(remaining, profile.currency)} to go
                      {daysLeft !== null && ` · ${daysLeft} days left`}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Goal' : 'New Savings Goal'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Goal name" value={formName} onChange={e => setFormName(e.target.value)} />
            <Input placeholder="Emoji icon" value={formIcon} onChange={e => setFormIcon(e.target.value)} />
            <Input type="number" placeholder="Target amount" value={formTarget} onChange={e => setFormTarget(e.target.value)} />
            <Input type="number" placeholder="Current amount saved" value={formCurrent} onChange={e => setFormCurrent(e.target.value)} />
            <Input type="date" placeholder="Deadline" value={formDeadline} onChange={e => setFormDeadline(e.target.value)} />
            <Button onClick={handleSubmit} className="w-full">{editingId ? 'Update' : 'Create Goal'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
