import { useCallback, useEffect, useState } from 'react';
import type { TemplateRow } from '../types';
import { dbListTemplates } from '../lib/db';
import { useAuth } from '../context/AuthContext';

export function useTemplates() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await dbListTemplates();
      setTemplates(rows);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { templates, loading, error, refresh };
}
