import {
  Banknote,
  CreditCard,
  Landmark,
  RefreshCw,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export const PAYMENT_METHODS = [
  { value: 'Cash', label: 'Cash', icon: Banknote },
  { value: 'Credit Card', label: 'Credit', icon: CreditCard },
  { value: 'Debit Card', label: 'Debit', icon: Wallet },
  { value: 'Bank Transfer', label: 'Transfer', icon: Landmark },
  { value: 'PayPal', label: 'PayPal', icon: Wallet },
  { value: 'Auto Pay', label: 'Auto', icon: RefreshCw },
] as const satisfies ReadonlyArray<{
  value: string;
  label: string;
  icon: LucideIcon;
}>;

interface PaymentMethodChipsProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function PaymentMethodChips({
  value,
  onChange,
  className,
}: PaymentMethodChipsProps) {
  return (
    <div className={cn('grid grid-cols-3 gap-2 sm:grid-cols-6', className)}>
      {PAYMENT_METHODS.map((m) => {
        const active = value === m.value;
        const Icon = m.icon;
        return (
          <motion.button
            key={m.value}
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={() => onChange(m.value)}
            className={cn(
              'flex flex-col items-center gap-1 rounded-2xl border px-1 py-2.5 text-center transition-colors',
              active
                ? 'border-primary bg-primary/15 text-foreground shadow-sm'
                : 'border-border/60 bg-secondary/30 text-muted-foreground hover:bg-secondary/50 hover:text-foreground',
            )}
          >
            <span
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-xl',
                active ? 'bg-primary/20 text-primary' : 'bg-background/80 text-muted-foreground',
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={2} />
            </span>
            <span className="text-[10px] font-semibold leading-tight">{m.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
