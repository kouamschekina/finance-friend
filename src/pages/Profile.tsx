import { useFinance } from '@/contexts/FinanceContext';
import { formatCurrency, getCurrentMonthTransactions } from '@/lib/finance-store';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  User, Settings, CreditCard, Shield, BellRing,
  Smartphone, Upload, LogOut, ChevronRight,
  Wallet, TrendingUp, Activity, BadgeCheck
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'INR', 'BRL', 'NGN'];

const StatCard = ({ label, value, icon: Icon, colorClass, delay }: any) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    className="bg-card/50 backdrop-blur-sm border border-border/40 p-4 rounded-2xl flex flex-col gap-2 group hover:border-primary/30 transition-all shadow-sm"
  >
    <div className={cn("p-2 rounded-xl w-fit", colorClass)}>
      <Icon className="w-4 h-4" />
    </div>
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">{label}</p>
      <p className="text-lg font-bold text-foreground tabular-nums">{value}</p>
    </div>
  </motion.div>
);

const SettingsRow = ({ icon: Icon, label, value, onClick, secondary, colorClass }: any) => (
  <button
    onClick={onClick}
    className="w-full flex items-center justify-between p-4 bg-card/30 hover:bg-secondary/20 transition-all group first:rounded-t-2xl last:rounded-b-2xl border-b last:border-b-0 border-border/20"
  >
    <div className="flex items-center gap-4">
      <div className={cn("p-2 rounded-xl", colorClass || "bg-secondary/50 text-muted-foreground")}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="text-left">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        {secondary && <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{secondary}</p>}
      </div>
    </div>
    <div className="flex items-center gap-2">
      {value && <span className="text-sm text-muted-foreground font-medium">{value}</span>}
      <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary transition-colors" />
    </div>
  </button>
);

