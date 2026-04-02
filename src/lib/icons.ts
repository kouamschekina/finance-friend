import {
  UtensilsCrossed, Car, Home, Lightbulb, Film, ShoppingBag,
  Heart, Briefcase, TrendingUp, Wallet, Gift, Plane,
  GraduationCap, Dumbbell, Music, Phone, Shield, Laptop,
  Target, PiggyBank, type LucideIcon,
} from 'lucide-react';

// Category name → icon mapping
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  'Food & Dining': UtensilsCrossed,
  'Transport': Car,
  'Housing': Home,
  'Utilities': Lightbulb,
  'Entertainment': Film,
  'Shopping': ShoppingBag,
  'Health': Heart,
  'Business': Briefcase,
  'Investments': TrendingUp,
  'Salary': Wallet,
  'Gifts': Gift,
  'Travel': Plane,
  'Education': GraduationCap,
  'Fitness': Dumbbell,
  'Music': Music,
  'Phone': Phone,
};

// Goal icon key → icon mapping
const GOAL_ICONS: Record<string, LucideIcon> = {
  'shield': Shield,
  'plane': Plane,
  'laptop': Laptop,
  'target': Target,
  'piggybank': PiggyBank,
  'gift': Gift,
  'home': Home,
  'car': Car,
  'graduation': GraduationCap,
  'heart': Heart,
  'dumbbell': Dumbbell,
  'briefcase': Briefcase,
};

export function getCategoryIcon(name: string): LucideIcon {
  return CATEGORY_ICONS[name] || Wallet;
}

export function getGoalIcon(key: string): LucideIcon {
  return GOAL_ICONS[key] || Target;
}

export const GOAL_ICON_OPTIONS = Object.keys(GOAL_ICONS);
