import { useState, useEffect } from 'react';
import { Delete } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AmountInputProps {
  value: string;
  onChange: (value: string) => void;
  currency?: string;
}

export function AmountInput({ value, onChange, currency = '$' }: AmountInputProps) {
  const [displayValue, setDisplayValue] = useState(value || '0');

  useEffect(() => {
    setDisplayValue(value || '0');
  }, [value]);

  const handleKeypadPress = (key: string) => {
    let newValue = displayValue;

    if (key === 'BACKSPACE') {
      newValue = newValue.slice(0, -1);
      if (newValue === '') newValue = '0';
    } else if (key === '.') {
      if (!newValue.includes('.')) {
        newValue += '.';
      }
    } else {
      if (newValue === '0') {
        newValue = key;
      } else {
        newValue += key;
      }
    }

    if (newValue.includes('.')) {
      const [, decimal] = newValue.split('.');
      if (decimal && decimal.length > 2) return;
    }

    onChange(newValue);
  };

  return (
    <div className="flex flex-col items-stretch gap-6 py-2">
      <div className="flex items-baseline justify-center gap-1 px-2">
        <span className="text-2xl font-semibold text-muted-foreground tabular-nums sm:text-3xl">
          {currency}
        </span>
        <span
          className={cn(
            'text-5xl font-bold tracking-tight tabular-nums sm:text-6xl',
            displayValue === '0' ? 'text-muted-foreground/35' : 'text-foreground',
          )}
        >
          {displayValue}
        </span>
      </div>

      <div className="mx-auto grid w-full max-w-[320px] grid-cols-3 gap-2 sm:gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'BACKSPACE'].map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => handleKeypadPress(key)}
            className={cn(
                'flex h-14 items-center justify-center rounded-2xl text-xl font-semibold transition-colors active:scale-[0.98] sm:h-16 sm:text-2xl',
              key === 'BACKSPACE'
                ? 'bg-secondary/40 text-muted-foreground'
                : 'bg-secondary/25 text-foreground hover:bg-secondary/40',
            )}
          >
            {key === 'BACKSPACE' ? (
              <Delete className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={2} />
            ) : (
              key
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
