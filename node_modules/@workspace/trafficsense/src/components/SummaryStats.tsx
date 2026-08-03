import { useGetTrafficSummary, getGetTrafficSummaryQueryKey } from '@workspace/api-client-react';
import { AlertTriangle, Navigation, Map, Route, Clock, BarChart2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface StatDef {
  key: string;
  title: string;
  icon: React.ReactNode;
  format: (v: number | undefined | null) => string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
}

export default function SummaryStats() {
  const { data, isLoading } = useGetTrafficSummary({
    query: { refetchInterval: 60000, queryKey: getGetTrafficSummaryQueryKey() },
  });

  const stats: StatDef[] = [
    {
      key: 'active_incidents',
      title: 'Active Incidents',
      icon: <AlertTriangle className="w-4 h-4" />,
      format: (v) => (v == null ? '—' : String(v)),
      colorClass: 'text-orange-400',
      bgClass: 'bg-orange-500/10',
      borderClass: 'border-orange-500/20',
    },
    {
      key: 'average_congestion_index',
      title: 'Avg Congestion',
      icon: <BarChart2 className="w-4 h-4" />,
      format: (v) => (v == null ? '—' : v.toFixed(1)),
      colorClass: 'text-sky-400',
      bgClass: 'bg-sky-500/10',
      borderClass: 'border-sky-500/20',
    },
    {
      key: 'predictions_today',
      title: 'Predictions Today',
      icon: <Navigation className="w-4 h-4" />,
      format: (v) => (v == null ? '—' : v.toLocaleString()),
      colorClass: 'text-teal-400',
      bgClass: 'bg-teal-500/10',
      borderClass: 'border-teal-500/20',
    },
    {
      key: 'heavy_zones',
      title: 'Heavy Zones',
      icon: <Map className="w-4 h-4" />,
      format: (v) => (v == null ? '—' : String(v)),
      colorClass: 'text-red-400',
      bgClass: 'bg-red-500/10',
      borderClass: 'border-red-500/20',
    },
    {
      key: 'moderate_zones',
      title: 'Moderate Zones',
      icon: <Route className="w-4 h-4" />,
      format: (v) => (v == null ? '—' : String(v)),
      colorClass: 'text-yellow-400',
      bgClass: 'bg-yellow-500/10',
      borderClass: 'border-yellow-500/20',
    },
    {
      key: 'light_zones',
      title: 'Light Zones',
      icon: <Clock className="w-4 h-4" />,
      format: (v) => (v == null ? '—' : String(v)),
      colorClass: 'text-green-400',
      bgClass: 'bg-green-500/10',
      borderClass: 'border-green-500/20',
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 shrink-0" data-testid="summary-stats-loading">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border/60 bg-card p-4 space-y-2">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-7 w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (!data) return null;

  const values: Record<string, number> = {
    active_incidents: data.active_incidents,
    average_congestion_index: data.average_congestion_index,
    predictions_today: data.predictions_today,
    heavy_zones: data.heavy_zones,
    moderate_zones: data.moderate_zones,
    light_zones: data.light_zones,
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 shrink-0" data-testid="summary-stats">
      {stats.map((stat) => (
        <div
          key={stat.key}
          className={`relative rounded-xl border ${stat.borderClass} ${stat.bgClass} p-4 flex flex-col gap-2 overflow-hidden group transition-transform hover:-translate-y-0.5 hover:shadow-lg`}
          data-testid={`stat-card-${stat.key}`}
        >
          {/* Subtle glow blob */}
          <div className={`absolute -top-4 -right-4 w-16 h-16 rounded-full ${stat.bgClass} blur-xl opacity-60`} />

          <div className="flex items-center justify-between relative">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{stat.title}</span>
            <span className={stat.colorClass}>{stat.icon}</span>
          </div>

          <div className={`text-2xl font-bold tracking-tight font-mono relative ${stat.colorClass}`}>
            {stat.format(values[stat.key])}
          </div>
        </div>
      ))}
    </div>
  );
}
