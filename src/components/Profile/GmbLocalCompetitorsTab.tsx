import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  TrendingUp, TrendingDown, Minus, MapPin, Star, Globe, Search,
  RefreshCw, Trophy, Target, Swords, Lightbulb, ArrowUp, ArrowDown,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Competitor {
  id?: string;
  competitor_name: string;
  competitor_place_id?: string;
  competitor_address?: string;
  competitor_category?: string;
  competitor_website?: string;
  avg_rating?: number;
  total_reviews?: number;
  maps_position?: number;
  previous_position?: number;
  position_change?: number;
  name?: string;
  rating?: number;
  reviews_count?: number;
  position?: number;
}

interface Props {
  gmbLocationId: string | null;
  trackedSiteId: string | null;
  ownBusinessName: string;
}

// Simulated data when no real data
const SIMULATED_COMPETITORS: Competitor[] = [
  { competitor_name: 'Le Petit Bistrot', competitor_address: '12 Rue de la Paix, Paris', competitor_category: 'Restaurant', avg_rating: 4.6, total_reviews: 234, maps_position: 1, previous_position: 1, position_change: 0 },
  { competitor_name: 'Chez Marcel', competitor_address: '45 Avenue des Champs, Paris', competitor_category: 'Restaurant', avg_rating: 4.3, total_reviews: 189, maps_position: 2, previous_position: 4, position_change: 2 },
  { competitor_name: 'La Belle Époque', competitor_address: '8 Boulevard Haussmann, Paris', competitor_category: 'Restaurant', avg_rating: 4.5, total_reviews: 312, maps_position: 3, previous_position: 2, position_change: -1 },
  { competitor_name: 'Café de Flore', competitor_address: '172 Bd Saint-Germain, Paris', competitor_category: 'Café', avg_rating: 4.1, total_reviews: 1203, maps_position: 4, previous_position: 3, position_change: -1 },
  { competitor_name: 'L\'Atelier Gourmand', competitor_address: '23 Rue Montorgueil, Paris', competitor_category: 'Restaurant', avg_rating: 4.7, total_reviews: 98, maps_position: 5, previous_position: 7, position_change: 2 },
  { competitor_name: 'Brasserie Lipp', competitor_address: '151 Bd Saint-Germain, Paris', competitor_category: 'Brasserie', avg_rating: 3.9, total_reviews: 876, maps_position: 6, previous_position: 5, position_change: -1 },
  { competitor_name: 'Le Comptoir', competitor_address: '9 Carrefour de l\'Odéon, Paris', competitor_category: 'Restaurant', avg_rating: 4.4, total_reviews: 567, maps_position: 7, previous_position: 8, position_change: 1 },
  { competitor_name: 'Chez Janou', competitor_address: '2 Rue Roger Verlomme, Paris', competitor_category: 'Restaurant', avg_rating: 4.2, total_reviews: 445, maps_position: 8, previous_position: 6, position_change: -2 },
  { competitor_name: 'Le Bouillon Chartier', competitor_address: '7 Rue du Faubourg, Paris', competitor_category: 'Restaurant', avg_rating: 4.0, total_reviews: 2100, maps_position: 9, previous_position: 9, position_change: 0 },
  { competitor_name: 'La Rotonde', competitor_address: '105 Bd Montparnasse, Paris', competitor_category: 'Brasserie', avg_rating: 3.8, total_reviews: 654, maps_position: 10, previous_position: 10, position_change: 0 },
];

function getPositionIcon(position: number) {
  if (position === 1) return <Trophy className="h-4 w-4 text-yellow-500" />;
  if (position <= 3) return <Target className="h-4 w-4 text-primary" />;
  if (position <= 7) return <Swords className="h-4 w-4 text-muted-foreground" />;
  return <Lightbulb className="h-4 w-4 text-muted-foreground/60" />;
}

function getPositionLabel(position: number) {
  if (position === 1) return 'Goliath';
  if (position <= 3) return 'Concurrent direct';
  if (position <= 7) return 'Challenger';
  return 'Inspiration';
}

function getPositionBadgeClass(position: number) {
  if (position === 1) return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30';
  if (position <= 3) return 'bg-primary/10 text-primary border-primary/30';
  if (position <= 7) return 'bg-muted text-muted-foreground border-border';
  return 'bg-muted/50 text-muted-foreground/70 border-border/50';
}

