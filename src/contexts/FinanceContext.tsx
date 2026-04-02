import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import {
  FinanceState, Transaction, Category, SavingsGoal, UserProfile,
  loadState, saveState, generateId,
} from '@/lib/finance-store';

interface FinanceContextType extends FinanceState {
  addTransaction: (t: Omit<Transaction, 'id'>) => void;
  updateTransaction: (t: Transaction) => void;
  deleteTransaction: (id: string) => void;
  addCategory: (c: Omit<Category, 'id'>) => void;
  updateCategory: (c: Category) => void;
  deleteCategory: (id: string) => void;
  addGoal: (g: Omit<SavingsGoal, 'id'>) => void;
  updateGoal: (g: SavingsGoal) => void;
  deleteGoal: (id: string) => void;
  updateProfile: (p: Partial<UserProfile>) => void;
}

const FinanceContext = createContext<FinanceContextType | null>(null);

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<FinanceState>(loadState);

  useEffect(() => { saveState(state); }, [state]);

  const addTransaction = useCallback((t: Omit<Transaction, 'id'>) => {
    setState(s => ({ ...s, transactions: [...s.transactions, { ...t, id: generateId() }] }));
  }, []);

  const updateTransaction = useCallback((t: Transaction) => {
    setState(s => ({ ...s, transactions: s.transactions.map(x => x.id === t.id ? t : x) }));
  }, []);

  const deleteTransaction = useCallback((id: string) => {
    setState(s => ({ ...s, transactions: s.transactions.filter(x => x.id !== id) }));
  }, []);

  const addCategory = useCallback((c: Omit<Category, 'id'>) => {
    setState(s => ({ ...s, categories: [...s.categories, { ...c, id: generateId() }] }));
  }, []);

  const updateCategory = useCallback((c: Category) => {
    setState(s => ({ ...s, categories: s.categories.map(x => x.id === c.id ? c : x) }));
  }, []);

  const deleteCategory = useCallback((id: string) => {
    setState(s => ({ ...s, categories: s.categories.filter(x => x.id !== id) }));
  }, []);

  const addGoal = useCallback((g: Omit<SavingsGoal, 'id'>) => {
    setState(s => ({ ...s, goals: [...s.goals, { ...g, id: generateId() }] }));
  }, []);

  const updateGoal = useCallback((g: SavingsGoal) => {
    setState(s => ({ ...s, goals: s.goals.map(x => x.id === g.id ? g : x) }));
  }, []);

  const deleteGoal = useCallback((id: string) => {
    setState(s => ({ ...s, goals: s.goals.filter(x => x.id !== id) }));
  }, []);

  const updateProfile = useCallback((p: Partial<UserProfile>) => {
    setState(s => ({ ...s, profile: { ...s.profile, ...p } }));
  }, []);

  return (
    <FinanceContext.Provider value={{
      ...state, addTransaction, updateTransaction, deleteTransaction,
      addCategory, updateCategory, deleteCategory,
      addGoal, updateGoal, deleteGoal, updateProfile,
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
