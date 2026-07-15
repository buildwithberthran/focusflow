import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { dbListRecoverableSessions } from '../lib/db';
import { onRecoverableChanged } from '../lib/events';

export function useRecoverableCount(excludeSessionId: string | null) {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!user) return;
    const rows = await dbListRecoverableSessions(excludeSessionId);
    setCount(rows.length);
  }, [user, excludeSessionId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => onRecoverableChanged(() => void refresh()), [refresh]);

  return { count, refresh };
}
