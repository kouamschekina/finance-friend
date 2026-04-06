import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import {
  FinanceState, Transaction, Category, SavingsGoal, UserProfile, Notification,
  loadState, saveState, clearLocalState, formatCurrency, DEFAULT_PROFILE,
  DEFAULT_CATEGORIES, getCategorySpending,
} from '@/lib/finance-store';

// Helper function to ensure all default categories exist for the user
async function ensureDefaultCategories(userId: string): Promise<void> {
  const { data: existingCategories } = await supabase
    .from('categories')
    .select('name')
    .eq('user_id', userId);

  const existingNames = new Set((existingCategories as any[] || []).map(c => c.name));
  
  // Find missing default categories
  const missingCategories = DEFAULT_CATEGORIES.filter(
    cat => !existingNames.has(cat.name)
  );

  // Insert missing categories one by one with new UUIDs
  for (const cat of missingCategories) {
    try {
      await (supabase as any)
        .from('categories')
        .insert({
          // Generate new UUID instead of using fixed ID
          user_id: userId,
          name: cat.name,
          icon: cat.icon,
          color: cat.color,
          budget_limit: cat.budget_limit
        });
    } catch (error: any) {
      // Ignore duplicate key errors
      if (error.code !== '23505' && error.code !== '42501') {
        console.error('Error adding category:', error);
      }
    }
  }
}

