import type { ReactNode } from 'react';
import Sidebar from './Sidebar';

export type Page = 'timer' | 'history' | 'templates' | 'recover';

export default function AppShell({
  page,
  onNavigate,
  children,
}: {
  page: Page;
  onNavigate: (p: Page) => void;
  children: ReactNode;
}) {
  return (
    <div className="app-shell">
      <Sidebar active={page} onChange={onNavigate} />
      <main className="app-main">
        <div className="app-main-inner">{children}</div>
      </main>
    </div>
  );
}
