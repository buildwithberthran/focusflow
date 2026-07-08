import { useTimerEngine } from '../../context/TimerEngineContext';

export default function ResumeBanner() {
  const { state, actions } = useTimerEngine();
  if (!state.resumeBannerVisible) return null;

  return (
    <div className="resume-banner visible">
      <div className="resume-banner-title">📌 Interrupted session found</div>
      <div className="resume-banner-sub">{state.resumeBannerSub}</div>
      <div className="resume-banner-btns">
        <button onClick={() => actions.resumeSession()}>▶ Resume Session</button>
        <button onClick={() => actions.dismissResume()}>✕ Start Fresh</button>
      </div>
    </div>
  );
}
