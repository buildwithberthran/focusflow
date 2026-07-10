import { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { TimerEngineProvider } from './context/TimerEngineContext';
import CoverPage from './components/Landing/CoverPage';
import AppShell, { type Page } from './components/Layout/AppShell';
import TimerPage from './components/Timer/TimerPage';
import HistoryPage from './components/History/HistoryPage';
import TemplatesPage from './components/Templates/TemplatesPage';
import RecoverPage from './components/Recover/RecoverPage';

function AuthedApp() {
  const [page, setPage] = useState<Page>('timer');

  return (
    <TimerEngineProvider>
      <AppShell page={page} onNavigate={setPage}>
        {page === 'timer' && <TimerPage onNavigate={setPage} />}
        {page === 'history' && <HistoryPage />}
        {page === 'templates' && <TemplatesPage onNavigate={setPage} />}
        {page === 'recover' && <RecoverPage onNavigate={setPage} />}
      </AppShell>
    </TimerEngineProvider>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: '#0b0f17',
          color: '#8a93a6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.9rem',
        }}
      >
        Loading…
      </div>
    );
  }

  return user ? <AuthedApp /> : <CoverPage />;
}
