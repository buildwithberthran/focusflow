import './cover.css';
import { useAuth } from '../../context/AuthContext';

export default function CoverPage() {
  const { signInWithGoogle } = useAuth();

  return (
    <div className="cover-page">
      <div className="cover-drift" aria-hidden="true" />
      <div className="cover-grain" aria-hidden="true" />

      <header className="cover-topbar">
        <span className="cover-mark">⏱</span>
        <span className="cover-name">FocusFlow</span>
      </header>

      <main className="cover-hero">
        <div className="cover-eyebrow">A configurable focus system</div>
        <h1 className="cover-headline">
          Design your sessions.
          <br />
          <b>Keep the record.</b>
        </h1>
        <p className="cover-sub">
          Set your own cycles, breaks, and reminders. Every session logs what you worked on and
          where you lost focus, so you always know exactly where your time went.
        </p>
        <div className="cover-tags">
          custom cycles<span>·</span>flexible breaks<span>·</span>reminders<span>·</span>full history
        </div>

        <div className="cover-cta-wrap">
          <button className="cover-cta" onClick={() => signInWithGoogle()}>
            Get Started
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
          <div className="cover-trust">via Google · no password needed</div>
        </div>

        <div className="cover-ring-wrap" aria-hidden="true">
          <svg viewBox="0 0 120 120">
            <circle className="cover-ring-track" cx="60" cy="60" r="54" />
            <circle className="cover-ring-fill" cx="60" cy="60" r="54" />
          </svg>
          <div className="cover-ring-label">18:00</div>
        </div>
      </main>
    </div>
  );
}
