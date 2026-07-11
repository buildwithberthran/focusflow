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
          <span className="tag">Custom Cycles</span>
          <span className="tag">Flexible Breaks</span>
          <span className="tag">Reminders</span>
          <span className="tag">Full History</span>
        </div>

        <div className="cover-cta-wrap">
          <div className="cta-glow-wrapper">
            <button className="cover-cta" onClick={() => signInWithGoogle()}>
              <span>Get Started</span>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </div>
          <div className="cover-trust">
            <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </div>
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
