/**
 * useMachineLayerStatus — source de vérité pour l'état Machine Layer d'une URL/domaine.
 *
 * Lit la dernière ligne de `machine_layer_scans` correspondant au target
 * (URL exacte si fournie, sinon dernier scan du domaine pour l'utilisateur).
 *
 * Renvoie :
 *  - status   : 'idle' (jamais scanné) | 'fresh' (<24h) | 'stale' (>24h) | 'loading' | 'error'
 *  - score    : dernier score global (0-100) ou null
 *  - scannedAt: Date du dernier scan ou null
 *  - url      : URL effectivement scannée (utile quand on a passé un domaine)
 *  - refresh  : refetch manuel
 *
 * Convention : "fresh" = scan datant de moins de STALE_HOURS heures.
 */
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const STALE_HOURS = 24;

export type MachineLayerStatus = 'idle' | 'fresh' | 'stale' | 'loading' | 'error';

export interface MachineLayerStatusResult {
  status: MachineLayerStatus;
  score: number | null;
  scannedAt: Date | null;
  url: string | null;
  scanId: string | null;
  refresh: () => void;
}

interface Options {
  /** URL exacte à chercher (priorité). */
  url?: string | null;
  /** Sinon, dernier scan pour ce domaine. */
  domain?: string | null;
  /** Désactive complètement le hook (ex: en attente d'un site sélectionné). */
  enabled?: boolean;
}

export function useMachineLayerStatus({ url, domain, enabled = true }: Options): MachineLayerStatusResult {
  const { user } = useAuth();
  const [state, setState] = useState<Omit<MachineLayerStatusResult, 'refresh'>>({
    status: 'loading',
    score: null,
    scannedAt: null,
    url: null,
    scanId: null,
  });

  const target = url || domain || null;

  const fetchStatus = useCallback(async () => {
    if (!enabled || !target) {
      setState({ status: 'idle', score: null, scannedAt: null, url: null, scanId: null });
      return;
    }

    setState(prev => ({ ...prev, status: 'loading' }));

    let query = supabase
      .from('machine_layer_scans')
      .select('id, url, score_global, created_at')
      .order('created_at', { ascending: false })
      .limit(1);

    if (url) {
      query = query.eq('url', url);
    } else if (domain) {
      query = query.eq('domain', domain);
    }

    // Restreindre au user si connecté pour éviter de leak un scan anonyme
    // d'une autre IP sur la même URL publique.
    if (user?.id) {
      query = query.eq('user_id', user.id);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      setState({ status: 'error', score: null, scannedAt: null, url: null, scanId: null });
      return;
    }

    if (!data) {
      setState({ status: 'idle', score: null, scannedAt: null, url: null, scanId: null });
      return;
    }

    const scannedAt = new Date(data.created_at);
    const ageHours = (Date.now() - scannedAt.getTime()) / 36e5;
    const status: MachineLayerStatus = ageHours <= STALE_HOURS ? 'fresh' : 'stale';

    setState({
      status,
      score: data.score_global ?? null,
      scannedAt,
      url: data.url,
      scanId: data.id,
    });
  }, [enabled, target, url, domain, user?.id]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return { ...state, refresh: fetchStatus };
}

/** Helper d'affichage : "il y a 3h", "hier", "il y a 5j". */
export function formatRelativeAge(date: Date | null): string {
  if (!date) return '';
  const diffMs = Date.now() - date.getTime();
  const hours = Math.floor(diffMs / 36e5);
  if (hours < 1) return 'à l\'instant';
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'hier';
  if (days < 30) return `il y a ${days}j`;
  const months = Math.floor(days / 30);
  return `il y a ${months} mois`;
}
