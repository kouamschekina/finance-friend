import type { Category } from '@/lib/finance-store';
import { getCategoryIcon } from '@/lib/icons';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface CategoryGridProps {
  categories: Category[];
  onSelect: (name: string) => void;
  selected?: string;
  type?: 'income' | 'expense';
}

export function CategoryGrid({
  categories,
  onSelect,
  selected,
}: CategoryGridProps) {
  return (
    <div
      className={cn(
        'grid max-h-[min(360px,42vh)] grid-cols-3 gap-2 overflow-y-auto px-0.5 sm:grid-cols-4 sm:gap-3',
        'no-scrollbar pb-1',
      )}
    >
      {categories.map((cat) => {
        const Icon = getCategoryIcon(cat.name);
        const isActive = selected === cat.name;

        return (
          <motion.button
            key={cat.id}
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={() => onSelect(cat.name)}
            className={cn(
              'flex flex-col items-center gap-1.5 rounded-2xl border px-1 py-2.5 text-center transition-colors',
              isActive
                ? 'border-transparent shadow-md'
                : 'border-border/50 bg-secondary/25 hover:bg-secondary/40',
            )}
            style={
              isActive
                ? {
                    backgroundColor: `${cat.color}22`,
                    boxShadow: `0 8px 24px -12px ${cat.color}66`,
                  }
                : undefined
            }
          >
            <span
              className={cn(
                'flex h-11 w-11 items-center justify-center rounded-xl border transition-colors sm:h-12 sm:w-12',
                isActive ? 'border-transparent text-white' : 'border-border/30 bg-background/60 text-muted-foreground',
              )}
              style={
                isActive
                  ? { backgroundColor: cat.color, color: '#fff' }
                  : undefined
              }
            >
              <Icon className="h-5 w-5 sm:h-[22px] sm:w-[22px]" strokeWidth={2} />
            </span>
            <span
              className={cn(
                'line-clamp-2 min-h-[2rem] w-full px-0.5 text-[10px] font-semibold leading-tight sm:text-[11px]',
                isActive ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {cat.name}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
