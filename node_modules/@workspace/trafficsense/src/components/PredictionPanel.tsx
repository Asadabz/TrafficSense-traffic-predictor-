import { Skeleton } from '@/components/ui/skeleton';
import { Clock, TrendingUp, AlertCircle, CheckCircle2, Gauge, Navigation } from 'lucide-react';
import TrafficChart from './TrafficChart';
import type { PredictionResult, CongestionLevel } from '@/types/traffic';

interface PredictionPanelProps {
  result: PredictionResult | null;
  isLoading: boolean;
  isError?: boolean;
  selectedRouteId: string;
  onRouteSelect: (id: string) => void;
}

const CONGESTION = {
  light:    { label: 'Light',    color: '#22c55e', bg: 'bg-green-500/10',  border: 'border-green-500/30',  text: 'text-green-400',  badge: 'bg-green-500/15 text-green-400 border-green-500/30',  desc: 'Clear roads — smooth travel expected.' },
  moderate: { label: 'Moderate', color: '#eab308', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400', badge: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30', desc: 'Some congestion. Allow extra time.' },
  heavy:    { label: 'Heavy',    color: '#ef4444', bg: 'bg-red-500/10',    border: 'border-red-500/30',    text: 'text-red-400',    badge: 'bg-red-500/15 text-red-400 border-red-500/30',    desc: 'Significant delays. Consider alternatives.' },
};
const defaultCfg = CONGESTION.light;

const ROUTE_ACCENT: Record<string, string> = {
  fastest: 'border-sky-500/40 text-sky-400',
  balanced: 'border-violet-500/40 text-violet-400',
  scenic:  'border-orange-500/40 text-orange-400',
};

function ConfidenceBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = pct >= 85 ? '#22c55e' : pct >= 70 ? '#eab308' : '#ef4444';
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Model Confidence</span>
        <span className="text-sm font-bold font-mono" style={{ color }}>{pct}%</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export default function PredictionPanel({ result, isLoading, isError, selectedRouteId, onRouteSelect }: PredictionPanelProps) {
  if (isError) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-6 flex flex-col items-center justify-center gap-3 min-h-[160px] text-center" data-testid="prediction-error">
        <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <AlertCircle className="w-5 h-5 text-red-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-red-400">Prediction Failed</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">Unable to process the route. Verify inputs and try again.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border/60 bg-card p-5 space-y-4" data-testid="prediction-loading">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-6 w-28 rounded-full" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
        </div>
        <Skeleton className="h-3 w-full rounded-full" />
        <Skeleton className="h-44 w-full rounded-lg" />
      </div>
    );
  }

  if (!result) {
    return (
      <div className="rounded-xl border border-dashed border-border/50 bg-muted/5 p-8 flex flex-col items-center justify-center gap-3 min-h-[180px] text-center" data-testid="prediction-empty">
        <div className="w-10 h-10 rounded-full bg-muted/40 flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-muted-foreground/40" />
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground/60">No prediction yet</p>
          <p className="text-xs text-muted-foreground/40 mt-0.5">Configure a route and run the model</p>
        </div>
      </div>
    );
  }

  const routes = result.route_alternatives ?? [];
  const activeRoute = routes.find((r) => r.id === selectedRouteId) ?? routes[0];
  const congLevel = (activeRoute?.congestion_level ?? result.congestion_level) as keyof typeof CONGESTION;
  const cfg = CONGESTION[congLevel] ?? defaultCfg;
  const confScore = activeRoute?.confidence_score ?? result.confidence_score;
  const travelTime = activeRoute?.estimated_minutes ?? result.estimated_minutes;

  return (
    <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden" data-testid="prediction-result">
      {/* Header */}
      <div className={`px-5 py-3 border-b border-border/50 flex items-center justify-between ${cfg.bg}`}>
        <div className="flex items-center gap-2">
          <CheckCircle2 className={`w-4 h-4 ${cfg.text}`} />
          <span className="text-sm font-semibold text-foreground">Model Output</span>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.badge}`}>{cfg.label} Traffic</span>
      </div>

      <div className="p-5 space-y-4">
        {/* Route alternative selector */}
        {routes.length > 1 && (
          <div className="space-y-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Navigation className="w-3 h-3" /> Route Options
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {routes.map((route) => {
                const isActive = route.id === selectedRouteId;
                const rCongLevel = route.congestion_level as keyof typeof CONGESTION;
                const rCfg = CONGESTION[rCongLevel] ?? defaultCfg;
                const accentClass = ROUTE_ACCENT[route.id] ?? 'border-border text-muted-foreground';
                return (
                  <button
                    key={route.id}
                    onClick={() => onRouteSelect(route.id)}
                    className={`rounded-lg border p-2 flex flex-col gap-1 text-left transition-all ${
                      isActive
                        ? `${rCfg.bg} ${accentClass}`
                        : 'border-border/50 bg-muted/10 hover:bg-muted/30 text-muted-foreground'
                    }`}
                    data-testid={`panel-route-btn-${route.id}`}
                  >
                    <span className={`text-[10px] font-bold uppercase tracking-wide ${isActive ? rCfg.text : ''}`}>{route.name}</span>
                    <span className="text-sm font-black font-mono leading-none text-foreground">{route.estimated_minutes}<span className="text-[10px] font-normal ml-0.5 text-muted-foreground">m</span></span>
                    <div className="w-3 h-1 rounded-full mt-0.5" style={{ background: rCfg.color }} />
                  </button>
                );
              })}
            </div>
            {activeRoute && (
              <p className="text-[10px] text-muted-foreground/70 mt-0.5">via {activeRoute.via}</p>
            )}
          </div>
        )}

        {/* Key metrics */}
        <div className="grid grid-cols-2 gap-3">
          <div className={`rounded-xl border ${cfg.border} ${cfg.bg} p-3 flex flex-col gap-1`}>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span className="text-[10px] font-semibold uppercase tracking-widest">Travel Time</span>
            </div>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className={`text-2xl font-black tracking-tight font-mono ${cfg.text}`}>{travelTime}</span>
              <span className="text-xs font-medium text-muted-foreground">min</span>
            </div>
          </div>
          <div className="rounded-xl border border-border/50 bg-muted/20 p-3 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Gauge className="w-3 h-3" />
              <span className="text-[10px] font-semibold uppercase tracking-widest">Status</span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: cfg.color, boxShadow: `0 0 8px ${cfg.color}60` }} />
              <span className="text-sm font-bold capitalize text-foreground">{congLevel}</span>
            </div>
            <p className="text-[10px] text-muted-foreground/70 leading-snug mt-0.5">{cfg.desc}</p>
          </div>
        </div>

        {/* Confidence */}
        <ConfidenceBar score={confScore} />

        <div className="border-t border-border/40" />

        {/* Forecast chart */}
        <div>
          <div className="flex items-center gap-1.5 mb-3">
            <TrendingUp className="w-3.5 h-3.5 text-primary" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">24-Hour Traffic Forecast</span>
          </div>
          <TrafficChart data={result.hourly_forecast} />
        </div>
      </div>
    </div>
  );
}
