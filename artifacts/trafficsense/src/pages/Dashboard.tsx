import { useState } from 'react';
import SummaryStats from '@/components/SummaryStats';
import SearchForm from '@/components/SearchForm';
import PredictionPanel from '@/components/PredictionPanel';
import MapView from '@/components/MapView';

export default function Dashboard() {
  const [prediction, setPrediction] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [selectedRouteId, setSelectedRouteId] = useState('fastest');

  const handleResult = (result: any) => {
    setPrediction(result);
    // Auto-select fastest route on new prediction
    if (result?.route_alternatives?.length) {
      setSelectedRouteId(result.route_alternatives[0].id);
    }
  };

  return (
    <div className="flex flex-col flex-1 p-4 gap-4 min-h-0 overflow-y-auto lg:overflow-hidden" data-testid="dashboard-page">
      {/* Live summary bar */}
      <SummaryStats />

      {/* Main workspace */}
      <div className="flex flex-col lg:flex-row flex-1 gap-4 min-h-0">
        {/* Left sidebar */}
        <div className="w-full lg:w-[380px] flex flex-col gap-4 lg:overflow-y-auto pr-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border">
          <SearchForm onResult={handleResult} onLoading={setIsLoading} onError={setIsError} />
          <PredictionPanel
            result={prediction}
            isLoading={isLoading}
            isError={isError}
            selectedRouteId={selectedRouteId}
            onRouteSelect={setSelectedRouteId}
          />
          <div className="px-1 pb-2 flex items-center gap-1.5">
            <div className="h-px flex-1 bg-border/40" />
            <span className="text-[10px] text-muted-foreground/40 font-medium tracking-widest uppercase">TrafficSense ML v1.0</span>
            <div className="h-px flex-1 bg-border/40" />
          </div>
        </div>

        {/* Map */}
        <div
          className="flex-1 min-h-[420px] rounded-xl overflow-hidden border border-border/60 shadow-sm relative"
          data-testid="map-wrapper"
        >
          <MapView
            result={prediction}
            selectedRouteId={selectedRouteId}
            onRouteSelect={setSelectedRouteId}
          />
        </div>
      </div>
    </div>
  );
}