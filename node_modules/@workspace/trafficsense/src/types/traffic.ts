/** Shared domain types for the TrafficSense frontend */

export type CongestionLevel = 'light' | 'moderate' | 'heavy';

export interface Segment {
  lat_start: number;
  lng_start: number;
  lat_end: number;
  lng_end: number;
  congestion_level: CongestionLevel;
}

export interface RouteAlternative {
  id: string;
  name: string;
  tag: string;
  via: string;
  estimated_minutes: number;
  congestion_level: CongestionLevel;
  confidence_score?: number;
  segments: Segment[];
}

export interface HourlyForecast {
  hour: number;
  congestion_index: number;
  label: CongestionLevel;
}

export interface PredictionResult {
  congestion_level: CongestionLevel;
  estimated_minutes: number;
  hourly_forecast: HourlyForecast[];
  confidence_score: number;
  origin_coords: { lat: number; lng: number };
  destination_coords: { lat: number; lng: number };
  route_segments: Segment[];
  route_alternatives?: RouteAlternative[];
}
