import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';

export interface HourlyForecast {
  hour: number;
  congestion_index: number;
  label: 'light' | 'moderate' | 'heavy';
}

interface TrafficChartProps {
  data: HourlyForecast[];
}

function formatHour(hour: number) {
  if (hour === 0) return '12a';
  if (hour < 12) return `${hour}a`;
  if (hour === 12) return '12p';
  return `${hour - 12}p`;
}

function getBarColor(index: number) {
  if (index < 35) return '#22c55e';
  if (index < 65) return '#eab308';
  return '#ef4444';
}

interface CustomDotProps {
  cx?: number;
  cy?: number;
  payload?: HourlyForecast;
}

function CustomDot({ cx, cy, payload }: CustomDotProps) {
  if (!payload || cx === undefined || cy === undefined) return null;
  const color = getBarColor(payload.congestion_index);
  return (
    <circle cx={cx} cy={cy} r={3} fill={color} stroke="hsl(var(--card))" strokeWidth={1.5} />
  );
}

interface TooltipPayload {
  value: number;
  payload: HourlyForecast;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const color = getBarColor(d.congestion_index);
  const hour12 = d.hour === 0 ? '12:00 AM' : d.hour < 12 ? `${d.hour}:00 AM` : d.hour === 12 ? '12:00 PM' : `${d.hour - 12}:00 PM`;
  return (
    <div className="bg-card border border-border/70 rounded-lg shadow-xl px-3 py-2.5 text-xs">
      <p className="text-muted-foreground mb-1.5 font-medium">{hour12}</p>
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full" style={{ background: color }} />
        <span className="text-foreground font-bold font-mono">{d.congestion_index.toFixed(1)}</span>
        <span className="text-muted-foreground">congestion</span>
      </div>
      <div className="mt-1 capitalize" style={{ color }}>
        {d.label} traffic
      </div>
    </div>
  );
}

const now = new Date().getHours();

export default function TrafficChart({ data }: TrafficChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    timeLabel: formatHour(d.hour),
    color: getBarColor(d.congestion_index),
  }));

  return (
    <div className="h-44 w-full" data-testid="traffic-chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
          <defs>
            <linearGradient id="trafficGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />

          <XAxis
            dataKey="timeLabel"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))', fontWeight: 500 }}
            interval={2}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
            domain={[0, 100]}
            ticks={[0, 35, 65, 100]}
          />

          {/* Zone bands */}
          <ReferenceLine y={35} stroke="#22c55e" strokeDasharray="4 4" strokeOpacity={0.35} />
          <ReferenceLine y={65} stroke="#eab308" strokeDasharray="4 4" strokeOpacity={0.35} />

          {/* Current hour */}
          <ReferenceLine
            x={formatHour(now)}
            stroke="#0ea5e9"
            strokeWidth={1.5}
            strokeDasharray="3 3"
            label={{ value: 'Now', position: 'top', fill: '#0ea5e9', fontSize: 9, fontWeight: 600 }}
          />

          <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }} />

          <Area
            type="monotone"
            dataKey="congestion_index"
            stroke="#0ea5e9"
            strokeWidth={2}
            fill="url(#trafficGradient)"
            dot={<CustomDot />}
            activeDot={{ r: 5, fill: '#0ea5e9', stroke: 'hsl(var(--card))', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
