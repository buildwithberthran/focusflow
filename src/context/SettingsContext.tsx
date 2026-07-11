import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { UserSettings } from '../types';
import { dbGetSettings, dbUpsertSettings } from '../lib/db';
import { useAuth } from './AuthContext';

interface SettingsContextValue {
  settings: UserSettings | null;
  loading: boolean;
  update: (patch: Partial<UserSettings>) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setSettings(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    dbGetSettings(user.id).then((s) => {
      if (!cancelled) {
        setSettings(s);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings?.theme ?? 'dark');
  }, [settings?.theme]);

  const update = useCallback(
    async (patch: Partial<UserSettings>) => {
      if (!user) return;
      setSettings((prev) => (prev ? { ...prev, ...patch } : prev));
      await dbUpsertSettings(user.id, patch);
    },
    [user]
  );

  return <SettingsContext.Provider value={{ settings, loading, update }}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