export default function Profile() {
  const { profile, updateProfile, transactions } = useFinance();
  const { user, loading: authLoading, signInWithGoogle, signOut } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const authName = (user?.user_metadata?.full_name as string | undefined) ?? '';
  const authAvatarUrl = (user?.user_metadata?.avatar_url as string | undefined) ?? '';
  const displayName = authName || profile.name;
  const avatar_url = authAvatarUrl || profile.avatar_url || '';

  const current = useMemo(() => getCurrentMonthTransactions(transactions), [transactions]);
  const totalIncome = current.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpenses = current.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome * 100) : 0;

  const updateAuthName = async (name: string) => {
    if (!user) return;
    const { error } = await supabase.auth.updateUser({ data: { full_name: name } });
    if (error) {
      toast.error('Could not update name', { description: error.message });
    }
  };

  const handlePickAvatar = () => fileInputRef.current?.click();

  const handleAvatarChange = async (file: File | null) => {
    if (!user || !file) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `${user.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      const publicUrl = data.publicUrl;

      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl },
      });
      if (updateError) throw updateError;

      updateProfile({ avatar_url: publicUrl });
      toast.success('Profile photo updated');
    } catch (e: any) {
      toast.error('Could not upload photo', { description: e?.message || 'Upload failed' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-20 pt-4 px-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-1">Profile</h1>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-[0.2em] opacity-80">Sync & Security</p>
        </div>
        <div className="w-10 h-10 rounded-2xl bg-secondary/30 flex items-center justify-center border border-border/50 backdrop-blur-sm">
          <Settings className="w-5 h-5 text-muted-foreground" />
        </div>
      </div>

      {/* User Hero */}
      <div className="relative group">
        <div className="absolute inset-0 bg-primary/20 blur-[100px] rounded-full -z-10" />
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="relative">
            <div className="w-32 h-32 rounded-[40px] finance-gradient p-1 shadow-2xl relative overflow-hidden group-hover:scale-105 transition-transform duration-500">
              <div className="w-full h-full bg-card rounded-[38px] flex items-center justify-center overflow-hidden">
                {avatar_url ? (
                  <img src={avatar_url} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <User className="w-12 h-12 text-muted-foreground/40" />
                )}
              </div>
            </div>
            {user && (
              <div className="absolute -bottom-1 -right-1 w-10 h-10 rounded-2xl bg-card border-4 border-background flex items-center justify-center shadow-xl">
                <BadgeCheck className="w-6 h-6 text-primary fill-primary/10" />
              </div>
            )}
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-foreground tracking-tight">
              {displayName || 'Set your name'}
            </h2>
            <p className="text-sm text-muted-foreground font-medium">
              {user ? user.email : 'Local Account'}
            </p>
          </div>

          {!user && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-sm bg-primary/10 border border-primary/20 p-6 rounded-3xl space-y-4"
            >
              <div className="space-y-1">
                <p className="text-sm font-bold text-primary">Enable Cloud Sync</p>
                <p className="text-xs text-muted-foreground">Sign in to sync your finances across all your devices securely.</p>
              </div>
              <Button
                onClick={() => signInWithGoogle()}
                disabled={authLoading}
                className="w-full h-12 rounded-2xl finance-gradient border-none shadow-lg shadow-primary/25 hover:scale-[1.02] transition-transform"
              >
                Continue with Google
              </Button>
            </motion.div>
          )}

          {user && (
            <div className="flex gap-2">
              <Button
                onClick={handlePickAvatar}
                disabled={uploading}
                variant="secondary"
                size="sm"
                className="rounded-xl h-10 px-4"
              >
                <Upload className="w-4 h-4 mr-2" />
                {uploading ? 'Uploading…' : 'Change Photo'}
              </Button>
              <Button
                onClick={() => signOut()}
                variant="ghost"
                size="sm"
                className="rounded-xl h-10 px-4 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign out
              </Button>
            </div>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleAvatarChange(e.target.files?.[0] ?? null)} />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard delay={0.1} label="Activity" value={transactions.length} icon={Activity} colorClass="bg-blue-500/10 text-blue-500" />
        <StatCard delay={0.2} label="Savings" value={`${savingsRate.toFixed(0)}%`} icon={TrendingUp} colorClass="bg-emerald-500/10 text-emerald-500" />
        <StatCard delay={0.3} label="Currency" value={profile.currency} icon={Wallet} colorClass="bg-amber-500/10 text-amber-500" />
      </div>

      {/* Settings Sections */}
      <div className="space-y-6 pb-4">
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.2em] pl-1">Configuration</p>
          <div className="bg-card/50 backdrop-blur-sm border border-border/40 rounded-2xl overflow-hidden divide-y divide-border/20">
            <div className="p-4 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest pl-1">Display Name</label>
                <Input
                  value={displayName}
                  onChange={e => updateProfile({ name: e.target.value })}
                  onBlur={(e) => { if (user) void updateAuthName(e.target.value); }}
                  className="h-12 rounded-xl bg-secondary/20 border-border/20 focus:border-primary/50 transition-all font-medium"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest pl-1">Primary Currency</label>
                <Select value={profile.currency} onValueChange={v => updateProfile({ currency: v })}>
                  <SelectTrigger className="h-12 rounded-xl bg-secondary/20 border-border/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border/40">
                    {CURRENCIES.map(c => <SelectItem key={c} value={c} className="rounded-lg my-0.5">{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest pl-1">Monthly Target Income</label>
                <Input
                  type="number"
                  value={profile.monthly_income}
                  onChange={e => updateProfile({ monthly_income: parseFloat(e.target.value) || 0 })}
                  className="h-12 rounded-xl bg-secondary/20 border-border/20 transition-all font-bold tabular-nums"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between pl-1">
                  <label className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest">xAI (Grok) API Key</label>
                  <a href="https://console.x.ai/" target="_blank" rel="noopener noreferrer" className="text-[9px] text-primary font-bold hover:underline">Get Key</a>
                </div>
                <Input
                  type="password"
                  placeholder="xai-..."
                  value={profile.xai_api_key || ''}
                  onChange={e => updateProfile({ xai_api_key: e.target.value })}
                  className="h-12 rounded-xl bg-secondary/20 border-border/20 transition-all font-mono text-xs"
                />
                <p className="px-1 text-[9px] text-muted-foreground/60 font-medium">Your key is stored securely in your private cloud profile.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.2em] pl-1">Preferences</p>
          <div className="border border-border/40 rounded-2xl overflow-hidden shadow-sm">
            <SettingsRow icon={Shield} label="Privacy Guard" secondary="Enabled" colorClass="bg-emerald-500/10 text-emerald-500" />
            <SettingsRow icon={BellRing} label="Smart Alerts" secondary="Critical Only" colorClass="bg-amber-500/10 text-amber-500" />
            <SettingsRow icon={Smartphone} label="Biometric Link" value="FaceID" colorClass="bg-blue-500/10 text-blue-500" />
          </div>
        </div>
      </div>
    </div>
  );
}

