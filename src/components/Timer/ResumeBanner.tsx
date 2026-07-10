import { useTimerEngine } from '../../context/TimerEngineContext';
import type { Page } from '../Layout/AppShell';

export default function ResumeBanner({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const { state } = useTimerEngine();
  if (!state.resumeBannerVisible) return null;

  return (
    <div className="resume-banner visible">
      <div className="resume-banner-title">📌 Interrupted session found</div>
      <div className="resume-banner-sub">{state.resumeBannerSub}</div>
      <div className="resume-banner-btns">
        <button onClick={() => onNavigate('recover')}>Manage in Recover →</button>
      </div>
    </div>
  );
}
