import { useState, useRef, useEffect, useMemo } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { getCurrentMonthTransactions, getPreviousMonthTransactions, formatCurrency, getCategorySpending } from '@/lib/finance-store';
import { Brain, Send, TrendingDown, PiggyBank, RotateCcw, Bot, User, Stars } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

type Msg = { role: 'user' | 'assistant'; content: string };

export default function Advisor() {
  const { transactions, categories, profile, goals } = useFinance();
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const QUICK_PROMPTS = [
    { icon: TrendingDown, label: t('advisor.prompt_spending'), prompt: t('advisor.prompt_spending_text') },
    { icon: PiggyBank, label: t('advisor.prompt_savings'), prompt: t('advisor.prompt_savings_text') },
    { icon: Stars, label: t('advisor.prompt_health'), prompt: t('advisor.prompt_health_text') },
  ];

  // Build financial context for AI
  const financialContext = useMemo(() => {
    const current = getCurrentMonthTransactions(transactions);
    const previous = getPreviousMonthTransactions(transactions);
    const totalIncome = current.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const totalExpenses = current.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const prevExpenses = previous.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome * 100) : 0;

    const categoryBreakdown = categories
      .map(c => {
        const spent = getCategorySpending(transactions, c.name);
        return spent > 0 ? `${c.name}: ${formatCurrency(spent, profile.currency)}${c.budget_limit ? ` (budget: ${formatCurrency(c.budget_limit, profile.currency)}, ${((spent / c.budget_limit) * 100).toFixed(0)}% used)` : ''}` : null;
      })
      .filter(Boolean)
      .join('\n');

    const goalsInfo = goals.map(g => {
      const pct = ((g.current_amount / g.target_amount) * 100).toFixed(0);
      return `${g.name}: ${formatCurrency(g.current_amount, profile.currency)} / ${formatCurrency(g.target_amount, profile.currency)} (${pct}%)`;
    }).join('\n');

    return `User: ${profile.name || 'Anonymous'} | Currency: ${profile.currency} | Monthly Income: ${formatCurrency(profile.monthly_income, profile.currency)}
This Month: Income: ${formatCurrency(totalIncome, profile.currency)}, Expenses: ${formatCurrency(totalExpenses, profile.currency)}, Savings Rate: ${savingsRate.toFixed(1)}%
Expense change: ${prevExpenses > 0 ? ((totalExpenses - prevExpenses) / prevExpenses * 100).toFixed(1) + '%' : 'N/A'}
Categories: ${categoryBreakdown || 'None'} | Goals: ${goalsInfo || 'None'}`;
  }, [transactions, categories, profile, goals]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const groqKey = import.meta.env.VITE_GROQ_API_KEY || localStorage.getItem('GROQ_API_KEY');
    if (!groqKey) {
      toast.error(t('advisor.unavailable'));
      return;
    }

    const userMsg: Msg = { role: 'user', content: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            {
              role: 'system',
              content: `You are Fenowa AI, a world-class financial advisor powered by Groq. 
              Your goal is to provide strategic, empathetic, and highly actionable financial advice based on the user's real data.
              Always be precise with numbers. If the user is overspending, suggest realistic ways to cut back.
              If they are doing well, encourage them and suggest investment or growth strategies.
              
              USER FINANCIAL CONTEXT:
              ${financialContext}`
            },
            ...messages.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: text.trim() }
          ],
          temperature: 0.7,
          max_tokens: 1024,
          stream: false
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error((errorData as any).error?.message || 'Advisor service failed.');
      }

      const data = await response.json();
      const aiContent = (data as any).choices[0]?.message?.content || 'I encountered an error processing your data.';

      setMessages(prev => [...prev, { role: 'assistant', content: aiContent }]);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Advisor Service Unavailable');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Auto-resize textarea
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden max-w-3xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl finance-gradient flex items-center justify-center shadow-lg shadow-primary/20">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-foreground leading-none mb-1">{t('advisor.title')}</h1>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest leading-none flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              {t('advisor.subtitle')}
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMessages([])}
            className="rounded-xl h-9 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />{t('advisor.reset')}
          </Button>
        )}
      </div>

      {/* Chat area — scrollable */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar min-h-0 overscroll-contain">
        <AnimatePresence initial={false}>
          {messages.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center h-full gap-6 py-6"
            >
              <div className="relative">
                <div className="w-20 h-20 rounded-3xl bg-secondary/30 flex items-center justify-center relative z-10 border border-border/50">
                  <Bot className="w-10 h-10 text-primary" />
                </div>
                <motion.div
                  animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="absolute inset-0 bg-primary/20 rounded-3xl blur-2xl z-0"
                />
              </div>

              <div className="text-center space-y-2 px-4">
                <h2 className="text-2xl font-black text-foreground tracking-tight">{t('advisor.how_can_i_help')}</h2>
                <p className="text-sm text-muted-foreground font-medium max-w-[280px] mx-auto">
                  {t('advisor.analyzed_records', { count: transactions.length })}
                </p>
              </div>

              <div className="w-full max-w-sm space-y-2.5 px-2">
                {QUICK_PROMPTS.map((qp, i) => (
                  <motion.button
                    key={i}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => sendMessage(qp.prompt)}
                    className="w-full p-3.5 rounded-2xl bg-secondary/30 border border-border/20 text-left hover:bg-secondary/50 hover:border-primary/20 transition-all group flex items-center gap-3"
                  >
                    <div className="w-9 h-9 rounded-xl bg-background flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm shrink-0">
                      <qp.icon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground leading-tight">{qp.label}</p>
                      <p className="text-[10px] text-muted-foreground font-medium truncate">{t('advisor.strategic_assessment')}</p>
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          ) : (
            <div className="space-y-5 pb-4 px-1">
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  layout
                  className={cn(
                    "flex items-start gap-3",
                    msg.role === 'user' ? "flex-row-reverse" : "flex-row"
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-1 shadow-sm border",
                    msg.role === 'user' ? "bg-secondary text-foreground border-border/50" : "finance-gradient text-white border-transparent"
                  )}>
                    {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>

                  <div className={cn(
                    "max-w-[82%] px-4 py-3 rounded-2xl text-sm leading-relaxed",
                    msg.role === 'user'
                      ? "bg-primary text-white font-medium rounded-tr-sm shadow-md shadow-primary/10"
                      : "bg-secondary/40 backdrop-blur-sm border border-border/30 text-foreground font-medium rounded-tl-sm"
                  )}>
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </div>
                </motion.div>
              ))}

              {isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-3"
                >
                  <div className="w-8 h-8 rounded-xl finance-gradient flex items-center justify-center text-white">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="bg-secondary/40 border border-border/30 px-4 py-3.5 rounded-2xl rounded-tl-sm flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-pulse" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-pulse" style={{ animationDelay: '200ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-pulse" style={{ animationDelay: '400ms' }} />
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Input — pinned to bottom */}
      <div className="shrink-0 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+4.5rem)]">
        <div className="relative group">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={t('advisor.input_placeholder')}
            className="w-full bg-secondary/50 backdrop-blur-md border border-border/40 rounded-2xl pl-5 pr-14 py-3.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all resize-none shadow-lg no-scrollbar"
            style={{ minHeight: '52px', maxHeight: '120px' }}
          />
          <div className="absolute right-2 top-2">
            <Button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading}
              className="w-9 h-9 rounded-xl finance-gradient border-0 shadow-lg shadow-primary/20 transition-all active:scale-90"
              size="icon"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <p className="text-[10px] text-center text-muted-foreground/50 mt-2 font-bold uppercase tracking-widest">
          {t('advisor.disclaimer')}
        </p>
      </div>
    </div>
  );
}
