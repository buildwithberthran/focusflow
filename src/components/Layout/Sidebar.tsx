import { Timer as TimerIcon, ListChecks, LayoutTemplate, LogOut, RotateCcw, Settings as SettingsIcon } from 'lucide-react';
import CheckpointBarsIcon from '../Brand/CheckpointBarsIcon';
import { useAuth } from '../../context/AuthContext';
import { useTimerEngine } from '../../context/TimerEngineContext';
import { useRecoverableCount } from '../../hooks/useRecoverableCount';
import type { Page } from './AppShell';

export default function Sidebar({ active, onChange }: { active: Page; onChange: (p: Page) => void }) {
  const { user, signOut } = useAuth();
  const { state } = useTimerEngine();
  const { count: recoverableCount } = useRecoverableCount(state.currentSessionId);
  const name = (user?.user_metadata?.full_name as string) || user?.email || 'Account';
  const avatar = user?.user_metadata?.avatar_url as string | undefined;

  const items: { id: Page; label: string; icon: typeof TimerIcon; badge?: number }[] = [
    { id: 'timer', label: 'Timer', icon: TimerIcon },
    { id: 'history', label: 'History', icon: ListChecks },
    { id: 'templates', label: 'Templates', icon: LayoutTemplate },
    { id: 'recover', label: 'Recover', icon: RotateCcw, badge: recoverableCount },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  const avatarEl = avatar ? (
    <img src={avatar} alt="" className="sidebar-avatar" />
  ) : (
    <div className="sidebar-avatar sidebar-avatar-fallback">{name.charAt(0).toUpperCase()}</div>
  );

  return (
    <>
      {/* Desktop: full vertical sidebar. Hidden on narrow screens. */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="sidebar-brand-mark"><CheckpointBarsIcon size={18} /></span>
          <span className="sidebar-brand-text">FocusFlow</span>
        </div>

        <nav className="sidebar-nav">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                className={'sidebar-nav-item' + (isActive ? ' active' : '')}
                onClick={() => onChange(item.id)}
              >
                <Icon size={18} strokeWidth={2} />
                <span>{item.label}</span>
                {!!item.badge && <span className="sidebar-nav-badge">{item.badge}</span>}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-account">
          {avatarEl}
          <span className="sidebar-account-name">{name}</span>
          <button className="sidebar-signout" title="Sign out" onClick={() => signOut()}>
            <LogOut size={16} strokeWidth={2} />
          </button>
        </div>
      </aside>

      {/* Mobile: slim top bar (brand + account) shown only under the sidebar's breakpoint. */}
      <header className="mobile-topbar">
        <div className="mobile-topbar-brand">
          <span className="sidebar-brand-mark"><CheckpointBarsIcon size={17} /></span>
          <span className="sidebar-brand-text">FocusFlow</span>
        </div>
        <div className="mobile-topbar-account">
          {avatarEl}
          <button className="sidebar-signout" title="Sign out" onClick={() => signOut()}>
            <LogOut size={15} strokeWidth={2} />
          </button>
        </div>
      </header>

      {/* Mobile: fixed bottom tab bar, icon + tiny label, evenly spaced. */}
      <nav className="mobile-tabbar">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              className={'mobile-tab-item' + (isActive ? ' active' : '')}
              onClick={() => onChange(item.id)}
            >
              <span className="mobile-tab-icon-wrap">
                <Icon size={19} strokeWidth={2} />
                {!!item.badge && <span className="mobile-tab-badge">{item.badge}</span>}
              </span>
              <span className="mobile-tab-label">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
