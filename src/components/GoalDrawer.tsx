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
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { AmountInput } from './AmountInput';
import { X, Target, Calendar as CalendarIcon, AlignLeft, Trash2 } from 'lucide-react';
import { getGoalIcon, GOAL_ICON_OPTIONS } from '@/lib/icons';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export function GoalDrawer() {
    const { isGoalDrawerOpen, closeGoalDrawer, editingGoalId } = useUI();
    const { goals, addGoal, updateGoal, deleteGoal, profile } = useFinance();
    const { t } = useLocale();

    const [formName, setFormName] = useState('');
    const [targetAmount, setTargetAmount] = useState('0');
    const [formDeadline, setFormDeadline] = useState<Date | undefined>(undefined);
    const [formIcon, setFormIcon] = useState('target');

    useEffect(() => {
        if (!isGoalDrawerOpen) return;
        if (editingGoalId) {
            const g = goals.find((x) => x.id === editingGoalId);
            if (g) {
                setFormName(g.name);
                setTargetAmount(g.target_amount.toString());
                setFormDeadline(g.deadline ? new Date(g.deadline) : undefined);
                setFormIcon(g.icon);
            }
        } else {
            setFormName('');
            setTargetAmount('0');
            setFormDeadline(undefined);
            setFormIcon('target');
        }
    }, [editingGoalId, goals, isGoalDrawerOpen]);

    const handleSubmit = () => {
        if (!formName.trim() || parseFloat(targetAmount) <= 0) return;

        const data = {
            name: formName.trim(),
            target_amount: parseFloat(targetAmount),
            current_amount: 0, // Simplified: progress tracked via transactions
            deadline: formDeadline ? formDeadline.toISOString().split('T')[0] : '',
            icon: formIcon,
        };

        if (editingGoalId) {
            const existing = goals.find(g => g.id === editingGoalId);
            updateGoal({
                ...data,
                current_amount: existing?.current_amount || 0, // Persist progress if editing
                id: editingGoalId
            });
        } else {
            addGoal(data);
        }
        closeGoalDrawer();
    };

    const handleDelete = () => {
        if (editingGoalId && confirm('Are you sure you want to delete this savings goal?')) {
            deleteGoal(editingGoalId);
            closeGoalDrawer();
        }
    };

    return (
        <Drawer open={isGoalDrawerOpen} onOpenChange={(open) => !open && closeGoalDrawer()}>
            <DrawerContent className="max-h-[96dvh] rounded-t-[24px] border-t border-border/50 p-0 overflow-hidden bg-background">
                <div className="mx-auto mt-2 mb-1 h-1 w-10 rounded-full bg-muted-foreground/25" />

                <div className="max-h-[inherit] overflow-y-auto px-5 pb-8 pt-1 no-scrollbar">
                    <DrawerHeader className="space-y-4 px-0 pb-4 pt-0">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <DrawerTitle className="text-lg font-bold tracking-tight pr-2">
                                    {editingGoalId ? 'Edit Goal' : 'Create New Goal'}
                                </DrawerTitle>
                                <p className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5 mt-0.5 uppercase tracking-wider opacity-70">
                                    <Target className="w-3 h-3 text-primary" strokeWidth={2.5} />
                                    Wealth Generator
                                </p>
                            </div>
                            <div className="flex items-center gap-1">
                                {editingGoalId && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={handleDelete}
                                        className="h-10 w-10 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                                        aria-label="Delete"
                                    >
                                        <Trash2 className="h-5 w-5" />
                                    </Button>
                                )}
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={closeGoalDrawer}
                                    className="h-10 w-10 shrink-0 rounded-full"
                                    aria-label="Close"
                                >
                                    <X className="h-5 w-5" />
                                </Button>
                            </div>
                        </div>

                        <AmountInput value={targetAmount} onChange={setTargetAmount} currency={profile.currency} />
                    </DrawerHeader>

                    <div className="space-y-6 pt-2">
                        <section className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Goal Identity
                                </label>
                                <div className="flex gap-2">
                                    <div className="shrink-0">
                                        <Select value={formIcon} onValueChange={setFormIcon}>
                                            <SelectTrigger className="h-12 w-14 rounded-2xl bg-secondary/25 border-border/50 p-0 flex items-center justify-center">
                                                {(() => {
                                                    const Icon = getGoalIcon(formIcon);
                                                    return <Icon className="w-5 h-5 text-primary" />;
                                                })()}
                                            </SelectTrigger>
                                            <SelectContent className="rounded-2xl border-border/40">
                                                {GOAL_ICON_OPTIONS.map(key => {
                                                    const Icon = getGoalIcon(key);
                                                    return (
                                                        <SelectItem key={key} value={key}>
                                                            <div className="flex items-center gap-2">
                                                                <Icon className="w-4 h-4" />
                                                                <span className="capitalize text-xs font-medium">{key}</span>
                                                            </div>
                                                        </SelectItem>
                                                    );
                                                })}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="relative flex-1">
                                        <AlignLeft className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                                        <Input
                                            placeholder="e.g. New Car, Dream Wedding"
                                            value={formName}
                                            onChange={e => setFormName(e.target.value)}
                                            className="h-12 rounded-2xl border-border/50 bg-secondary/25 pl-11 text-[14px] font-semibold"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Target Date (Optional)
                                </label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className={cn(
                                                "w-full h-12 rounded-2xl border-border/50 bg-secondary/25 text-left font-medium px-4 flex items-center gap-3",
                                                !formDeadline && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="h-5 w-5 text-muted-foreground" strokeWidth={2} />
                                            {formDeadline ? format(formDeadline, "PPP") : "Pick a deadline"}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0 rounded-2xl border-border/40 bg-background shadow-2xl" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={formDeadline}
                                            onSelect={setFormDeadline}
                                            initialFocus
                                            className="rounded-2xl"
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </section>
                    </div>

                    <DrawerFooter className="px-0 pt-10">
                        <Button
                            type="button"
                            onClick={handleSubmit}
                            disabled={!formName.trim() || parseFloat(targetAmount) <= 0}
                            className="h-14 w-full rounded-2xl text-base font-bold finance-gradient border-0 shadow-lg shadow-primary/20 disabled:opacity-50 transition-all active:scale-[0.98]"
                        >
                            {editingGoalId ? 'Save Goal Changes' : 'Launch New Goal'}
                        </Button>
                    </DrawerFooter>
                </div>
            </DrawerContent>
        </Drawer>
    );
}
