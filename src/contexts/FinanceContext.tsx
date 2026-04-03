import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import {
  FinanceState, Transaction, Category, SavingsGoal, UserProfile, Notification,
  loadState, saveState, clearLocalState, formatCurrency, DEFAULT_PROFILE,
  getCategorySpending,
} from '@/lib/finance-store';
import { toast } from '@/components/ui/sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

interface FinanceContextType extends FinanceState {
  addTransaction: (t: Omit<Transaction, 'id'>) => Promise<void>;
  updateTransaction: (t: Transaction) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  addCategory: (c: Omit<Category, 'id'>) => Promise<void>;
  updateCategory: (c: Category) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  addGoal: (g: Omit<SavingsGoal, 'id'>) => Promise<void>;
  updateGoal: (g: SavingsGoal) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  updateProfile: (p: Partial<UserProfile>) => Promise<void>;
  createNotification: (n: Omit<Notification, 'id' | 'read' | 'created_at'>) => Promise<void>;
  markNotificationAsRead: (id: string) => Promise<void>;
  setDateRange: (range: { from: string; to: string }) => void;
  loading: boolean;
}

const FinanceContext = createContext<FinanceContextType | null>(null);

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<FinanceState>(loadState);
  const [loading, setLoading] = useState(false);

  const createNotification = useCallback(async (n: Omit<Notification, 'id' | 'read' | 'created_at'>) => {
    const newNLocal: Notification = {
      ...n,
      id: Math.random().toString(36).substring(7),
      read: false,
      created_at: new Date().toISOString()
    };

    setState(s => ({ ...s, notifications: [newNLocal, ...s.notifications] }));
    toast(n.title, { description: n.message });

    if (!user) return;
    try {
      await (supabase as any).from('notifications').insert({ user_id: user.id, ...n });
    } catch (e) {
      console.error('Error saving notification:', e);
    }
  }, [user]);

  const markNotificationAsRead = useCallback(async (id: string) => {
    setState(s => ({
      ...s,
      notifications: s.notifications.map(n => n.id === id ? { ...n, read: true } : n)
    }));

    if (!user) return;
    try {
      await (supabase as any).from('notifications').update({ read: true }).eq('id', id);
    } catch (e) {
      console.error('Error marking notification as read:', e);
    }
  }, [user]);

  const checkBudgetAlerts = useCallback((categoryName: string, transactions?: Transaction[]) => {
    const categories = state.categories;
    const currentTransactions = transactions || state.transactions;
    const cat = categories.find(c => c.name === categoryName);

    if (!cat || !cat.budget_limit || cat.budget_limit <= 0) return;

    const spent = getCategorySpending(currentTransactions, categoryName);
    const pct = (spent / cat.budget_limit) * 100;

    if (pct >= 100) {
      createNotification({
        title: 'Budget Exceeded! ⚠️',
        message: `You've spent ${formatCurrency(spent, state.profile.currency)} on "${categoryName}", which is over your ${formatCurrency(cat.budget_limit, state.profile.currency)} limit.`,
        type: 'budget_exceeded',
        link: '/budgets'
      });
    } else if (pct >= 85) {
      createNotification({
        title: 'Budget Warning 🔔',
        message: `You've used ${pct.toFixed(0)}% of your "${categoryName}" budget. You have ${formatCurrency(cat.budget_limit - spent, state.profile.currency)} remaining.`,
        type: 'budget_warning',
        link: '/budgets'
      });
    }
  }, [state.categories, state.transactions, state.profile.currency, createNotification]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [
        { data: transactions },
        { data: categories },
        { data: goals },
        { data: profile },
        { data: notifications }
      ] = await Promise.all([
        supabase.from('transactions').select('*').order('date', { ascending: false }),
        supabase.from('categories').select('*'),
        supabase.from('goals').select('*'),
        supabase.from('profiles').select('*').single(),
        (supabase as any).from('notifications').select('*').order('created_at', { ascending: false })
      ]);

      const netWorth = (transactions || []).reduce((sum: number, t: any) =>
        t.type === 'income' ? sum + Number(t.amount) : sum - Number(t.amount), 0
      );

      if (netWorth > 0 && netWorth < 100) {
        createNotification({
          title: 'Low Balance Alert 💳',
          message: `Your total balance is ${formatCurrency(netWorth, (profile as UserProfile)?.currency || 'USD')}. Consider reviewing your upcoming expenses.`,
          type: 'budget_warning',
          link: '/transactions'
        });
      }

      setState(s => ({
        ...s,
        transactions: (transactions as Transaction[]) || [],
        categories: (categories as Category[]) || [],
        goals: (goals as SavingsGoal[]) || [],
        notifications: (notifications as Notification[]) || [],
        profile: (profile as UserProfile) || DEFAULT_PROFILE
      }));
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [user, createNotification]);

  const updateGoalProgress = useCallback(async (goalId: string) => {
    try {
      const { data: trs, error: trError } = await supabase
        .from('transactions')
        .select('amount, type')
        .eq('goal_id', goalId);

      if (trError) throw trError;

      const total = ((trs || []) as any[]).reduce((sum, t) => {
        return t.type === 'expense' ? sum + Number(t.amount) : sum - Number(t.amount);
      }, 0);

      const normalizedTotal = Math.max(0, total);

      await (supabase as any)
        .from('goals')
        .update({ current_amount: normalizedTotal })
        .eq('id', goalId);

      // Check for milestones
      const goal = state.goals.find(g => g.id === goalId);
      if (goal) {
        const pct = (normalizedTotal / goal.target_amount) * 100;
        if (pct >= 100) {
          createNotification({
            title: 'Goal reached! 🎉',
            message: `Congratulations! You've saved ${formatCurrency(goal.target_amount, state.profile.currency)} for "${goal.name}".`,
            type: 'goal_reached',
            link: '/goals'
          });
        } else if (pct >= 90) {
          createNotification({
            title: 'Almost there! 💡',
            message: `You are at 90% of your goal for "${goal.name}". Just a little more!`,
            type: 'goal_milestone',
            link: '/goals'
          });
        }
      }

      await fetchData();
    } catch (error) {
      console.error('Error syncing goal progress:', error);
    }
  }, [fetchData, state.goals, state.profile.currency, createNotification]);

  useEffect(() => {
    if (user) {
      fetchData();
    } else {
      const localData = loadState();
      setState(s => ({
        ...s,
        ...localData,
        transactions: localData.transactions || [],
        categories: localData.categories || [],
        goals: localData.goals || [],
        notifications: localData.notifications || [],
        profile: localData.profile || DEFAULT_PROFILE
      }));
    }
  }, [user, fetchData]);

  useEffect(() => {
    if (!user) saveState(state);
  }, [state, user]);

  const addTransaction = useCallback(async (t: Omit<Transaction, 'id'>) => {
    if (!user) {
      toast.error('Please sign in to save data');
      return;
    }
    try {
      const { data, error } = await (supabase as any)
        .from('transactions')
        .insert([{ ...t, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;

      setState(s => ({ ...s, transactions: [data as Transaction, ...s.transactions] }));

      if (t.goal_id) await updateGoalProgress(t.goal_id);
      if (t.category) checkBudgetAlerts(t.category, [data as Transaction, ...state.transactions]);

      await fetchData();
    } catch (error) {
      console.error('Failed to add transaction:', error);
      toast.error('Failed to add transaction');
    }
  }, [user, state.transactions, updateGoalProgress, checkBudgetAlerts, fetchData]);

  const updateTransaction = useCallback(async (t: Transaction) => {
    if (!user) return;
    try {
      const oldTr = state.transactions.find(x => x.id === t.id);
      const { error } = await (supabase as any)
        .from('transactions')
        .update(t)
        .eq('id', t.id);

      if (error) throw error;

      setState(s => ({ ...s, transactions: s.transactions.map(x => x.id === t.id ? t : x) }));

      if (oldTr?.goal_id) await updateGoalProgress(oldTr.goal_id);
      if (t.goal_id && t.goal_id !== oldTr?.goal_id) await updateGoalProgress(t.goal_id);
      if (t.category) checkBudgetAlerts(t.category);

      toast.success('Transaction Updated');
      await fetchData();
    } catch (error) {
      toast.error('Failed to update transaction');
      console.error(error);
    }
  }, [user, state.transactions, updateGoalProgress, checkBudgetAlerts, fetchData]);

  const deleteTransaction = useCallback(async (id: string) => {
    if (!user) return;
    try {
      const trToDelete = state.transactions.find(x => x.id === id);
      const { error } = await (supabase as any).from('transactions').delete().eq('id', id);

      if (error) throw error;

      setState(s => ({ ...s, transactions: s.transactions.filter(x => x.id !== id) }));
      toast.info('Transaction Deleted');

      if (trToDelete?.goal_id) await updateGoalProgress(trToDelete.goal_id);

      await fetchData();
    } catch (error) {
      toast.error('Failed to delete transaction');
      console.error(error);
    }
  }, [user, state.transactions, updateGoalProgress, fetchData]);

  const addCategory = useCallback(async (c: Omit<Category, 'id'>) => {
    if (!user) return;
    try {
      const { data, error } = await (supabase as any)
        .from('categories')
        .insert([{ ...c, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;

      setState(s => ({ ...s, categories: [...s.categories, data as Category] }));
      toast.success('Category Created', { description: c.name });
    } catch (error) {
      toast.error('Failed to create category');
    }
  }, [user]);

  const updateCategory = useCallback(async (c: Category) => {
    if (!user) return;
    try {
      const { error } = await (supabase as any).from('categories').update(c).eq('id', c.id);
      if (error) throw error;

      setState(s => ({ ...s, categories: s.categories.map(x => x.id === c.id ? c : x) }));
      toast.success('Category Updated');
      checkBudgetAlerts(c.name);
    } catch (error) {
      toast.error('Failed to update category');
    }
  }, [user, checkBudgetAlerts]);

  const deleteCategory = useCallback(async (id: string) => {
    if (!user) return;
    try {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;

      setState(s => ({ ...s, categories: s.categories.filter(x => x.id !== id) }));
      toast.info('Category Deleted');
    } catch (error) {
      toast.error('Failed to delete category');
    }
  }, [user]);

  const addGoal = useCallback(async (g: Omit<SavingsGoal, 'id'>) => {
    if (!user) return;
    try {
      const { data, error } = await (supabase as any)
        .from('goals')
        .insert([{ ...g, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;

      setState(s => ({ ...s, goals: [...s.goals, data as SavingsGoal] }));
      toast.success('Goal Created');
    } catch (error) {
      toast.error('Failed to create goal');
    }
  }, [user]);

  const updateGoal = useCallback(async (g: SavingsGoal) => {
    if (!user) return;
    try {
      const { error } = await (supabase as any).from('goals').update(g).eq('id', g.id);
      if (error) throw error;

      setState(s => ({ ...s, goals: s.goals.map(x => x.id === g.id ? g : x) }));
      toast.success('Goal Updated');
    } catch (error) {
      toast.error('Failed to update goal');
    }
  }, [user]);

  const deleteGoal = useCallback(async (id: string) => {
    if (!user) return;
    try {
      const { error } = await supabase.from('goals').delete().eq('id', id);
      if (error) throw error;

      setState(s => ({ ...s, goals: s.goals.filter(x => x.id !== id) }));
      toast.info('Goal Removed');
    } catch (error) {
      toast.error('Failed to remove goal');
    }
  }, [user]);

  const updateProfile = useCallback(async (p: Partial<UserProfile>) => {
    if (!user) return;
    try {
      const { data, error } = await (supabase as any)
        .from('profiles')
        .upsert({ id: user.id, ...p, updated_at: new Date().toISOString() })
        .select()
        .single();

      if (error) throw error;

      setState(s => ({ ...s, profile: { ...s.profile, ...data as UserProfile } }));
      toast.success('Profile Updated');
    } catch (error) {
      toast.error('Failed to update profile');
    }
  }, [user]);

  const setDateRange = useCallback((range: { from: string; to: string }) => {
    setState(s => ({ ...s, dateRange: range }));
  }, []);

  return (
    <FinanceContext.Provider value={{
      ...state, addTransaction, updateTransaction, deleteTransaction,
      addCategory, updateCategory, deleteCategory,
      addGoal, updateGoal, deleteGoal, updateProfile,
      createNotification, markNotificationAsRead,
      setDateRange,
      loading
    }}>
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error('useFinance must be used within FinanceProvider');
  return ctx;
}
