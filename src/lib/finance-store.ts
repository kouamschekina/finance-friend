export interface Transaction {
  id: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  description: string;
  date: string;
  paymentMethod: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  budgetLimit: number;
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string;
  icon: string;
}

export interface UserProfile {
  name: string;
  currency: string;
  monthlyIncome: number;
}

export interface FinanceState {
  transactions: Transaction[];
  categories: Category[];
  goals: SavingsGoal[];
  profile: UserProfile;
}

const DEFAULT_CATEGORIES: Category[] = [
  { id: '1', name: 'Food & Dining', icon: '🍔', color: 'hsl(25, 95%, 53%)', budgetLimit: 500 },
  { id: '2', name: 'Transport', icon: '🚗', color: 'hsl(210, 90%, 56%)', budgetLimit: 300 },
  { id: '3', name: 'Housing', icon: '🏠', color: 'hsl(160, 84%, 39%)', budgetLimit: 1500 },
  { id: '4', name: 'Utilities', icon: '💡', color: 'hsl(280, 70%, 55%)', budgetLimit: 200 },
  { id: '5', name: 'Entertainment', icon: '🎬', color: 'hsl(340, 82%, 52%)', budgetLimit: 200 },
  { id: '6', name: 'Shopping', icon: '🛍️', color: 'hsl(38, 92%, 50%)', budgetLimit: 400 },
  { id: '7', name: 'Health', icon: '💊', color: 'hsl(0, 72%, 51%)', budgetLimit: 150 },
  { id: '8', name: 'Business', icon: '💼', color: 'hsl(220, 60%, 50%)', budgetLimit: 0 },
  { id: '9', name: 'Investments', icon: '📈', color: 'hsl(150, 60%, 40%)', budgetLimit: 0 },
  { id: '10', name: 'Salary', icon: '💰', color: 'hsl(160, 84%, 39%)', budgetLimit: 0 },
];

const DEFAULT_PROFILE: UserProfile = {
  name: '',
  currency: 'USD',
  monthlyIncome: 0,
};

const now = new Date();
const currentMonth = now.getMonth();
const currentYear = now.getFullYear();

function d(day: number, monthOffset = 0) {
  return new Date(currentYear, currentMonth + monthOffset, day).toISOString().split('T')[0];
}

const SAMPLE_TRANSACTIONS: Transaction[] = [
  { id: 't1', amount: 5000, type: 'income', category: 'Salary', description: 'Monthly salary', date: d(1), paymentMethod: 'Bank Transfer' },
  { id: 't2', amount: 1200, type: 'expense', category: 'Housing', description: 'Rent payment', date: d(1), paymentMethod: 'Bank Transfer' },
  { id: 't3', amount: 85, type: 'expense', category: 'Food & Dining', description: 'Grocery shopping', date: d(3), paymentMethod: 'Credit Card' },
  { id: 't4', amount: 45, type: 'expense', category: 'Transport', description: 'Gas fill-up', date: d(5), paymentMethod: 'Debit Card' },
  { id: 't5', amount: 120, type: 'expense', category: 'Utilities', description: 'Electric bill', date: d(7), paymentMethod: 'Auto Pay' },
  { id: 't6', amount: 35, type: 'expense', category: 'Entertainment', description: 'Movie night', date: d(8), paymentMethod: 'Credit Card' },
  { id: 't7', amount: 200, type: 'expense', category: 'Shopping', description: 'New shoes', date: d(10), paymentMethod: 'Credit Card' },
  { id: 't8', amount: 500, type: 'income', category: 'Business', description: 'Freelance project', date: d(12), paymentMethod: 'PayPal' },
  { id: 't9', amount: 65, type: 'expense', category: 'Food & Dining', description: 'Restaurant dinner', date: d(14), paymentMethod: 'Credit Card' },
  { id: 't10', amount: 30, type: 'expense', category: 'Health', description: 'Pharmacy', date: d(15), paymentMethod: 'Debit Card' },
  // Previous month
  { id: 't11', amount: 5000, type: 'income', category: 'Salary', description: 'Monthly salary', date: d(1, -1), paymentMethod: 'Bank Transfer' },
  { id: 't12', amount: 1200, type: 'expense', category: 'Housing', description: 'Rent payment', date: d(1, -1), paymentMethod: 'Bank Transfer' },
  { id: 't13', amount: 350, type: 'expense', category: 'Food & Dining', description: 'Groceries total', date: d(5, -1), paymentMethod: 'Credit Card' },
  { id: 't14', amount: 180, type: 'expense', category: 'Transport', description: 'Gas & transit', date: d(8, -1), paymentMethod: 'Debit Card' },
  { id: 't15', amount: 150, type: 'expense', category: 'Entertainment', description: 'Concert tickets', date: d(12, -1), paymentMethod: 'Credit Card' },
  { id: 't16', amount: 100, type: 'expense', category: 'Utilities', description: 'Internet & phone', date: d(15, -1), paymentMethod: 'Auto Pay' },
];

const SAMPLE_GOALS: SavingsGoal[] = [
  { id: 'g1', name: 'Emergency Fund', targetAmount: 10000, currentAmount: 4500, deadline: new Date(currentYear, currentMonth + 6, 1).toISOString().split('T')[0], icon: '🛡️' },
  { id: 'g2', name: 'Vacation', targetAmount: 3000, currentAmount: 1200, deadline: new Date(currentYear, currentMonth + 4, 1).toISOString().split('T')[0], icon: '✈️' },
  { id: 'g3', name: 'New Laptop', targetAmount: 2000, currentAmount: 800, deadline: new Date(currentYear, currentMonth + 3, 1).toISOString().split('T')[0], icon: '💻' },
];

const STORAGE_KEY = 'finwise-data';

export function loadState(): FinanceState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return {
    transactions: SAMPLE_TRANSACTIONS,
    categories: DEFAULT_CATEGORIES,
    goals: SAMPLE_GOALS,
    profile: { ...DEFAULT_PROFILE, name: 'User', monthlyIncome: 5000 },
  };
}

export function saveState(state: FinanceState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function getCurrentMonthTransactions(transactions: Transaction[]): Transaction[] {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return transactions.filter(t => {
    const d = new Date(t.date);
    return d >= start && d <= end;
  });
}

export function getPreviousMonthTransactions(transactions: Transaction[]): Transaction[] {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0);
  return transactions.filter(t => {
    const d = new Date(t.date);
    return d >= start && d <= end;
  });
}

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
}

export function getCategorySpending(transactions: Transaction[], categoryName: string): number {
  return getCurrentMonthTransactions(transactions)
    .filter(t => t.type === 'expense' && t.category === categoryName)
    .reduce((sum, t) => sum + t.amount, 0);
}
