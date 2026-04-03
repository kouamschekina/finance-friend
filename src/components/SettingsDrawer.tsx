import { useUI } from '@/contexts/UIContext';
import { useFinance } from '@/contexts/FinanceContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useLocale } from '@/contexts/LocaleContext';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  X,
  Brain,
  Key,
  User,
  Palette,
  Globe,
  MessageCircle,
  Check,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  THEME_IDS,
  THEME_LABELS,
  type ThemeId,
} from '@/lib/theme';
import {
  LOCALE_CODES,
  LOCALE_LABELS,
  type LocaleCode,
} from '@/lib/i18n';

const GROQ_KEY = 'GROQ_API_KEY';

export function SettingsDrawer() {
  const { isSettingsDrawerOpen, closeSettingsDrawer } = useUI();
  const { profile } = useFinance();
  const { theme, setTheme } = useTheme();
  const { locale, setLocale, t } = useLocale();
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    if (isSettingsDrawerOpen) {
      setApiKey(localStorage.getItem(GROQ_KEY) || '');
    }
  }, [isSettingsDrawerOpen]);

  const handleSaveApiKey = () => {
    localStorage.setItem(GROQ_KEY, apiKey.trim());
    toast.success('API key saved on this device');
  };

  return (
    <Drawer open={isSettingsDrawerOpen} onOpenChange={(open) => !open && closeSettingsDrawer()}>
      <DrawerContent className="max-h-[90dvh] rounded-t-[24px] border-t border-border/50 p-0 overflow-hidden bg-background">
        <div className="mx-auto mt-2 mb-1 h-1 w-10 rounded-full bg-muted-foreground/25" />

        <div className="flex max-h-[inherit] flex-col">
          <DrawerHeader className="flex shrink-0 flex-row items-center justify-between gap-3 border-b border-border/40 px-5 py-4">
            <DrawerTitle className="text-lg font-bold tracking-tight">
              {t('settings.title')}
            </DrawerTitle>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={closeSettingsDrawer}
              className="h-10 w-10 rounded-full"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </Button>
          </DrawerHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-10 pt-2 no-scrollbar">
            {/* Profile */}
            <section className="mb-8">
              <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <User className="h-3.5 w-3.5" strokeWidth={2.2} />
                {t('settings.account')}
              </p>
              <Link
                to="/profile"
                onClick={closeSettingsDrawer}
                className="flex items-center gap-4 rounded-2xl border border-border/50 bg-card px-4 py-3 transition-colors hover:bg-secondary/50"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/12 text-primary">
                  <User className="h-5 w-5" strokeWidth={2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold truncate">
                    {profile.name || '—'}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {t('settings.personalInfo')}
                  </span>
                </span>
              </Link>
            </section>

            {/* Themes */}
            <section className="mb-8">
              <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Palette className="h-3.5 w-3.5" strokeWidth={2.2} />
                {t('settings.appearance')}
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {THEME_IDS.map((id) => {
                  const active = theme === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setTheme(id as ThemeId)}
                      className={cn(
                        'relative flex flex-col gap-2 rounded-2xl border px-3 py-3 text-left transition-colors',
                        active
                          ? 'border-primary bg-primary/10'
                          : 'border-border/60 bg-secondary/30 hover:bg-secondary/45',
                      )}
                    >
                      <ThemeSwatch id={id} />
                      <span className="text-xs font-semibold">{THEME_LABELS[id]}</span>
                      {active && (
                        <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="h-3.5 w-3.5" strokeWidth={3} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Language */}
            <section className="mb-8">
              <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Globe className="h-3.5 w-3.5" strokeWidth={2.2} />
                {t('settings.language')}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {LOCALE_CODES.map((code) => {
                  const active = locale === code;
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setLocale(code as LocaleCode)}
                      className={cn(
                        'rounded-2xl border px-3 py-3 text-left text-sm font-semibold transition-colors',
                        active
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border/60 bg-secondary/30 text-foreground hover:bg-secondary/45',
                      )}
                    >
                      {LOCALE_LABELS[code]}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Advisor */}
            <section className="mb-8 rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <div className="mb-4 flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl finance-gradient text-primary-foreground shadow-sm">
                  <Brain className="h-5 w-5" strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-semibold">{t('settings.advisor')}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Groq · {t('settings.openChat')}
                  </p>
                </div>
                <Link to="/advisor" onClick={closeSettingsDrawer}>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-9 gap-1.5 rounded-xl font-semibold shrink-0"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    {t('settings.openChat')}
                  </Button>
                </Link>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="groqKey"
                  className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {t('settings.groqKey')}
                </Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative flex-1">
                    <Key className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="groqKey"
                      type="password"
                      autoComplete="off"
                      placeholder="gsk_..."
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="h-11 rounded-xl pl-10 text-sm"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={handleSaveApiKey}
                    className="h-11 rounded-xl px-5 font-semibold finance-gradient border-0 sm:w-auto w-full"
                  >
                    {t('settings.save')}
                  </Button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function ThemeSwatch({ id }: { id: ThemeId }) {
  const swatches: Record<ThemeId, string> = {
    ocean: 'linear-gradient(135deg,#0b1220,#0d3d4a)',
    light: 'linear-gradient(135deg,#f8fafc,#e2e8f0)',
    midnight: 'linear-gradient(135deg,#000000,#0a1628)',
    slate: 'linear-gradient(135deg,#12121a,#1e1632)',
    nature: 'linear-gradient(135deg,#0d1a0f,#1a3d1e)',
    sunrise: 'linear-gradient(135deg,#1a0d05,#3d1a0a)',
  };
  return (
    <span
      className="h-10 w-full rounded-xl border border-border/40 shadow-inner"
      style={{ background: swatches[id] }}
    />
  );
}
