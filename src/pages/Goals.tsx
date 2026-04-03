import { useState } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { useUI } from '@/contexts/UIContext';
import { formatCurrency } from '@/lib/finance-store';
import { getGoalIcon, GOAL_ICON_OPTIONS } from '@/lib/icons';
import { Plus, Edit2, Trash2, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function Goals() {
  const { goals, profile, deleteGoal } = useFinance();
  const { openGoalDrawer } = useUI();

  return (
    <div className="space-y-5 animate-fade-in min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" data-tour="goals-header">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Savings goals</h1>
          <p className="text-muted-foreground text-sm">Track progress toward targets</p>
        </div>
        <Button onClick={() => openGoalDrawer()} data-tour="new-goal" size="sm" className="gap-1.5 rounded-xl h-11 finance-gradient border-0 px-5 w-full sm:w-auto shrink-0 font-bold shadow-lg shadow-primary/20">
          <Plus className="w-5 h-5" /> New goal
        </Button>
      </div>

      {goals.length === 0 ? (
        <div className="finance-card p-12 text-center border-dashed">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Target className="w-8 h-8 text-primary" />
          </div>
          <p className="text-muted-foreground text-sm">No goals yet. Create one to start tracking!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {goals.map(goal => {
            const GoalIcon = getGoalIcon(goal.icon);
            const pct = Math.min((goal.current_amount / goal.target_amount) * 100, 100);
            const remaining = goal.target_amount - goal.current_amount;
            const daysLeft = goal.deadline ? Math.max(0, Math.ceil((new Date(goal.deadline).getTime() - Date.now()) / 86400000)) : null;
            const completed = pct >= 100;

            return (
              <div key={goal.id} className={`finance-card p-4 ${completed ? 'ring-1 ring-primary/30' : ''}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${completed ? 'bg-primary/15' : 'bg-secondary'}`}>
                      <GoalIcon className={`w-6 h-6 ${completed ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{goal.name}</p>
                      <p className="text-[11px] text-muted-foreground font-medium">
                        {formatCurrency(goal.current_amount, profile.currency)} of {formatCurrency(goal.target_amount, profile.currency)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-0.5">
                    <button onClick={() => openGoalDrawer(goal.id)} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground active:scale-90 transition-all"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => deleteGoal(goal.id)} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive active:scale-90 transition-all"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="progress-bar mb-2 h-2.5">
                  <div className={`progress-bar-fill ${completed ? 'bg-primary shadow-[0_0_8px_rgba(var(--primary-rgb),0.5)]' : 'bg-info'}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground font-medium">
                  <span className={completed ? 'text-primary font-bold' : ''}>{pct.toFixed(0)}% complete</span>
                  {completed ? (
                    <span className="text-primary font-bold">Goal reached! 🔥</span>
                  ) : (
                    <span>{formatCurrency(remaining, profile.currency)} to go{daysLeft !== null && ` · ${daysLeft} days`}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