// Helper function to merge user categories with default categories
function mergeCategoriesWithDefaults(userCategories: Category[], userId: string): Category[] {
  const merged = [...DEFAULT_CATEGORIES];
  
  // Create a map of user categories by name for quick lookup
  const userCategoryMap = new Map(userCategories.map(cat => [cat.name, cat]));
  
  // Merge user categories with defaults, preserving user's budget limits
  DEFAULT_CATEGORIES.forEach(defaultCat => {
    const userCat = userCategoryMap.get(defaultCat.name);
    if (userCat) {
      // Use user's category data (preserves budget_limit and any customizations)
      const index = merged.findIndex(cat => cat.id === defaultCat.id);
      if (index !== -1) {
        merged[index] = userCat;
      }
    }
  });
  
  // Add any additional categories user has that aren't in defaults
  userCategories.forEach(userCat => {
    if (!DEFAULT_CATEGORIES.find(dc => dc.name === userCat.name)) {
      merged.push(userCat);
    }
  });
  
  return merged;
}
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
  completeOnboarding: () => Promise<void>;
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

  const checkBudgetAlerts = useCallback(async (categoryName: string, transactions?: Transaction[]) => {
    const categories = state.categories;
    const currentTransactions = transactions || state.transactions;
    const cat = categories.find(c => c.name === categoryName);

    if (!cat || !cat.budget_limit || cat.budget_limit <= 0) return;

    const spent = getCategorySpending(currentTransactions, categoryName);
    const pct = (spent / cat.budget_limit) * 100;

    if (pct >= 100) {
      await createNotification({
        title: 'Budget Exceeded! ⚠️',
        message: `You've spent ${formatCurrency(spent, state.profile.currency)} on "${categoryName}", which is over your ${formatCurrency(cat.budget_limit, state.profile.currency)} limit.`,
        type: 'budget_exceeded',
        link: '/budgets'
      });
    } else if (pct >= 85) {
      await createNotification({
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
      // Ensure all default categories exist for this user
      await ensureDefaultCategories(user.id);

      const [
        { data: transactions },
        { data: categories },
        { data: goals },
        { data: profile },
        notifRes
      ] = await Promise.all([
        supabase.from('transactions').select('*').order('date', { ascending: false }),
        supabase.from('categories').select('*'),
        supabase.from('goals').select('*'),
        supabase.from('profiles').select('*').eq('id', user.id).single(),
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

      setState(s => {
        // If the notifications table errors or is missing, keep the local ones.
        // Also keep local ones that haven't been synced back if we need to.
        const fetchedNotifs = (!notifRes.error && notifRes.data) ? (notifRes.data as Notification[]) : null;
        const currentNotifs = fetchedNotifs !== null ? fetchedNotifs : s.notifications;

        // deduplicate any missing local ones (random IDs vs uuid)
        const serverTitles = new Set(currentNotifs.map(n => n.title + n.message));
        const missedLocals = s.notifications.filter(n => n.id.length < 20 && !serverTitles.has(n.title + n.message));

        return {
          ...s,
          transactions: (transactions as Transaction[]) || [],
          // Always ensure all default categories are available, merge with existing ones
          categories: mergeCategoriesWithDefaults((categories as Category[]) || [], user.id),
          goals: (goals as SavingsGoal[]) || [],
          notifications: [...missedLocals, ...currentNotifs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
          profile: (profile as UserProfile) || DEFAULT_PROFILE
        };
      });
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
          await createNotification({
            title: 'Goal reached! 🎉',
            message: `Congratulations! You've saved ${formatCurrency(goal.target_amount, state.profile.currency)} for "${goal.name}".`,
            type: 'goal_reached',
            link: '/goals'
          });
        } else if (pct >= 90) {
          await createNotification({
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
    // One-time cleanup for old demo data
    const cleanupOldData = () => {
      const saved = localStorage.getItem('fenowa-data');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          // Check for specifically known demo IDs from previous versions
          const hasDemoData = parsed.transactions?.some((t: any) => t.id === 't1' || t.id === 't2');
          if (hasDemoData) {
            console.log('Fenowa: Clearing legacy demo data from localStorage');
            localStorage.removeItem('fenowa-data');
            window.location.reload();
          }
        } catch (e) {
          console.error('Error checking for demo data:', e);
        }
      }
    };
    cleanupOldData();

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
      toast.error('Please sign in to perform this action');
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
      if (t.category) await checkBudgetAlerts(t.category, [data as Transaction, ...state.transactions]);

      await fetchData();
    } catch (error) {
      console.error('Failed to add transaction:', error);
      toast.error('Failed to add transaction');
    }
  }, [user, state.transactions, updateGoalProgress, checkBudgetAlerts, fetchData]);

  const updateTransaction = useCallback(async (t: Transaction) => {
    if (!user) {
      toast.error('Please sign in to perform this action');
      return;
    }
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
      if (t.category) await checkBudgetAlerts(t.category, state.transactions.map(x => x.id === t.id ? t : x));

      toast.success('Transaction Updated');
      await fetchData();
    } catch (error) {
      toast.error('Failed to update transaction');
      console.error(error);
    }
  }, [user, state.transactions, updateGoalProgress, checkBudgetAlerts, fetchData]);

  const deleteTransaction = useCallback(async (id: string) => {
    if (!user) {
      toast.error('Please sign in to perform this action');
      return;
    }
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
    if (!user) {
      toast.error('Please sign in to perform this action');
      return;
    }
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
    if (!user) {
      toast.error('Please sign in to perform this action');
      return;
    }
    try {
      const { error } = await (supabase as any).from('categories').upsert({ ...c, user_id: user.id });
      if (error) throw error;

      setState(s => ({ ...s, categories: s.categories.map(x => x.id === c.id ? c : x) }));
      toast.success('Category Updated');
      await checkBudgetAlerts(c.name);
    } catch (error) {
      toast.error('Failed to update category');
    }
  }, [user, checkBudgetAlerts]);

  const deleteCategory = useCallback(async (id: string) => {
    if (!user) {
      toast.error('Please sign in to perform this action');
      return;
    }
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
    if (!user) {
      toast.error('Please sign in to perform this action');
      return;
    }
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
    if (!user) {
      toast.error('Please sign in to perform this action');
      return;
    }
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
    if (!user) {
      toast.error('Please sign in to perform this action');
      return;
    }
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
    if (!user) {
      // For guest users, update state directly
      setState(s => ({
        ...s,
        profile: { ...s.profile, ...p }
      }));
      return;
    }
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

  const completeOnboarding = useCallback(async () => {
    if (!user) {
      // For guest users, save to local state which will be persisted by the useEffect
      setState(s => ({
        ...s,
        profile: { ...s.profile, onboarding_completed: true }
      }));
      return;
    }

    try {
      await (supabase as any)
        .from('profiles')
        .update({ onboarding_completed: true })
        .eq('id', user.id);

      setState(s => ({
        ...s,
        profile: { ...s.profile, onboarding_completed: true }
      }));
    } catch (error) {
      console.error('Error completing onboarding:', error);
    }
  }, [user]);

  return (
    <FinanceContext.Provider value={{
      ...state, addTransaction, updateTransaction, deleteTransaction,
      addCategory, updateCategory, deleteCategory,
      addGoal, updateGoal, deleteGoal, updateProfile,
      createNotification, markNotificationAsRead,
      setDateRange,
      completeOnboarding,
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
