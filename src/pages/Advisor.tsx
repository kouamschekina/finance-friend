import { useState, useEffect, useMemo } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { getCurrentMonthTransactions, getPreviousMonthTransactions, formatCurrency, getCategorySpending } from '@/lib/finance-store';
import {
  Brain, Send, TrendingDown, PiggyBank, Bot, User, Stars,
  History, Plus, ChevronLeft, Trash2, MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import { useRef } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
type Msg = { role: 'user' | 'assistant'; content: string };
interface ChatSession {
  id: string;
  title: string;
  messages: Msg[];
  createdAt: string;
  updatedAt: string;
}

// ─── localStorage helpers ─────────────────────────────────────────────────────
const SESSIONS_KEY = 'fenowa-advisor-sessions';
const ACTIVE_KEY   = 'fenowa-advisor-active';

const readSessions  = (): ChatSession[] => { try { return JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]'); } catch { return []; } };
const writeSessions = (s: ChatSession[]) => localStorage.setItem(SESSIONS_KEY, JSON.stringify(s));
const readActiveId  = (): string | null  => localStorage.getItem(ACTIVE_KEY);
const writeActiveId = (id: string | null) => id ? localStorage.setItem(ACTIVE_KEY, id) : localStorage.removeItem(ACTIVE_KEY);

const deriveTitle = (msgs: Msg[]) => {
  const first = msgs.find(m => m.role === 'user');
  if (!first) return 'New conversation';
  return first.content.length > 52 ? first.content.slice(0, 52) + '…' : first.content;
};

// ─── Module-level store ───────────────────────────────────────────────────────
// localStorage is the single source of truth. Module vars are a write-through
// cache — on every component mount we re-sync from localStorage so production
// builds (where modules can re-execute) always get fresh data.

let _sessions: ChatSession[] = [];
let _activeId: string | null = null;

function syncFromStorage() {
  _sessions = readSessions();
  const id = readActiveId();
  if (id && _sessions.find(s => s.id === id)) {
    _activeId = id;
  } else if (_sessions.length > 0) {
    _activeId = _sessions[0].id;
    writeActiveId(_activeId);
  } else {
    _activeId = null;
  }
}

// Initial sync
syncFromStorage();

const _subs = new Set<() => void>();
const notify = () => _subs.forEach(fn => fn());

function storeCommit(sessions: ChatSession[]) {
  _sessions = sessions;
  writeSessions(sessions);
  notify();
}

function storeSetActive(id: string | null) {
  _activeId = id;
  writeActiveId(id);
  notify();
}

function useStore() {
  // Sync from localStorage synchronously so the first render is correct —
  // no flash of empty state before useEffect fires.
  syncFromStorage();

  const [tick, setTick] = useState(0);

  useEffect(() => {
    const fn = () => setTick(t => t + 1);
    _subs.add(fn);
    return () => { _subs.delete(fn); };
  }, []);

  void tick;
  return { sessions: _sessions, activeId: _activeId };
}
// ─────────────────────────────────────────────────────────────────────────────

export default function Advisor() {
  const { transactions, categories, profile, goals } = useFinance();
  const { t } = useTranslation();
  const { sessions, activeId } = useStore();

  const [showHistory, setShowHistory] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeSession = sessions.find(s => s.id === activeId) ?? null;
  const messages = activeSession?.messages ?? [];

  const QUICK_PROMPTS = [
    { icon: TrendingDown, label: t('advisor.prompt_spending'), prompt: t('advisor.prompt_spending_text') },
    { icon: PiggyBank,    label: t('advisor.prompt_savings'),  prompt: t('advisor.prompt_savings_text') },
    { icon: Stars,        label: t('advisor.prompt_health'),   prompt: t('advisor.prompt_health_text') },
  ];

  const financialContext = useMemo(() => {
    const current  = getCurrentMonthTransactions(transactions);
    const previous = getPreviousMonthTransactions(transactions);
    const totalIncome   = current.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const totalExpenses = current.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const prevExpenses  = previous.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const savingsRate   = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome * 100) : 0;
    const categoryBreakdown = categories
      .map(c => { const spent = getCategorySpending(transactions, c.name); return spent > 0 ? `${c.name}: ${formatCurrency(spent, profile.currency)}${c.budget_limit ? ` (budget: ${formatCurrency(c.budget_limit, profile.currency)}, ${((spent/c.budget_limit)*100).toFixed(0)}% used)` : ''}` : null; })
      .filter(Boolean).join('\n');
    const goalsInfo = goals.map(g => `${g.name}: ${formatCurrency(g.current_amount, profile.currency)} / ${formatCurrency(g.target_amount, profile.currency)} (${((g.current_amount/g.target_amount)*100).toFixed(0)}%)`).join('\n');
    return `User: ${profile.name||'Anonymous'} | Currency: ${profile.currency} | Monthly Income: ${formatCurrency(profile.monthly_income, profile.currency)}
This Month: Income: ${formatCurrency(totalIncome, profile.currency)}, Expenses: ${formatCurrency(totalExpenses, profile.currency)}, Savings Rate: ${savingsRate.toFixed(1)}%
Expense change vs last month: ${prevExpenses > 0 ? ((totalExpenses-prevExpenses)/prevExpenses*100).toFixed(1)+'%' : 'N/A'}
Categories:\n${categoryBreakdown||'None'}
Goals:\n${goalsInfo||'None'}`;
  }, [transactions, categories, profile, goals]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length, isLoading]);

  const startNewChat = () => {
    const id = crypto.randomUUID();
    storeCommit([{ id, title: 'New conversation', messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, ..._sessions]);
    storeSetActive(id);
    setShowHistory(false);
    setInput('');
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = _sessions.filter(s => s.id !== id);
    storeCommit(updated);
    if (_activeId === id) storeSetActive(updated.length > 0 ? updated[0].id : null);
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const groqKey = import.meta.env.VITE_GROQ_API_KEY || localStorage.getItem('GROQ_API_KEY');
    if (!groqKey) { toast.error(t('advisor.unavailable')); return; }

    // Ensure active session
    let sid = _activeId;
    if (!sid) {
      sid = crypto.randomUUID();
      storeCommit([{ id: sid, title: 'New conversation', messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, ..._sessions]);
      storeSetActive(sid);
    }

    const userMsg: Msg = { role: 'user', content: text.trim() };
    const prevMsgs = _sessions.find(s => s.id === sid)?.messages ?? [];
    const withUser = [...prevMsgs, userMsg];

    // Persist user message immediately
    storeCommit(_sessions.map(s => s.id === sid ? { ...s, messages: withUser, title: deriveTitle(withUser), updatedAt: new Date().toISOString() } : s));

    setInput('');
    setIsLoading(true);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: `You are Fenowa AI, a world-class financial advisor powered by Groq. Provide strategic, empathetic, and highly actionable financial advice based on the user's real data. Be precise with numbers.\n\nUSER FINANCIAL CONTEXT:\n${financialContext}` },
            ...withUser.map(m => ({ role: m.role, content: m.content })),
          ],
          temperature: 0.7, max_tokens: 1024, stream: false,
        }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error((e as any).error?.message || 'Advisor service failed.'); }
      const data = await res.json();
      const aiContent = (data as any).choices[0]?.message?.content || 'I encountered an error.';
      // Read fresh from module var — may have changed during await
      storeCommit(_sessions.map(s => s.id === sid ? { ...s, messages: [...s.messages, { role: 'assistant', content: aiContent }], updatedAt: new Date().toISOString() } : s));
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Advisor Service Unavailable');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } };
  const handleInput   = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden w-full max-w-3xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-3 shrink-0 gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {showHistory ? (
            <button
              onClick={() => setShowHistory(false)}
              className="w-9 h-9 rounded-xl bg-secondary/50 border border-border/40 flex items-center justify-center shrink-0"
            >
              <ChevronLeft className="w-4 h-4 text-foreground" />
            </button>
          ) : (
            <div className="w-9 h-9 rounded-xl finance-gradient flex items-center justify-center shadow-lg shadow-primary/20 shrink-0">
              <Brain className="w-4 h-4 text-white" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-base font-black tracking-tight text-foreground leading-none mb-0.5 truncate">
              {showHistory ? 'History' : t('advisor.title')}
            </h1>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest leading-none flex items-center gap-1">
              {!showHistory && <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shrink-0" />}
              <span className="truncate">
                {showHistory
                  ? `${sessions.length} conversation${sessions.length !== 1 ? 's' : ''}`
                  : t('advisor.subtitle')}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {!showHistory && (
            <button
              onClick={() => setShowHistory(true)}
              className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-secondary/50 border border-border/40 text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-colors"
              title="History"
            >
              <History className="w-4 h-4" />
              {sessions.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                  {sessions.length > 9 ? '9+' : sessions.length}
                </span>
              )}
            </button>
          )}
          <button
            onClick={startNewChat}
            className="flex items-center justify-center w-9 h-9 rounded-xl bg-secondary/50 border border-border/40 text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-colors"
            title="New chat"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {showHistory ? (
          <motion.div key="history" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }} className="flex-1 overflow-y-auto no-scrollbar min-h-0">
            {sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 py-16 text-center px-4">
                <div className="w-14 h-14 rounded-2xl bg-secondary/30 border border-border/40 flex items-center justify-center">
                  <MessageSquare className="w-7 h-7 text-muted-foreground/40" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground mb-1">No conversations yet</p>
                  <p className="text-xs text-muted-foreground">Start a new chat to get financial advice</p>
                </div>
                <Button size="sm" onClick={startNewChat} className="rounded-xl mt-1">
                  <Plus className="w-4 h-4 mr-1.5" />Start a conversation
                </Button>
              </div>
            ) : (
              <div className="space-y-2 pb-28 overflow-hidden">
                {sessions.map(session => (
                  <div key={session.id} className="relative w-full overflow-hidden">
                    <button
                      onClick={() => { storeSetActive(session.id); setShowHistory(false); }}
                      className={cn(
                        'w-full text-left p-3.5 rounded-2xl border transition-all flex items-center gap-3 pr-11 overflow-hidden',
                        session.id === activeId
                          ? 'bg-primary/10 border-primary/30'
                          : 'bg-secondary/20 border-border/30 active:bg-secondary/40',
                      )}
                    >
                      <div className={cn(
                        'w-8 h-8 rounded-xl flex items-center justify-center shrink-0',
                        session.id === activeId ? 'finance-gradient text-white' : 'bg-secondary/60 text-muted-foreground',
                      )}>
                        <Bot className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <p className={cn(
                          'text-sm font-bold truncate leading-tight mb-0.5',
                          session.id === activeId ? 'text-primary' : 'text-foreground',
                        )}>
                          {session.title}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {session.messages.length} msg{session.messages.length !== 1 ? 's' : ''}
                          {' · '}
                          {formatDistanceToNow(new Date(session.updatedAt), { addSuffix: true })}
                        </p>
                      </div>
                    </button>
                    <button
                      onClick={e => deleteSession(session.id, e)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-xl text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 active:text-destructive active:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div key="chat" initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }} className="flex flex-col flex-1 min-h-0 overflow-hidden">

            {/* Chat scroll area */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar min-h-0 overscroll-contain">
              {messages.length === 0 ? (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center h-full gap-5 py-4 px-2">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-2xl bg-secondary/30 flex items-center justify-center relative z-10 border border-border/50">
                      <Bot className="w-8 h-8 text-primary" />
                    </div>
                    <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 3, repeat: Infinity }}
                      className="absolute inset-0 bg-primary/20 rounded-2xl blur-2xl z-0" />
                  </div>
                  <div className="text-center space-y-1.5 px-2">
                    <h2 className="text-xl font-black text-foreground tracking-tight">{t('advisor.how_can_i_help')}</h2>
                    <p className="text-xs text-muted-foreground font-medium max-w-[260px] mx-auto">
                      {t('advisor.analyzed_records', { count: transactions.length })}
                    </p>
                  </div>
                  <div className="w-full space-y-2">
                    {QUICK_PROMPTS.map((qp, i) => (
                      <motion.button key={i} whileTap={{ scale: 0.98 }} onClick={() => sendMessage(qp.prompt)}
                        className="w-full p-3 rounded-2xl bg-secondary/30 border border-border/20 text-left active:bg-secondary/50 transition-all flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-background flex items-center justify-center shadow-sm shrink-0">
                          <qp.icon className="w-3.5 h-3.5 text-primary" />
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
                <div className="space-y-4 pb-2 px-0.5">
                  {messages.map((msg, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} layout
                      className={cn('flex items-end gap-2', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
                      {/* Avatar — hidden on mobile to save space, shown on sm+ */}
                      <div className={cn(
                        'hidden sm:flex w-7 h-7 rounded-lg items-center justify-center flex-shrink-0 border',
                        msg.role === 'user' ? 'bg-secondary text-foreground border-border/50' : 'finance-gradient text-white border-transparent',
                      )}>
                        {msg.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                      </div>
                      <div className={cn(
                        'max-w-[88%] sm:max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed',
                        msg.role === 'user'
                          ? 'bg-primary text-white font-medium rounded-br-sm shadow-md shadow-primary/10'
                          : 'bg-secondary/50 border border-border/30 text-foreground rounded-bl-sm',
                      )}>
                        <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                      </div>
                    </motion.div>
                  ))}
                  {isLoading && (
                    <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="flex items-end gap-2">
                      <div className="hidden sm:flex w-7 h-7 rounded-lg finance-gradient items-center justify-center text-white border border-transparent shrink-0">
                        <Bot className="w-3.5 h-3.5" />
                      </div>
                      <div className="bg-secondary/50 border border-border/30 px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-1.5">
                        {[0, 150, 300].map(d => (
                          <span key={d} className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-pulse" style={{ animationDelay: `${d}ms` }} />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </div>
              )}
            </div>

            {/* Input bar */}
            <div className="shrink-0 pt-2 pb-[calc(env(safe-area-inset-bottom,0px)+5rem)] lg:pb-4">
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={input}
                  onChange={handleInput}
                  onKeyDown={handleKeyDown}
                  placeholder={t('advisor.input_placeholder')}
                  className="w-full bg-secondary/50 border border-border/40 rounded-2xl pl-4 pr-12 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all resize-none no-scrollbar"
                  style={{ minHeight: '48px', maxHeight: '120px' }}
                />
                <div className="absolute right-1.5 bottom-1.5">
                  <Button
                    onClick={() => sendMessage(input)}
                    disabled={!input.trim() || isLoading}
                    className="w-8 h-8 rounded-xl finance-gradient border-0 shadow-md shadow-primary/20 transition-all active:scale-90"
                    size="icon"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              <p className="text-[9px] text-center text-muted-foreground/40 mt-1.5 font-bold uppercase tracking-widest">
                {t('advisor.disclaimer')}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
