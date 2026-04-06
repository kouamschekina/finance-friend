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
  onboarding_completed?: boolean;
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

export const DEFAULT_CATEGORIES: Category[] = [
  { id: '11111111-1111-1111-1111-111111111111', name: 'Food & Dining', icon: 'utensils', color: 'hsl(25, 95%, 53%)', budget_limit: 0 },
  { id: '22222222-2222-2222-2222-222222222222', name: 'Transport', icon: 'car', color: 'hsl(210, 90%, 56%)', budget_limit: 0 },
  { id: '33333333-3333-3333-3333-333333333333', name: 'Housing', icon: 'home', color: 'hsl(160, 84%, 39%)', budget_limit: 0 },
  { id: '44444444-4444-4444-4444-444444444444', name: 'Utilities', icon: 'lightbulb', color: 'hsl(280, 70%, 55%)', budget_limit: 0 },
  { id: '55555555-5555-5555-5555-555555555555', name: 'Entertainment', icon: 'film', color: 'hsl(340, 82%, 52%)', budget_limit: 0 },
  { id: '66666666-6666-6666-6666-666666666666', name: 'Shopping', icon: 'shopping-bag', color: 'hsl(38, 92%, 50%)', budget_limit: 0 },
  { id: '77777777-7777-7777-7777-777777777777', name: 'Health', icon: 'heart', color: 'hsl(0, 72%, 51%)', budget_limit: 0 },
  { id: '88888888-8888-8888-8888-888888888888', name: 'Business', icon: 'briefcase', color: 'hsl(220, 60%, 50%)', budget_limit: 0 },
  { id: '99999999-9999-9999-9999-999999999999', name: 'Investments', icon: 'trending-up', color: 'hsl(150, 60%, 40%)', budget_limit: 0 },
  { id: '00000000-0000-0000-0000-000000000000', name: 'Salary', icon: 'wallet', color: 'hsl(160, 84%, 39%)', budget_limit: 0 },
  { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', name: 'Education', icon: 'book', color: 'hsl(270, 65%, 55%)', budget_limit: 0 },
  { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', name: 'Personal Care', icon: 'sparkles', color: 'hsl(320, 70%, 50%)', budget_limit: 0 },
  { id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', name: 'Gifts & Donations', icon: 'gift', color: 'hsl(350, 75%, 55%)', budget_limit: 0 },
  { id: 'dddddddd-dddd-dddd-dddd-dddddddddddd', name: 'Travel', icon: 'plane', color: 'hsl(190, 80%, 50%)', budget_limit: 0 },
  { id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', name: 'Subscriptions', icon: 'credit-card', color: 'hsl(250, 70%, 55%)', budget_limit: 0 },
];

export const DEFAULT_PROFILE: UserProfile = {
  name: '',
  currency: 'XAF',
  monthly_income: 0,
  avatar_url: '',
  onboarding_completed: false,
};

const now = new Date();
const currentMonth = now.getMonth();
const currentYear = now.getFullYear();

function d(day: number, monthOffset = 0) {
  return new Date(currentYear, currentMonth + monthOffset, day).toISOString().split('T')[0];
}

const SAMPLE_TRANSACTIONS: Transaction[] = [];

const SAMPLE_GOALS: SavingsGoal[] = [];

const STORAGE_KEY = 'fenowa-data';

export function loadState(): FinanceState {
  const startOfMonth = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0];
  const endOfMonth = new Date(currentYear, currentMonth + 1, 0).toISOString().split('T')[0];
  const fallback: FinanceState = {
    transactions: SAMPLE_TRANSACTIONS,
    categories: DEFAULT_CATEGORIES,
    goals: SAMPLE_GOALS,
    notifications: [],
    profile: { ...DEFAULT_PROFILE },
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

export function formatCurrency(amount: number, currency: string = 'XAF'): string {
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
