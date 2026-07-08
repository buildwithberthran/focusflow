import { CheckCircle2, Clock3, Flame, TrendingUp } from 'lucide-react';
import { useDashboardStats } from '../../hooks/useDashboardStats';

export default function StatsBar() {
  const { stats } = useDashboardStats();

  const cards = [
    {
      icon: Clock3,
      tone: 'blue' as const,
      value: stats ? stats.cyclesToday : '–',
      label: 'Cycles today',
    },
    {
      icon: TrendingUp,
      tone: 'amber' as const,
      value: stats ? `${stats.focusMinutesToday}m` : '–',
      label: 'Focus minutes today',
    },
    {
      icon: CheckCircle2,
      tone: 'green' as const,
      value: stats ? `${stats.completionRate}%` : '–',
      label: 'Completion (30d)',
    },
    {
      icon: Flame,
      tone: 'red' as const,
      value: stats ? stats.streakDays : '–',
      label: stats?.streakDays === 1 ? 'Day streak' : 'Day streak',
    },
  ];

  return (
    <div className="stats-grid">
      {cards.map((c, i) => {
        const Icon = c.icon;
        return (
          <div className={'stat-card tone-' + c.tone} key={i}>
            <div className="stat-icon">
              <Icon size={18} strokeWidth={2} />
            </div>
            <div className="stat-value">{c.value}</div>
            <div className="stat-label">{c.label}</div>
          </div>
        );
      })}
    </div>
  );
}