export function GmbLocalCompetitorsTab({ gmbLocationId, trackedSiteId, ownBusinessName }: Props) {
  const [competitors, setCompetitors] = useState<Competitor[]>(SIMULATED_COMPETITORS);
  const [isScanning, setIsScanning] = useState(false);
  const [isSimulated, setIsSimulated] = useState(true);
  const [searchInfo, setSearchInfo] = useState<{ query?: string; location?: string; radius_km?: number } | null>(null);

  const handleScan = async () => {
    if (!gmbLocationId || !trackedSiteId) {
      toast.error('Aucune fiche GMB connectée');
      return;
    }

    setIsScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke('gmb-local-competitors', {
        body: { action: 'scan', gmb_location_id: gmbLocationId, tracked_site_id: trackedSiteId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const results = (data.competitors || []).map((c: any) => ({
        competitor_name: c.name || c.competitor_name,
        competitor_address: c.address || c.competitor_address,
        competitor_category: c.category || c.competitor_category,
        competitor_website: c.website || c.competitor_website,
        avg_rating: c.rating || c.avg_rating,
        total_reviews: c.reviews_count || c.total_reviews,
        maps_position: c.position || c.maps_position,
        position_change: c.position_change || 0,
        previous_position: c.previous_position || null,
      }));

      setCompetitors(results);
      setIsSimulated(false);
      setSearchInfo({ query: data.search_query, location: data.location, radius_km: data.radius_km });
      toast.success(`${results.length} concurrents trouvés`);
    } catch (e: any) {
      console.error('Scan error:', e);
      toast.error(e.message || 'Erreur lors du scan');
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Simulated banner */}
      {isSimulated && (
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg border border-amber-500/30 bg-amber-500/5">
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Données simulées — Lancez un scan pour voir vos vrais concurrents
          </p>
        </div>
      )}

      {/* Search info + scan button */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {searchInfo ? (
            <span className="flex items-center gap-1">
              <Search className="h-3 w-3" />
              "{searchInfo.query}" · {searchInfo.location} · ~{searchInfo.radius_km}km
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" /> Concurrence locale Google Maps
            </span>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleScan}
          disabled={isScanning}
          className="text-xs gap-1"
        >
          <RefreshCw className={`h-3 w-3 ${isScanning ? 'animate-spin' : ''}`} />
          {isScanning ? 'Scan...' : 'Scanner'}
        </Button>
      </div>

      {/* Competitors list */}
      <div className="space-y-2">
        {competitors.map((comp, idx) => {
          const pos = comp.maps_position || comp.position || idx + 1;
          const change = comp.position_change || 0;
          const rating = comp.avg_rating || comp.rating || 0;
          const reviews = comp.total_reviews || comp.reviews_count || 0;

          return (
            <Card key={comp.competitor_place_id || comp.competitor_name + idx} className="overflow-hidden">
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  {/* Position number */}
                  <div className="flex flex-col items-center shrink-0 w-8">
                    <span className="text-lg font-bold text-foreground">#{pos}</span>
                    {/* Position change arrow */}
                    {change > 0 ? (
                      <span className="flex items-center text-[10px] text-green-500 font-medium">
                        <ArrowUp className="h-3 w-3" />{change}
                      </span>
                    ) : change < 0 ? (
                      <span className="flex items-center text-[10px] text-red-500 font-medium">
                        <ArrowDown className="h-3 w-3" />{Math.abs(change)}
                      </span>
                    ) : (
                      <span className="flex items-center text-[10px] text-muted-foreground">
                        <Minus className="h-3 w-3" />
                      </span>
                    )}
                  </div>

                  {/* Business info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{comp.competitor_name}</span>
                      {getPositionIcon(pos)}
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {comp.competitor_address || comp.competitor_category || ''}
                    </p>
                    {comp.competitor_website && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <a
                              href={comp.competitor_website.startsWith('http') ? comp.competitor_website : `https://${comp.competitor_website}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-primary/70 hover:text-primary flex items-center gap-0.5 mt-0.5"
                            >
                              <Globe className="h-2.5 w-2.5" />
                              {comp.competitor_website.replace(/^https?:\/\//, '').slice(0, 30)}
                            </a>
                          </TooltipTrigger>
                          <TooltipContent>{comp.competitor_website}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>

                  {/* Rating + reviews */}
                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-1 justify-end">
                      <span className="text-sm font-semibold">{rating > 0 ? rating.toFixed(1) : '—'}</span>
                      <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                    </div>
                    <p className="text-[10px] text-muted-foreground">{reviews > 0 ? `${reviews} avis` : ''}</p>
                    <Badge variant="outline" className={`text-[9px] mt-1 ${getPositionBadgeClass(pos)}`}>
                      {getPositionLabel(pos)}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {competitors.length === 0 && !isScanning && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          Aucun concurrent trouvé. Lancez un scan pour commencer.
        </div>
      )}
    </div>
  );
}
