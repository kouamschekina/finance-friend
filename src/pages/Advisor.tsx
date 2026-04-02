import { useState, useRef, useEffect, useMemo } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { getCurrentMonthTransactions, getPreviousMonthTransactions, formatCurrency, getCategorySpending } from '@/lib/finance-store';
import { Brain, Send, Sparkles, TrendingDown, PiggyBank, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

type Msg = { role: 'user' | 'assistant'; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/financial-advisor`;

const QUICK_PROMPTS = [
  { icon: TrendingDown, label: 'Why am I overspending?', prompt: 'Analyze my spending patterns. Where am I spending too much and how can I cut back?' },
  { icon: PiggyBank, label: 'How to save more?', prompt: 'Based on my income and expenses, give me a concrete plan to increase my savings rate.' },
  { icon: Sparkles, label: 'Financial health check', prompt: 'Give me a comprehensive financial health assessment based on my current data.' },
];

export default function Advisor() {
  const { transactions, categories, profile, goals } = useFinance();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
        return spent > 0 ? `${c.name}: ${formatCurrency(spent, profile.currency)}${c.budgetLimit ? ` (budget: ${formatCurrency(c.budgetLimit, profile.currency)}, ${((spent / c.budgetLimit) * 100).toFixed(0)}% used)` : ''}` : null;
      })
      .filter(Boolean)
      .join('\n');

    const goalsInfo = goals.map(g => {
      const pct = ((g.currentAmount / g.targetAmount) * 100).toFixed(0);
      return `${g.name}: ${formatCurrency(g.currentAmount, profile.currency)} / ${formatCurrency(g.targetAmount, profile.currency)} (${pct}%)`;
    }).join('\n');

    return `User: ${profile.name || 'Anonymous'}
Currency: ${profile.currency}
Monthly Income (set): ${formatCurrency(profile.monthlyIncome, profile.currency)}

This Month:
- Income: ${formatCurrency(totalIncome, profile.currency)}
- Expenses: ${formatCurrency(totalExpenses, profile.currency)}
- Net: ${formatCurrency(totalIncome - totalExpenses, profile.currency)}
- Savings Rate: ${savingsRate.toFixed(1)}%
- Expense change vs last month: ${prevExpenses > 0 ? ((totalExpenses - prevExpenses) / prevExpenses * 100).toFixed(1) + '%' : 'N/A'}

Spending by Category (this month):
${categoryBreakdown || 'No expenses yet'}

Savings Goals:
${goalsInfo || 'No goals set'}

Total transactions: ${transactions.length}`;
  }, [transactions, categories, profile, goals]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: Msg = { role: 'user', content: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    let assistantSoFar = '';
    const allMessages = [...messages, userMsg];

    try {
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: allMessages.map(m => ({ role: m.role, content: m.content })),
          financialContext,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || `Error ${resp.status}`);
      }

      if (!resp.body) throw new Error('No response body');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantSoFar += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
                }
                return [...prev, { role: 'assistant', content: assistantSoFar }];
              });
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Failed to get response');
      // Remove the user message if we got no response
      if (!assistantSoFar) {
        setMessages(prev => prev.slice(0, -1));
      }
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

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] lg:h-[calc(100vh-6rem)] animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="hidden lg:block">
          <h1 className="text-2xl font-bold text-foreground">AI Advisor</h1>
          <p className="text-muted-foreground text-sm">Your personal financial assistant</p>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setMessages([])} className="gap-1.5 text-muted-foreground ml-auto">
            <RotateCcw className="w-3.5 h-3.5" /> Clear
          </Button>
        )}
      </div>

      {/* Chat area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pb-4 min-h-0">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 px-4">
            <div className="w-16 h-16 rounded-2xl finance-gradient flex items-center justify-center shadow-lg" style={{ boxShadow: 'var(--shadow-glow)' }}>
              <Brain className="w-8 h-8 text-primary-foreground" />
            </div>
            <div className="text-center">
              <h2 className="text-lg font-bold text-foreground mb-1">FinWise AI</h2>
              <p className="text-muted-foreground text-sm max-w-xs">Ask me anything about your finances. I analyze your real data to give personalized advice.</p>
            </div>
            <div className="w-full max-w-sm space-y-2">
              {QUICK_PROMPTS.map((qp, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(qp.prompt)}
                  className="w-full finance-card p-3 flex items-center gap-3 text-left hover:border-primary/30 transition-colors active:scale-[0.98]"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <qp.icon className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm font-medium text-foreground">{qp.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-br-md'
                  : 'finance-card rounded-bl-md'
              }`}>
                {msg.role === 'assistant' ? (
                  <div className="flex items-start gap-2">
                    <Brain className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{msg.content}</div>
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed">{msg.content}</p>
                )}
              </div>
            </div>
          ))
        )}
        {isLoading && messages[messages.length - 1]?.role === 'user' && (
          <div className="flex justify-start">
            <div className="finance-card rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-primary" />
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex gap-2 pt-2">
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your finances..."
          rows={1}
          className="flex-1 resize-none rounded-xl bg-secondary border-0 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <Button
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || isLoading}
          size="icon"
          className="rounded-xl h-11 w-11 flex-shrink-0"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
