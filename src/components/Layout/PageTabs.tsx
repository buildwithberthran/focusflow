export type Page = 'timer' | 'history' | 'templates';

export default function PageTabs({
  active,
  onChange,
}: {
  active: Page;
  onChange: (p: Page) => void;
}) {
  return (
    <div className="page-tabs">
      <button className={'page-tab' + (active === 'timer' ? ' active' : '')} onClick={() => onChange('timer')}>
        ⏱ Timer
      </button>
      <button
        className={'page-tab' + (active === 'history' ? ' active' : '')}
        onClick={() => onChange('history')}
      >
        📋 History
      </button>
      <button
        className={'page-tab' + (active === 'templates' ? ' active' : '')}
        onClick={() => onChange('templates')}
      >
        📐 Templates
      </button>
    </div>
  );
}
