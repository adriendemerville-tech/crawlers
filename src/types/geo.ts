export interface GeoFactor {
  id: string;
  name: string;
  description: string;
  score: number;
  maxScore: number;
  status: 'good' | 'warning' | 'error';
  recommendation?: string;
  details?: string;
  isJsGenerated?: boolean;
}

export interface GeoResult {
  url: string;
  totalScore: number;
  factors: GeoFactor[];
  scannedAt: string;
}
