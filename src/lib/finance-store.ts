export interface Transaction {
  id: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  description: string;
  date: string;
  payment_method: string;
  goal_id?: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  budget_limit: number;
}

export interface SavingsGoal {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string;
  icon: string;
}

export interface UserProfile {
  name: string;
  currency: string;
  monthly_income: number;
  avatar_url?: string;
  xai_api_key?: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'budget_warning' | 'budget_exceeded' | 'goal_milestone' | 'goal_reached' | 'system';
  read: boolean;
  link?: string;
  created_at: string;
}

export interface FinanceState {
  transactions: Transaction[];
  categories: Category[];
  goals: SavingsGoal[];
  notifications: Notification[];
  profile: UserProfile;
  dateRange: { from: string; to: string };
}

const DEFAULT_CATEGORIES: Category[] = [
  { id: '1', name: 'Food & Dining', icon: 'utensils', color: 'hsl(25, 95%, 53%)', budget_limit: 500 },
  { id: '2', name: 'Transport', icon: 'car', color: 'hsl(210, 90%, 56%)', budget_limit: 300 },
  { id: '3', name: 'Housing', icon: 'home', color: 'hsl(160, 84%, 39%)', budget_limit: 1500 },
  { id: '4', name: 'Utilities', icon: 'lightbulb', color: 'hsl(280, 70%, 55%)', budget_limit: 200 },
  { id: '5', name: 'Entertainment', icon: 'film', color: 'hsl(340, 82%, 52%)', budget_limit: 200 },
  { id: '6', name: 'Shopping', icon: 'shopping-bag', color: 'hsl(38, 92%, 50%)', budget_limit: 400 },
  { id: '7', name: 'Health', icon: 'heart', color: 'hsl(0, 72%, 51%)', budget_limit: 150 },
  { id: '8', name: 'Business', icon: 'briefcase', color: 'hsl(220, 60%, 50%)', budget_limit: 0 },
  { id: '9', name: 'Investments', icon: 'trending-up', color: 'hsl(150, 60%, 40%)', budget_limit: 0 },
  { id: '10', name: 'Salary', icon: 'wallet', color: 'hsl(160, 84%, 39%)', budget_limit: 0 },
];

export const DEFAULT_PROFILE: UserProfile = {
  name: '',
  currency: 'USD',
  monthly_income: 0,
  avatar_url: '',
};

const now = new Date();
const currentMonth = now.getMonth();
const currentYear = now.getFullYear();

function d(day: number, monthOffset = 0) {
  return new Date(currentYear, currentMonth + monthOffset, day).toISOString().split('T')[0];
}

const SAMPLE_TRANSACTIONS: Transaction[] = [
  { id: 't1', amount: 5000, type: 'income', category: 'Salary', description: 'Monthly salary', date: d(1), payment_method: 'Bank Transfer' },
  { id: 't2', amount: 1200, type: 'expense', category: 'Housing', description: 'Rent payment', date: d(1), payment_method: 'Bank Transfer' },
  { id: 't3', amount: 85, type: 'expense', category: 'Food & Dining', description: 'Grocery shopping', date: d(3), payment_method: 'Credit Card' },
  { id: 't4', amount: 45, type: 'expense', category: 'Transport', description: 'Gas fill-up', date: d(5), payment_method: 'Debit Card' },
  { id: 't5', amount: 120, type: 'expense', category: 'Utilities', description: 'Electric bill', date: d(7), payment_method: 'Auto Pay' },
  { id: 't6', amount: 35, type: 'expense', category: 'Entertainment', description: 'Movie night', date: d(8), payment_method: 'Credit Card' },
  { id: 't7', amount: 200, type: 'expense', category: 'Shopping', description: 'New shoes', date: d(10), payment_method: 'Credit Card' },
  { id: 't8', amount: 500, type: 'income', category: 'Business', description: 'Freelance project', date: d(12), payment_method: 'PayPal' },
  { id: 't9', amount: 65, type: 'expense', category: 'Food & Dining', description: 'Restaurant dinner', date: d(14), payment_method: 'Credit Card' },
  { id: 't10', amount: 30, type: 'expense', category: 'Health', description: 'Pharmacy', date: d(15), payment_method: 'Debit Card' },
  { id: 't11', amount: 5000, type: 'income', category: 'Salary', description: 'Monthly salary', date: d(1, -1), payment_method: 'Bank Transfer' },
  { id: 't12', amount: 1200, type: 'expense', category: 'Housing', description: 'Rent payment', date: d(1, -1), payment_method: 'Bank Transfer' },
  { id: 't13', amount: 350, type: 'expense', category: 'Food & Dining', description: 'Groceries total', date: d(5, -1), payment_method: 'Credit Card' },
  { id: 't14', amount: 180, type: 'expense', category: 'Transport', description: 'Gas & transit', date: d(8, -1), payment_method: 'Debit Card' },
  { id: 't15', amount: 150, type: 'expense', category: 'Entertainment', description: 'Concert tickets', date: d(12, -1), payment_method: 'Credit Card' },
  { id: 't16', amount: 100, type: 'expense', category: 'Utilities', description: 'Internet & phone', date: d(15, -1), payment_method: 'Auto Pay' },
];

const SAMPLE_GOALS: SavingsGoal[] = [
  { id: 'g1', name: 'Emergency Fund', target_amount: 10000, current_amount: 4500, deadline: new Date(currentYear, currentMonth + 6, 1).toISOString().split('T')[0], icon: 'shield' },
  { id: 'g2', name: 'Vacation', target_amount: 3000, current_amount: 1200, deadline: new Date(currentYear, currentMonth + 4, 1).toISOString().split('T')[0], icon: 'plane' },
  { id: 'g3', name: 'New Laptop', target_amount: 2000, current_amount: 800, deadline: new Date(currentYear, currentMonth + 3, 1).toISOString().split('T')[0], icon: 'laptop' },
];

const STORAGE_KEY = 'finwise-data';

export function loadState(): FinanceState {
  const startOfMonth = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0];
  const endOfMonth = new Date(currentYear, currentMonth + 1, 0).toISOString().split('T')[0];
  const fallback: FinanceState = {
    transactions: SAMPLE_TRANSACTIONS,
    categories: DEFAULT_CATEGORIES,
    goals: SAMPLE_GOALS,
    notifications: [],
    profile: { ...DEFAULT_PROFILE, name: 'User', monthly_income: 5000 },
    dateRange: { from: startOfMonth, to: endOfMonth },
  };

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...fallback, ...parsed };
    }
  } catch { }
  return fallback;
}

export function saveState(state: FinanceState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function clearLocalState() {
  localStorage.removeItem(STORAGE_KEY);
}

export function generateId(): string {
  return crypto.randomUUID();
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

export function getFilteredTransactions(transactions: Transaction[], from: string, to: string): Transaction[] {
  const start = new Date(from);
  const end = new Date(to);
  end.setHours(23, 59, 59, 999); // Include full end day

  return transactions.filter(t => {
    const d = new Date(t.date);
    return d >= start && d <= end;
  });
}

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
}

export function getCategorySpending(transactions: Transaction[], categoryName: string, dateRange?: { from: string; to: string }): number {
  const filtered = dateRange
    ? getFilteredTransactions(transactions, dateRange.from, dateRange.to)
    : getCurrentMonthTransactions(transactions);

  return filtered
    .filter(t => t.type === 'expense' && t.category === categoryName)
    .reduce((sum, t) => sum + t.amount, 0);
}
