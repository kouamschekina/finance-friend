import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

/** Read the persisted Supabase session from localStorage synchronously.
 *  This lets us render the app immediately offline without waiting for
 *  supabase.auth.getSession() which hangs when there's no network. */
function getPersistedSession(): Session | null {
  try {
    // Supabase v2 stores the session under a key like "sb-<project>-auth-token"
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          // Check it hasn't expired
          if (parsed?.expires_at && parsed.expires_at * 1000 > Date.now()) {
            return parsed as Session;
          }
        }
      }
    }
  } catch { /* ignore */ }
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Seed state from localStorage immediately — no network needed
  const persistedSession = getPersistedSession();
  const [session, setSession] = useState<Session | null>(persistedSession);
  const [user, setUser] = useState<User | null>(persistedSession?.user ?? null);
  // If we already have a session from localStorage, don't block rendering
  const [loading, setLoading] = useState(!persistedSession);

  useEffect(() => {
    let mounted = true;

    // Still try to get a fresh session, but with a timeout so we don't
    // block the app forever when offline.
    const timeout = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 3000);

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        setSession(data.session ?? null);
        setUser(data.session?.user ?? null);
      })
      .catch(() => { /* offline — keep persisted session */ })
      .finally(() => {
        if (mounted) {
          clearTimeout(timeout);
          setLoading(false);
        }
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      clearTimeout(timeout);
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      session,
      loading,
      signInWithGoogle: async () => {
        await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: window.location.origin + '/profile',
          },
        });
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
      refresh: async () => {
        const { data } = await supabase.auth.getSession();
        setSession(data.session ?? null);
        setUser(data.session?.user ?? null);
      },
    }),
    [session, user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
