import { useTemplates } from '../../hooks/useTemplates';
import { useTimerEngine } from '../../context/TimerEngineContext';
import { dbDeleteTemplate } from '../../lib/db';
import type { Page } from '../Layout/AppShell';

export default function TemplatesPage({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const { templates, loading, error, refresh } = useTemplates();
  const { actions } = useTimerEngine();

  async function handleDelete(id: string) {
    if (!confirm('Delete this template?')) return;
    try {
      await dbDeleteTemplate(id);
      await refresh();
    } catch (e: any) {
      alert('Delete failed: ' + e.message);
    }
  }

  function handleUse(tpl: (typeof templates)[number]) {
    actions.setAppMode('target');
    actions.loadScheduleFromTemplate(tpl);
    onNavigate('timer');
  }

  return (
    <div id="templatesPage" className="page-dashboard">
      <div className="page-header">
        <h1>Templates</h1>
        <p>Reusable cycle schedules you've saved.</p>
      </div>

      <div className="history-toolbar">
        <button
          style={{ background: '#2a3344', color: '#aab2c5', border: '1px solid #3f4a60' }}
          onClick={refresh}
        >
          ↻ Refresh
        </button>
      </div>

      {loading && <div className="history-loading">Loading…</div>}
      {error && (
        <div className="history-loading" style={{ color: '#ff6b6b' }}>
          Error: {error}
        </div>
      )}
      {!loading && !error && !templates.length && (
        <div className="empty-state">
          <div className="es-icon">📐</div>
          No templates yet. Build a schedule in Target Total mode and click "Save as template".
        </div>
      )}

      {templates.map((t) => {
        const total = (t.schedule || []).reduce((a, c) => a + c.min, 0);
        const count = (t.schedule || []).length;
        return (
          <div className="tpl-item" key={t.id}>
            <div className="tpl-header">
              <div>
                <div className="tpl-name">{t.name}</div>
                <div className="tpl-sub">
                  {count} cycles · {total} min · {t.break_seconds}s break
                </div>
              </div>
              <div className="tpl-actions">
                <button className="use-tpl-btn" onClick={() => handleUse(t)}>
                  ▶ Use
                </button>
                <button className="delete-tpl-btn" onClick={() => handleDelete(t.id)}>
                  ✕
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
