import { createContext, useContext, type ReactNode } from 'react';
import { useFocusTimer } from '../hooks/useFocusTimer';
import { useAuth } from './AuthContext';
import { useSettings } from './SettingsContext';

type Engine = ReturnType<typeof useFocusTimer>;

const TimerEngineContext = createContext<Engine | undefined>(undefined);

export function TimerEngineProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { settings } = useSettings();
  const engine = useFocusTimer(user?.id ?? null, settings);
  return <TimerEngineContext.Provider value={engine}>{children}</TimerEngineContext.Provider>;
}

export function useTimerEngine(): Engine {
  const ctx = useContext(TimerEngineContext);
  if (!ctx) throw new Error('useTimerEngine must be used within TimerEngineProvider');
  return ctx;
}
