import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { dbListCycleLogsForSessions, dbListSessions } from '../lib/db';

export interface DashboardStats {
  cyclesToday: number;
  focusMinutesToday: number;
  completionRate: number; // last 30 days, 0-100
  streakDays: number;
}

function startOfDay(d: Date) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

export function useDashboardStats() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const sessions = await dbListSessions(60);
      const ids = sessions.map((s) => s.id);
      const logs = await dbListCycleLogsForSessions(ids);

      const today = startOfDay(new Date());
      const logsToday = logs.filter((l) => new Date(l.started_at) >= today);
      const cyclesToday = logsToday.length;
      const focusMinutesToday = logsToday.reduce((a, l) => a + (l.duration_min || 0), 0);

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      const recentLogs = logs.filter((l) => new Date(l.started_at) >= cutoff);
      const doneCount = recentLogs.filter((l) => l.completed === true).length;
      const completionRate = recentLogs.length ? Math.round((doneCount / recentLogs.length) * 100) : 0;

      const activeDays = new Set(
        logs
          .filter((l) => l.completed === true)
          .map((l) => startOfDay(new Date(l.started_at)).getTime())
      );
      let streakDays = 0;
      const cursor = startOfDay(new Date());
      while (activeDays.has(cursor.getTime())) {
        streakDays++;
        cursor.setDate(cursor.getDate() - 1);
      }

      setStats({ cyclesToday, focusMinutesToday, completionRate, streakDays });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { stats, loading, refresh };
}
