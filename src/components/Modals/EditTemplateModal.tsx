import { useEffect, useState } from 'react';
import { Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import type { CycleItem, TemplateRow } from '../../types';
import { dbUpdateTemplate } from '../../lib/db';

export default function EditTemplateModal({
  template,
  onClose,
  onSaved,
}: {
  template: TemplateRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [breakSeconds, setBreakSeconds] = useState(10);
  const [schedule, setSchedule] = useState<CycleItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (template) {
      setName(template.name);
      setBreakSeconds(template.break_seconds);
      setSchedule((template.schedule || []).map((c) => ({ ...c })));
      setError('');
    }
  }, [template]);

  if (!template) return null;

  function updateMin(idx: number, v: number) {
    setSchedule((prev) => prev.map((c, i) => (i === idx ? { ...c, min: v } : c)));
  }
  function updateLabel(idx: number, v: string) {
    setSchedule((prev) => prev.map((c, i) => (i === idx ? { ...c, label: v } : c)));
  }
  function removeCycle(idx: number) {
    setSchedule((prev) => prev.filter((_, i) => i !== idx));
  }
  function moveCycle(idx: number, direction: 'up' | 'down') {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    setSchedule((prev) => {
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
      return next;
    });
  }
  function addCycle() {
    setSchedule((prev) => [...prev, { min: 10, label: '' }]);
  }

  async function save() {
    if (!template) return;
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    if (!schedule.length) {
      setError('At least one cycle is required.');
      return;
    }
    if (!Number.isInteger(breakSeconds) || breakSeconds < 1) {
      setError('Break must be a positive number of seconds.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await dbUpdateTemplate(template.id, { name: name.trim(), break_seconds: breakSeconds, schedule });
      onSaved();
      onClose();
    } catch (e: any) {
      setError('Save failed: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal modal-wide">
        <h2>Edit template</h2>

        <div className="full-input">
          <label>Template name</label>
          <input type="text" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>

        <div className="full-input">
          <label>Break (sec)</label>
          <input
            type="number"
            min={1}
            step={1}
            value={breakSeconds}
            onChange={(e) => setBreakSeconds(parseInt(e.target.value, 10) || 0)}
          />
        </div>

        <div className="cycle-preview">
          <div className="cycle-preview-header">
            <span>Cycles</span>
            <span className="total-pill">{schedule.reduce((a, c) => a + c.min, 0)} min total</span>
          </div>
          {schedule.map((c, idx) => (
            <div className="cycle-row" key={idx}>
              <span className="cycle-order-btns">
                <button
                  className="cycle-order-btn"
                  title="Move up"
                  disabled={idx === 0}
                  onClick={() => moveCycle(idx, 'up')}
                >
                  <ChevronUp size={13} strokeWidth={2.4} />
                </button>
                <button
                  className="cycle-order-btn"
                  title="Move down"
                  disabled={idx === schedule.length - 1}
                  onClick={() => moveCycle(idx, 'down')}
                >
                  <ChevronDown size={13} strokeWidth={2.4} />
                </button>
              </span>
              <span className="cycle-num">{idx + 1}.</span>
              <input
                type="number"
                min={1}
                step={1}
                className="cycle-min-input"
                value={c.min}
                onChange={(e) => updateMin(idx, parseInt(e.target.value, 10) || 0)}
              />
              <input
                type="text"
                placeholder="Task label…"
                maxLength={120}
                className="cycle-label-input"
                value={c.label}
                onChange={(e) => updateLabel(idx, e.target.value)}
              />
              <button className="cycle-del-btn" title="Remove" onClick={() => removeCycle(idx)}>
                <Trash2 size={13} strokeWidth={2} />
              </button>
            </div>
          ))}
          <button className="add-cycle-inline-btn" onClick={addCycle}>
            + Add cycle
          </button>
        </div>

        {error && <div className="error">{error}</div>}

        <div className="modal-btns">
          <button style={{ background: '#454B51', color: '#9BA3A8' }} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button style={{ background: '#3B8A81', color: '#EEF1EE' }} onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
