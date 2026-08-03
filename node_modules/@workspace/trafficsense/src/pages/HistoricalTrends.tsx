import { useState } from 'react';
import { useGetHistoricalData, getGetHistoricalDataQueryKey } from '@workspace/api-client-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Loader2, BarChart2, CalendarDays } from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid,
  LineChart,
  Line,
  Cell
} from 'recharts';

export default function HistoricalTrends() {
  const [searchInput, setSearchInput] = useState('');
  const [location, setLocation] = useState('');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const { data, isLoading, isError } = useGetHistoricalData(
    { location }, 
    { query: { enabled: !!location, queryKey: getGetHistoricalDataQueryKey({ location }) } }
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setLocation(searchInput.trim());
      setSelectedDay(null); // Reset day selection on new search
    }
  };

  // Compute average daily congestion for the bar chart
  const dailyAverages = data?.patterns.map(pattern => {
    const sum = pattern.hourly.reduce((acc, h) => acc + h.congestion_index, 0);
    const avg = Math.round(sum / pattern.hourly.length);
    return {
      day: pattern.day,
      shortDay: pattern.day.substring(0, 3),
      average_congestion: avg
    };
  }) || [];

  const selectedDayData = data?.patterns.find(p => p.day === selectedDay)?.hourly.map(h => ({
    ...h,
    timeLabel: h.hour === 0 ? '12 AM' : h.hour < 12 ? `${h.hour} AM` : h.hour === 12 ? '12 PM' : `${h.hour - 12} PM`
  })) || [];

  return (
    <div className="flex flex-col flex-1 p-6 max-w-7xl mx-auto w-full gap-6">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-primary" />
            Historical Analysis
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Query deep-time congestion records for urban arteries and intersections.
          </p>
        </div>

        <form onSubmit={handleSearch} className="flex w-full md:w-auto gap-2">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Enter street or zone name..." 
              className="pl-9 font-mono bg-card"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={isLoading || !searchInput.trim()}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Query'}
          </Button>
        </form>
      </div>

      {!location && !isLoading && (
        <Card className="flex-1 border-dashed border-2 border-border/50 bg-transparent flex flex-col items-center justify-center text-muted-foreground p-12 min-h-[400px]">
          <CalendarDays className="w-12 h-12 mb-4 opacity-20" />
          <p className="font-medium text-lg text-foreground mb-2">No location selected</p>
          <p className="text-sm max-w-sm text-center">
            Enter a location above to fetch historical traffic patterns and view day-over-day statistical averages.
          </p>
        </Card>
      )}

      {isLoading && (
        <div className="flex-1 flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center text-primary gap-4">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-sm font-mono animate-pulse">Aggregating historical datasets...</p>
          </div>
        </div>
      )}

      {isError && (
        <Card className="p-6 border-destructive/30 bg-destructive/5 text-center flex flex-col items-center justify-center min-h-[200px]">
          <p className="text-destructive font-semibold">Data Retrieval Failed</p>
          <p className="text-sm text-destructive/80 mt-1">Could not find historical records for "{location}".</p>
        </Card>
      )}

      {data && !isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full min-h-[500px]">
          {/* Bar Chart: Daily Averages */}
          <Card className="p-5 border-border shadow-sm flex flex-col">
            <h3 className="font-semibold tracking-tight text-foreground mb-6 flex justify-between items-center">
              <span>Weekly Congestion Averages</span>
              <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
                {data.location}
              </span>
            </h3>
            <div className="flex-1 min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyAverages} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="shortDay" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} 
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} 
                    domain={[0, 100]}
                  />
                  <Tooltip 
                    cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '6px' }}
                    itemStyle={{ color: 'hsl(var(--primary))', fontWeight: 600 }}
                    labelStyle={{ color: 'hsl(var(--muted-foreground))', fontSize: '12px', marginBottom: '4px' }}
                    formatter={(value: number) => [`${value} Index`, 'Avg Congestion']}
                  />
                  <Bar 
                    dataKey="average_congestion" 
                    radius={[4, 4, 0, 0]}
                    onClick={(data) => setSelectedDay(data.day)}
                    className="cursor-pointer transition-opacity hover:opacity-80"
                  >
                    {dailyAverages.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={selectedDay === entry.day ? 'hsl(var(--secondary))' : 'hsl(var(--primary))'} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-center text-muted-foreground mt-4 italic">
              Click on a day to view its hourly breakdown
            </p>
          </Card>

          {/* Line Chart: Hourly for selected day */}
          <Card className="p-5 border-border shadow-sm flex flex-col">
            <h3 className="font-semibold tracking-tight text-foreground mb-6 flex justify-between items-center">
              <span>Hourly Breakdown</span>
              {selectedDay && (
                <span className="text-xs font-mono text-secondary bg-secondary/10 px-2 py-1 rounded">
                  {selectedDay}
                </span>
              )}
            </h3>
            
            {!selectedDay ? (
              <div className="flex-1 flex items-center justify-center border-2 border-dashed border-border/50 rounded-lg bg-muted/5 m-4">
                <p className="text-sm text-muted-foreground text-center px-4">
                  Select a bar from the weekly chart to reveal hourly data.
                </p>
              </div>
            ) : (
              <div className="flex-1 min-h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={selectedDayData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="timeLabel" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} 
                      interval="preserveStartEnd"
                      minTickGap={20}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} 
                      domain={[0, 100]}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '6px' }}
                      itemStyle={{ color: 'hsl(var(--secondary))', fontWeight: 600 }}
                      labelStyle={{ color: 'hsl(var(--muted-foreground))', fontSize: '12px', marginBottom: '4px' }}
                      formatter={(value: number) => [`${value} Index`, 'Congestion']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="congestion_index" 
                      stroke="hsl(var(--secondary))" 
                      strokeWidth={3}
                      dot={{ r: 3, fill: 'hsl(var(--card))', strokeWidth: 2 }}
                      activeDot={{ r: 6, fill: 'hsl(var(--secondary))' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
