import { useState } from 'react';
import { Pencil, Trash2, Play } from 'lucide-react';
import { useTemplates } from '../../hooks/useTemplates';
import { useTimerEngine } from '../../context/TimerEngineContext';
import { dbDeleteTemplate } from '../../lib/db';
import type { TemplateRow } from '../../types';
import type { Page } from '../Layout/AppShell';
import DeleteTemplateModal from '../Modals/DeleteTemplateModal';
import EditTemplateModal from '../Modals/EditTemplateModal';

export default function TemplatesPage({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const { templates, loading, error, refresh } = useTemplates();
  const { actions } = useTimerEngine();
  const [deleteTarget, setDeleteTarget] = useState<TemplateRow | null>(null);
  const [editTarget, setEditTarget] = useState<TemplateRow | null>(null);

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await dbDeleteTemplate(deleteTarget.id);
      await refresh();
    } catch (e: any) {
      alert('Delete failed: ' + e.message);
    } finally {
      setDeleteTarget(null);
    }
  }

  function handleUse(tpl: TemplateRow) {
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
          style={{ background: '#33383D', color: '#9BA3A8', border: '1px solid #454B51' }}
          onClick={refresh}
        >
          ↻ Refresh
        </button>
      </div>

      {loading && <div className="history-loading">Loading…</div>}
      {error && (
        <div className="history-loading" style={{ color: '#D06868' }}>
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
                  <Play size={13} strokeWidth={2.4} /> Use
                </button>
                <button className="edit-tpl-btn" onClick={() => setEditTarget(t)} title="Edit">
                  <Pencil size={13} strokeWidth={2.2} />
                </button>
                <button className="delete-tpl-btn" onClick={() => setDeleteTarget(t)} title="Delete">
                  <Trash2 size={13} strokeWidth={2.2} />
                </button>
              </div>
            </div>
          </div>
        );
      })}

      <DeleteTemplateModal template={deleteTarget} onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete} />
      <EditTemplateModal template={editTarget} onClose={() => setEditTarget(null)} onSaved={refresh} />
    </div>
  );
}
