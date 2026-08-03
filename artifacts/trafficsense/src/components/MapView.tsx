import { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import type { PredictionResult, RouteAlternative } from '@/types/traffic';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl, shadowUrl: iconShadow });

// ── Custom markers ──────────────────────────────────────────────────────────
const makePin = (bg: string, label: string) =>
  L.divIcon({
    className: '',
    html: `<div style="width:32px;height:32px;background:${bg};border:2.5px solid rgba(255,255,255,0.9);border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 4px 14px rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;">
      <span style="transform:rotate(45deg);color:#fff;font-weight:800;font-size:11px;line-height:1;font-family:Inter,sans-serif;">${label}</span>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -36],
  });

const originIcon = makePin('#0ea5e9', 'A');
const destIcon   = makePin('#14b8a6', 'B');

// ── Tile layers ─────────────────────────────────────────────────────────────
const LAYERS = [
  { id: 'dark',      label: 'Dark',      icon: '🌑', url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',     attr: '© OSM © CARTO' },
  { id: 'light',     label: 'Light',     icon: '☀️', url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',    attr: '© OSM © CARTO' },
  { id: 'satellite', label: 'Satellite', icon: '🛰️', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr: '© Esri' },
  { id: 'streets',   label: 'Streets',   icon: '🗺️', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',                attr: '© OpenStreetMap contributors' },
  { id: 'toner',     label: 'Toner',     icon: '⬛', url: 'https://stamen-tiles-{s}.a.ssl.fastly.net/toner/{z}/{x}/{y}{r}.png', attr: '© Stamen Design © OSM' },
] as const;
type LayerId = (typeof LAYERS)[number]['id'];

// ── Route colour config ─────────────────────────────────────────────────────
const ROUTE_STYLES: Record<string, { stroke: string; dash?: string }> = {
  fastest: { stroke: '#ffffff' },
  balanced: { stroke: '#a78bfa' },   // violet
  scenic:  { stroke: '#fb923c' },   // orange
};

const CONGESTION_COLOR: Record<string, string> = {
  light:    '#22c55e',
  moderate: '#eab308',
  heavy:    '#ef4444',
};

// ── Types ───────────────────────────────────────────────────────────────────
interface Segment {
  lat_start: number; lng_start: number;
  lat_end: number;   lng_end: number;
  congestion_level: string;
}
interface RouteAlt {
  id: string; name: string; tag: string; via: string;
  estimated_minutes: number; congestion_level: string;
  confidence_score?: number;
  segments: Segment[];
}
interface Result {
  origin_coords: { lat: number; lng: number };
  destination_coords: { lat: number; lng: number };
  route_segments: Segment[];
  route_alternatives?: RouteAlt[];
}

interface MapViewProps {
  result: Result | null;
  selectedRouteId: string;
  onRouteSelect: (id: string) => void;
}

// ── Handles cases where the map container is resized/revealed after mount
// (e.g. mobile scroll reveal, sidebar collapse) — without this, Leaflet
// keeps stale tile dimensions and renders a blank map.
function MapResizeHandler() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 100);

    const container = map.getContainer();
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(container);

    const onWinResize = () => map.invalidateSize();
    window.addEventListener('resize', onWinResize);

    return () => {
      clearTimeout(t);
      resizeObserver.disconnect();
      window.removeEventListener('resize', onWinResize);
    };
  }, [map]);
  return null;
}

// ── Map auto-fit ────────────────────────────────────────────────────────────
function MapUpdater({ result }: { result: Result | null }) {
  const map = useMap();
  useEffect(() => {
    if (result) {
      const allPts: [number, number][] = [
        [result.origin_coords.lat,      result.origin_coords.lng],
        [result.destination_coords.lat, result.destination_coords.lng],
      ];
      (result.route_alternatives ?? []).forEach((r) =>
        r.segments.forEach((s) => {
          allPts.push([s.lat_start, s.lng_start], [s.lat_end, s.lng_end]);
        })
      );
      map.fitBounds(L.latLngBounds(allPts), { padding: [56, 56], animate: true, duration: 1 });
    } else {
      map.flyTo([12.9716, 77.5946], 12, { animate: true, duration: 1 }); // Bangalore, India
    }
  }, [result, map]);
  return null;
}

export default function MapView({ result, selectedRouteId, onRouteSelect }: MapViewProps) {
  const [activeLayer, setActiveLayer] = useState<LayerId>('dark');
  const [showLayers, setShowLayers] = useState(false);
  const [showLegend, setShowLegend] = useState(true);

  const currentLayer = LAYERS.find((l) => l.id === activeLayer)!;
  const routes = result?.route_alternatives ?? [];
  const activeRoute = routes.find((r) => r.id === selectedRouteId) ?? routes[0];
  const fallbackSegments = result?.route_segments ?? [];

  const handleLayerSelect = useCallback((id: LayerId) => {
    setActiveLayer(id);
    setShowLayers(false);
  }, []);

  const getLabelColor = (level: string) => CONGESTION_COLOR[level] ?? '#3b82f6';

  return (
    <div className="w-full h-full relative" data-testid="map-container">
      <MapContainer center={[12.9716, 77.5946]} zoom={12} className="w-full h-full" zoomControl={false}>
        <TileLayer key={activeLayer} url={currentLayer.url} attribution={currentLayer.attr} maxZoom={19} />
        <ZoomControl position="bottomright" />
        <MapResizeHandler />
        <MapUpdater result={result} />

        {result && (
          <>
            {routes.filter((r) => r.id !== selectedRouteId).map((route) => (
              <span key={`inactive-${route.id}`}>
                {route.segments.map((seg, i) => (
                  <Polyline
                    key={`${route.id}-${i}`}
                    positions={[[seg.lat_start, seg.lng_start], [seg.lat_end, seg.lng_end]]}
                    pathOptions={{
                      color: ROUTE_STYLES[route.id]?.stroke ?? '#8b8b8b',
                      weight: 4,
                      opacity: 0.28,
                      lineCap: 'round', lineJoin: 'round',
                      dashArray: '6 4',
                    }}
                    eventHandlers={{ click: () => onRouteSelect(route.id) }}
                  />
                ))}
              </span>
            ))}

            {(activeRoute?.segments ?? fallbackSegments).map((seg, i) => (
              <Polyline
                key={`shadow-${i}`}
                positions={[[seg.lat_start, seg.lng_start], [seg.lat_end, seg.lng_end]]}
                pathOptions={{ color: '#000', weight: 10, opacity: 0.15, lineCap: 'round', lineJoin: 'round' }}
              />
            ))}
            {(activeRoute?.segments ?? fallbackSegments).map((seg, i) => (
              <Polyline
                key={`active-${i}`}
                positions={[[seg.lat_start, seg.lng_start], [seg.lat_end, seg.lng_end]]}
                pathOptions={{
                  color: CONGESTION_COLOR[seg.congestion_level] ?? '#3b82f6',
                  weight: 6, opacity: 0.95, lineCap: 'round', lineJoin: 'round',
                }}
              />
            ))}

            <Marker position={[result.origin_coords.lat, result.origin_coords.lng]} icon={originIcon}>
              <Popup><div className="text-xs font-semibold text-sky-500 mb-0.5">Origin</div><div className="text-xs text-muted-foreground">{result.origin_coords.lat.toFixed(4)}, {result.origin_coords.lng.toFixed(4)}</div></Popup>
            </Marker>
            <Marker position={[result.destination_coords.lat, result.destination_coords.lng]} icon={destIcon}>
              <Popup><div className="text-xs font-semibold text-teal-500 mb-0.5">Destination</div><div className="text-xs text-muted-foreground">{result.destination_coords.lat.toFixed(4)}, {result.destination_coords.lng.toFixed(4)}</div></Popup>
            </Marker>
          </>
        )}
      </MapContainer>

      {routes.length > 0 && (
        <div className="absolute top-3 left-3 z-[1000] flex flex-col gap-1.5">
          {routes.map((route) => {
            const isActive = route.id === selectedRouteId;
            const routeColor = ROUTE_STYLES[route.id]?.stroke ?? '#fff';
            const congColor = getLabelColor(route.congestion_level);
            return (
              <button
                key={route.id}
                onClick={() => onRouteSelect(route.id)}
                className={`group flex items-center gap-2.5 rounded-xl border backdrop-blur-sm shadow-lg px-3 py-2 text-left transition-all ${
                  isActive
                    ? 'bg-card/97 border-border scale-100'
                    : 'bg-card/75 border-border/50 opacity-80 hover:opacity-100 hover:bg-card/90'
                }`}
                data-testid={`route-btn-${route.id}`}
              >
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: isActive ? congColor : routeColor, opacity: isActive ? 1 : 0.6 }} />
                <div className="flex flex-col leading-none gap-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-bold ${isActive ? 'text-foreground' : 'text-foreground/60'}`}>{route.name}</span>
                    <span className="text-[9px] font-mono font-bold px-1 py-0.5 rounded" style={{ background: `${congColor}20`, color: congColor }}>{route.estimated_minutes}m</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground/70 truncate max-w-[130px]">via {route.via}</span>
                </div>
                {isActive && (
                  <svg className="w-3 h-3 text-primary ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2">
        <button
          onClick={() => setShowLayers((p) => !p)}
          className="flex items-center gap-1.5 bg-card/95 backdrop-blur-sm border border-border text-foreground text-xs font-medium px-3 py-2 rounded-lg shadow-lg hover:bg-card transition-colors"
          data-testid="layer-toggle-button"
        >
          <svg className="w-3.5 h-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          Layers
        </button>

        {showLayers && (
          <div className="bg-card/97 backdrop-blur-md border border-border rounded-xl shadow-2xl overflow-hidden w-44">
            <div className="px-3 py-2 border-b border-border bg-muted/30">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Map Style</span>
            </div>
            {LAYERS.map((layer) => (
              <button
                key={layer.id}
                onClick={() => handleLayerSelect(layer.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/50 ${
                  activeLayer === layer.id ? 'bg-primary/10 text-primary font-semibold' : 'text-foreground'
                }`}
                data-testid={`layer-option-${layer.id}`}
              >
                <span className="text-base leading-none">{layer.icon}</span>
                <span>{layer.label}</span>
                {activeLayer === layer.id && (
                  <svg className="ml-auto w-3.5 h-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {showLegend && (
        <div className="absolute bottom-10 left-3 z-[1000] bg-card/95 backdrop-blur-sm border border-border rounded-xl shadow-lg px-3 py-2.5 flex flex-col gap-1.5">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Congestion</span>
            <button onClick={() => setShowLegend(false)} className="text-muted-foreground hover:text-foreground ml-3 text-xs leading-none">✕</button>
          </div>
          {[{ color: '#22c55e', label: 'Light' }, { color: '#eab308', label: 'Moderate' }, { color: '#ef4444', label: 'Heavy' }].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-2">
              <div className="w-8 h-2.5 rounded-full" style={{ background: color }} />
              <span className="text-xs text-foreground/80 font-medium">{label}</span>
            </div>
          ))}
          <div className="border-t border-border/40 mt-1 pt-1.5 flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">Routes</span>
            {[{ color: '#ffffff', label: 'Fastest', dash: false }, { color: '#a78bfa', label: 'Balanced', dash: true }, { color: '#fb923c', label: 'Scenic', dash: true }].map(({ color, label, dash }) => (
              <div key={label} className="flex items-center gap-2">
                <div className="w-8 h-1 rounded-full" style={{ background: dash ? `repeating-linear-gradient(90deg,${color} 0,${color} 4px,transparent 4px,transparent 8px)` : color }} />
                <span className="text-xs text-foreground/80 font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {!showLegend && (
        <button onClick={() => setShowLegend(true)} className="absolute bottom-10 left-3 z-[1000] bg-card/95 backdrop-blur-sm border border-border rounded-lg shadow-lg px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">Legend</button>
      )}

      {!result && (
        <div className="absolute inset-0 z-[999] pointer-events-none flex items-start justify-center pt-14">
          <div className="bg-card/80 backdrop-blur-sm border border-border/60 rounded-xl px-4 py-2.5 shadow-lg flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs text-muted-foreground font-medium">Enter a route to visualize traffic</span>
          </div>
        </div>
      )}
    </div>
  );
}