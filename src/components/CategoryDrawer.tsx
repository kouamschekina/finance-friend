import { useState, useEffect } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { useUI } from '@/contexts/UIContext';
import { useLocale } from '@/contexts/LocaleContext';
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerFooter,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { AmountInput } from './AmountInput';
import { CategoryGrid } from './CategoryGrid';
import { X, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';

export function CategoryDrawer() {
    const { isCategoryDrawerOpen, closeCategoryDrawer, editingCategoryId } = useUI();
    const { categories, updateCategory, profile } = useFinance();
    const { t } = useLocale();

    const [selectedCategory, setSelectedCategory] = useState('');
    const [formBudget, setFormBudget] = useState('0');

    useEffect(() => {
        if (!isCategoryDrawerOpen) return;
        if (editingCategoryId) {
            const c = categories.find((x) => x.id === editingCategoryId);
            if (c) {
                setSelectedCategory(c.name);
                setFormBudget(c.budget_limit.toString());
            }
        } else {
            setSelectedCategory(categories[0]?.name || '');
            setFormBudget('0');
        }
    }, [editingCategoryId, categories, isCategoryDrawerOpen]);

    const handleSubmit = () => {
        const cat = categories.find(c => c.name === selectedCategory);
        if (!cat) return;

        const numLimit = parseFloat(formBudget) || 0;

        updateCategory({
            ...cat,
            budget_limit: numLimit
        });

        closeCategoryDrawer();
    };

    return (
        <Drawer open={isCategoryDrawerOpen} onOpenChange={(open) => !open && closeCategoryDrawer()}>
            <DrawerContent className="max-h-[96dvh] rounded-t-[24px] border-t border-border/50 p-0 overflow-hidden bg-background">
                <div className="mx-auto mt-2 mb-1 h-1 w-10 rounded-full bg-muted-foreground/25" />

                <div className="max-h-[inherit] overflow-y-auto px-5 pb-8 pt-1 no-scrollbar">
                    <DrawerHeader className="space-y-4 px-0 pb-4 pt-0">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <DrawerTitle className="text-lg font-bold tracking-tight pr-2">
                                    {editingCategoryId ? 'Edit Budget' : 'Set Budget Limit'}
                                </DrawerTitle>
                                <p className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5 mt-0.5 uppercase tracking-wider opacity-70">
                                    <Wallet className="w-3 h-3 text-primary" strokeWidth={2.5} />
                                    Accountability Flow
                                </p>
                            </div>
                            <div className="flex items-center gap-1">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={closeCategoryDrawer}
                                    className="h-10 w-10 shrink-0 rounded-full"
                                    aria-label="Close"
                                >
                                    <X className="h-5 w-5" />
                                </Button>
                            </div>
                        </div>

                        <AmountInput value={formBudget} onChange={setFormBudget} currency={profile.currency} />
                    </DrawerHeader>

                    <div className="space-y-8 pt-4">
                        <section>
                            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Select Category
                            </h3>
                            <CategoryGrid
                                categories={categories}
                                onSelect={setSelectedCategory}
                                selected={selectedCategory}
                            />
                        </section>

                        <p className="text-[11px] text-muted-foreground font-medium text-center italic px-4">
                            Select a category above and enter your monthly spending limit using the keypad.
                        </p>
                    </div>

                    <DrawerFooter className="px-0 pt-10">
                        <Button
                            type="button"
                            onClick={handleSubmit}
                            disabled={!selectedCategory}
                            className={cn(
                                "h-14 w-full rounded-2xl text-base font-bold finance-gradient border-0 shadow-lg shadow-primary/20 transition-all active:scale-[0.98]",
                                !selectedCategory && "opacity-50 grayscale"
                            )}
                        >
                            Save Budget Limit
                        </Button>
                    </DrawerFooter>
                </div>
            </DrawerContent>
        </Drawer>
    );
}
