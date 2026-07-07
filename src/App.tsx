import { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { TimerEngineProvider } from './context/TimerEngineContext';
import LoginScreen from './components/Auth/LoginScreen';
import AccountBar from './components/Layout/AccountBar';
import PageTabs, { type Page } from './components/Layout/PageTabs';
import TimerPage from './components/Timer/TimerPage';
import HistoryPage from './components/History/HistoryPage';
import TemplatesPage from './components/Templates/TemplatesPage';

function AuthedApp() {
  const [page, setPage] = useState<Page>('timer');

  return (
    <TimerEngineProvider>
      <div className="card">
        <h1>⏱ FocusFlow</h1>
        <AccountBar />
        <PageTabs active={page} onChange={setPage} />
        {page === 'timer' && <TimerPage />}
        {page === 'history' && <HistoryPage />}
        {page === 'templates' && <TemplatesPage onNavigate={setPage} />}
      </div>
    </TimerEngineProvider>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="card">
        <div className="history-loading">Loading…</div>
      </div>
    );
  }

  return user ? <AuthedApp /> : <LoginScreen />;
}
