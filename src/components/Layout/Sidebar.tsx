import { Timer as TimerIcon, ListChecks, LayoutTemplate, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import type { Page } from './AppShell';

export default function Sidebar({ active, onChange }: { active: Page; onChange: (p: Page) => void }) {
  const { user, signOut } = useAuth();
  const name = (user?.user_metadata?.full_name as string) || user?.email || 'Account';
  const avatar = user?.user_metadata?.avatar_url as string | undefined;

  const items: { id: Page; label: string; icon: typeof TimerIcon }[] = [
    { id: 'timer', label: 'Timer', icon: TimerIcon },
    { id: 'history', label: 'History', icon: ListChecks },
    { id: 'templates', label: 'Templates', icon: LayoutTemplate },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-brand-mark">⏱</span>
        <span className="sidebar-brand-text">Focus Flow</span>
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
            </button>
          );
        })}
      </nav>

      <div className="sidebar-account">
        {avatar ? (
          <img src={avatar} alt="" className="sidebar-avatar" />
        ) : (
          <div className="sidebar-avatar sidebar-avatar-fallback">{name.charAt(0).toUpperCase()}</div>
        )}
        <span className="sidebar-account-name">{name}</span>
        <button className="sidebar-signout" title="Sign out" onClick={() => signOut()}>
          <LogOut size={16} strokeWidth={2} />
        </button>
      </div>
    </aside>
  );
}
