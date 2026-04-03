import * as React from 'react';
import { addDays, format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { useFinance } from '@/contexts/FinanceContext';

export function DateRangePicker({
    className,
}: React.HTMLAttributes<HTMLDivElement>) {
    const { dateRange, setDateRange } = useFinance();

    const range: DateRange | undefined = React.useMemo(() => ({
        from: parseISO(dateRange.from),
        to: parseISO(dateRange.to),
    }), [dateRange]);

    const handleSelect = (newRange: DateRange | undefined) => {
        if (newRange?.from && newRange?.to) {
            setDateRange({
                from: format(newRange.from, 'yyyy-MM-dd'),
                to: format(newRange.to, 'yyyy-MM-dd'),
            });
        } else if (newRange?.from) {
            // Allow selecting just a start date temporarily
            // But we won't update the global state until we have both or just use one
        }
    };

    return (
        <div className={cn('grid gap-2', className)}>
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        id="date"
                        variant={"outline"}
                        className={cn(
                            "w-[240px] justify-start text-left font-black text-xs uppercase tracking-widest h-10 px-4 rounded-xl border-2 border-primary/10 bg-background hover:bg-primary/5 hover:border-primary/20 transition-all",
                            !range && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-3.5 w-3.5 text-primary" />
                        {range?.from ? (
                            range.to ? (
                                <>
                                    {format(range.from, "LLL dd")} - {format(range.to, "LLL dd")}
                                </>
                            ) : (
                                format(range.from, "LLL dd, y")
                            )
                        ) : (
                            <span>Pick a date range</span>
                        )}
                        <ChevronDown className="ml-auto h-3.5 w-3.5 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-2xl border-none shadow-2xl" align="end">
                    <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={range?.from}
                        selected={range}
                        onSelect={handleSelect}
                        numberOfMonths={1}
                        className="rounded-2xl"
                    />
                    <div className="p-3 border-t border-primary/5 grid grid-cols-2 gap-2 bg-primary/5">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-[10px] font-black uppercase tracking-tight h-8 rounded-lg"
                            onClick={() => {
                                const start = startOfMonth(new Date());
                                const end = endOfMonth(new Date());
                                setDateRange({
                                    from: format(start, 'yyyy-MM-dd'),
                                    to: format(end, 'yyyy-MM-dd'),
                                });
                            }}
                        >
                            This Month
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-[10px] font-black uppercase tracking-tight h-8 rounded-lg"
                            onClick={() => {
                                const end = new Date();
                                const start = addDays(end, -30);
                                setDateRange({
                                    from: format(start, 'yyyy-MM-dd'),
                                    to: format(end, 'yyyy-MM-dd'),
                                });
                            }}
                        >
                            Last 30 Days
                        </Button>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
}
