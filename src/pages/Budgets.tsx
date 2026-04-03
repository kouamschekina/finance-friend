import { useState } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { useUI } from '@/contexts/UIContext';
import { formatCurrency, getCategorySpending } from '@/lib/finance-store';
import { getCategoryIcon } from '@/lib/icons';
import { Plus, Edit2, Trash2, Wallet, TrendingUp, AlertCircle, ChevronRight, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export default function Budgets() {
  const { categories, transactions, profile, deleteCategory } = useFinance();
  const { openCategoryDrawer } = useUI();

  const budgetCategories = categories.filter(c => c.budget_limit > 0);
  const otherCategories = categories.filter(c => c.budget_limit <= 0);

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between px-1" data-tour="budgets-header">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground leading-none mb-2">Budgets</h1>
          <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] opacity-70 flex items-center gap-2">
            <Wallet className="w-3 h-3 text-primary" />
            Strategic Planning
          </p>
        </div>
        <Button onClick={() => openCategoryDrawer()} data-tour="new-budget" className="rounded-2xl h-12 finance-gradient border-0 px-6 font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all">
          <Plus className="w-5 h-5 mr-1" /> New
        </Button>
      </div>

      {budgetCategories.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <AnimatePresence mode="popLayout">
            {budgetCategories.map((cat, idx) => {
              const CatIcon = getCategoryIcon(cat.name);
              const spent = getCategorySpending(transactions, cat.name);
              const pct = Math.min((spent / cat.budget_limit) * 100, 100);
              const overBudget = spent > cat.budget_limit;
              const warning = pct >= 85 && !overBudget;

              return (
                <motion.div
                  key={cat.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="finance-card p-6 group hover:border-primary/20 transition-all relative overflow-hidden"
                >
                  {overBudget && (
                    <div className="absolute top-0 right-0 px-3 py-1 bg-destructive/10 text-destructive text-[10px] font-black uppercase tracking-widest rounded-bl-xl border-l border-b border-destructive/20">
                      Limit Exceeded
                    </div>
                  )}

                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center relative overflow-hidden group-hover:scale-110 transition-transform" style={{ backgroundColor: cat.color + '15' }}>
                        <CatIcon className="w-6 h-6 z-10" style={{ color: cat.color }} />
                        <div className="absolute inset-0 opacity-10 bg-current" style={{ color: cat.color }} />
                      </div>
                      <div>
                        <p className="text-base font-black text-foreground tracking-tight">{cat.name}</p>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                          Monthly Allowance
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => openCategoryDrawer(cat.id)} className="w-8 h-8 rounded-lg hover:bg-secondary flex items-center justify-center text-muted-foreground transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => deleteCategory(cat.id)} className="w-8 h-8 rounded-lg hover:bg-destructive/10 hover:text-destructive flex items-center justify-center text-muted-foreground transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-end mb-1 px-1">
                      <p className="text-sm font-black text-foreground leading-none">
                        {formatCurrency(spent, profile.currency)}
                        <span className="text-[10px] text-muted-foreground font-bold ml-1 opacity-60">spent</span>
                      </p>
                      <p className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground">
                        Limit: {formatCurrency(cat.budget_limit, profile.currency)}
                      </p>
                    </div>

                    <div className="h-2 w-full bg-secondary/50 rounded-full overflow-hidden p-[1px] border border-border/20">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        className={cn(
                          "h-full rounded-full shadow-sm",
                          overBudget ? "bg-destructive" : warning ? "bg-orange-500" : "finance-gradient"
                        )}
                      />
                    </div>

                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-1.5">
                        {overBudget ? (
                          <AlertCircle className="w-3 h-3 text-destructive" />
                        ) : warning ? (
                          <TrendingUp className="w-3 h-3 text-orange-500" />
                        ) : null}
                        <p className={cn(
                          "text-[10px] font-black uppercase tracking-widest",
                          overBudget ? "text-destructive" : warning ? "text-orange-500" : "text-primary"
                        )}>
                          {overBudget ? 'Over Budget' : warning ? 'Near Limit' : 'On Track'}
                        </p>
                      </div>
                      <p className="text-[10px] font-black text-muted-foreground/60 italic">
                        {pct.toFixed(0)}% Utilized
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      ) : (
        <div className="finance-card p-12 text-center border-dashed">
          <div className="w-16 h-16 rounded-3xl bg-secondary/30 flex items-center justify-center mx-auto mb-4 border border-border/50">
            <Wallet className="w-8 h-8 text-muted-foreground/40" />
          </div>
          <h3 className="text-lg font-black text-foreground tracking-tight">No Budgets Defined</h3>
          <p className="text-sm text-muted-foreground font-medium mb-6">Create limits to track your spending habits effectively.</p>
          <Button onClick={() => openCategoryDrawer()} variant="outline" className="rounded-xl font-bold border-primary/20 text-primary hover:bg-primary/5">
            Get Started
          </Button>
        </div>
      )}

      {otherCategories.length > 0 && (
        <div className="space-y-4 px-1">
          <h2 className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.2em]">Unlimited Categories</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {otherCategories.map(cat => {
              const CatIcon = getCategoryIcon(cat.name);
              return (
                <div key={cat.id} className="finance-card p-4 flex items-center gap-4 group hover:border-primary/20 transition-all cursor-pointer" onClick={() => openCategoryDrawer(cat.id)}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center relative overflow-hidden" style={{ backgroundColor: cat.color + '15' }}>
                    <CatIcon className="w-5 h-5 z-10" style={{ color: cat.color }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-foreground truncate leading-none mb-1">{cat.name}</p>
                    <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-tighter">No Limit</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

