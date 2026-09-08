import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Filter, RefreshCw, Save, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useServerFn } from '@tanstack/react-start';
import { getParmenionLensOptions } from '@/lib/parmenion/lensOptions.functions';

type LensType = 'location' | 'persona' | 'cluster';
type ProofLevel = 'none' | 'weak' | 'strong';

interface LensOption {
  value: string;
  label: string;
  level?: 'region' | 'department' | 'city';
  region?: string | null;
  proof_level: ProofLevel;
  proof_signals: Record<string, number | boolean>;
}

interface LensOptionsPayload {
  tracked_site_id: string | null;
  locations: LensOption[];
  personas: LensOption[];
  clusters: LensOption[];
  directories: { value: string; label: string; pages: number }[];
  pages: { value: string; label: string }[];
  warning?: string;
}

interface LensRow {
  lens_type: LensType;
  enabled: boolean;
  values: string[];
  share_pct: number;
  publish_directory: string | null;
  conversion_target: { mode: 'free' | 'page' | 'directory'; value?: string };
  proof_level: string;
}

const LENS_LABELS: Record<LensType, { title: string; hint: string }> = {
  location: {
    title: 'Localisation',
    hint: 'Villes et régions détectées dans la zone commerciale, les requêtes Search Console et les mots-clés.',
  },
  persona: {
    title: 'Persona',
    hint: 'Segments issus de la carte d’identité du site (audience et cibles clients).',
  },
  cluster: {
    title: 'Thématique',
    hint: 'Clusters sémantiques du site, ordonnés par volume de recherche mesuré.',
  },
};

const PROOF_BADGE: Record<ProofLevel, { label: string; className: string }> = {
  strong: { label: 'Preuve solide', className: 'text-green-600 border-green-500/40' },
  weak: { label: 'Preuve faible', className: 'text-amber-500 border-amber-500/40' },
  none: { label: 'Non mesuré', className: 'text-muted-foreground border-border' },
};

function defaultRow(lens_type: LensType): LensRow {
  return {
    lens_type,
    enabled: false,
    values: [],
    share_pct: 30,
    publish_directory: null,
    conversion_target: { mode: 'free' },
    proof_level: 'unknown',
  };
}

export interface ParmenionTargetingLensesProps {
  targetDomain: string;
}

export function ParmenionTargetingLenses({ targetDomain }: ParmenionTargetingLensesProps) {
  const { toast } = useToast();
  const fetchOptions = useServerFn(getParmenionLensOptions);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [options, setOptions] = useState<LensOptionsPayload | null>(null);
  const [rows, setRows] = useState<Record<LensType, LensRow>>({
    location: defaultRow('location'),
    persona: defaultRow('persona'),
    cluster: defaultRow('cluster'),
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<LensType | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: target } = await supabase
        .from('parmenion_targets')
        .select('id')
        .eq('domain', targetDomain)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setTargetId(target?.id ?? null);

      if (target?.id) {
        const { data: lenses } = await supabase
          .from('parmenion_targeting_lenses')
          .select('lens_type, enabled, values, share_pct, publish_directory, conversion_target, proof_level')
          .eq('target_id', target.id);

        const next: Record<LensType, LensRow> = {
          location: defaultRow('location'),
          persona: defaultRow('persona'),
          cluster: defaultRow('cluster'),
        };
        for (const row of lenses || []) {
          const type = row.lens_type as LensType;
          if (!next[type]) continue;
          next[type] = {
            lens_type: type,
            enabled: Boolean(row.enabled),
            values: Array.isArray(row.values) ? (row.values as string[]) : [],
            share_pct: Number(row.share_pct ?? 30),
            publish_directory: (row.publish_directory as string | null) ?? null,
            conversion_target: (row.conversion_target as LensRow['conversion_target']) ?? { mode: 'free' },
            proof_level: (row.proof_level as string) ?? 'unknown',
          };
        }
        setRows(next);
      }

      const payload = (await fetchOptions({ data: { domain: targetDomain } })) as LensOptionsPayload;
      setOptions(payload);
    } catch (e) {
      toast({
        title: 'Chargement des lentilles impossible',
        description: e instanceof Error ? e.message : 'Erreur inconnue',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [targetDomain, fetchOptions, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const optionsFor = useMemo(
    () => (type: LensType): LensOption[] => {
      if (!options) return [];
      if (type === 'location') return options.locations;
      if (type === 'persona') return options.personas;
      return options.clusters;
    },
    [options],
  );

  const update = (type: LensType, patch: Partial<LensRow>) => {
    setRows((prev) => ({ ...prev, [type]: { ...prev[type], ...patch } }));
  };

  const toggleValue = (type: LensType, value: string) => {
    setRows((prev) => {
      const current = prev[type];
      const values = current.values.includes(value)
        ? current.values.filter((v) => v !== value)
        : [...current.values, value];
      return { ...prev, [type]: { ...current, values } };
    });
  };

  const save = async (type: LensType) => {
    if (!targetId) {
      toast({
        title: 'Cible Parménion introuvable',
        description: 'Ce domaine n’est pas encore enregistré comme cible Parménion.',
        variant: 'destructive',
      });
      return;
    }
    const row = rows[type];
    if (row.enabled && row.values.length === 0) {
      toast({
        title: 'Sélection vide',
        description: 'Cochez au moins une valeur avant d’activer la lentille.',
        variant: 'destructive',
      });
      return;
    }

    // Niveau de preuve = le plus faible parmi les valeurs retenues (garde anti-page vide)
    const selected = optionsFor(type).filter((o) => row.values.includes(o.value));
    const rank: Record<ProofLevel, number> = { strong: 2, weak: 1, none: 0 };
    const weakest = selected.reduce<ProofLevel>(
      (acc, o) => (rank[o.proof_level] < rank[acc] ? o.proof_level : acc),
      'strong',
    );

    setSaving(type);
    try {
      const { error } = await supabase.from('parmenion_targeting_lenses').upsert(
        {
          target_id: targetId,
          lens_type: type,
          enabled: row.enabled,
          values: row.values,
          share_pct: row.share_pct,
          publish_directory: row.publish_directory,
          conversion_target: row.conversion_target,
          proof_level: selected.length ? weakest : 'unknown',
          proof_signals: Object.fromEntries(selected.map((o) => [o.value, o.proof_signals])),
        },
        { onConflict: 'target_id,lens_type' },
      );
      if (error) throw error;
      toast({ title: `Lentille « ${LENS_LABELS[type].title} » enregistrée` });
      update(type, { proof_level: selected.length ? weakest : 'unknown' });
    } catch (e) {
      toast({
        title: 'Enregistrement impossible',
        description: e instanceof Error ? e.message : 'Erreur inconnue',
        variant: 'destructive',
      });
    } finally {
      setSaving(null);
    }
  };

  const totalShare = (['location', 'persona', 'cluster'] as LensType[])
    .filter((t) => rows[t].enabled)
    .reduce((sum, t) => sum + rows[t].share_pct, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Filter className="h-4 w-4 text-primary" />
          Lentilles de ciblage
        </CardTitle>
        <CardDescription className="text-xs">
          Filtres additifs appliqués uniquement à la création de nouvelles pages. Le reste du site continue
          d’être optimisé normalement.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5" />
            Part cumulée orientée : {totalShare} % des nouvelles pages
            {totalShare > 50 && (
              <Badge variant="outline" className="text-destructive border-destructive/40 text-[10px]">
                Plafond conseillé 50 % dépassé
              </Badge>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            <span className="ml-2">Recharger</span>
          </Button>
        </div>

        {options?.warning && (
          <p className="text-xs text-amber-500">{options.warning}</p>
        )}

        {(['location', 'persona', 'cluster'] as LensType[]).map((type) => {
          const row = rows[type];
          const opts = optionsFor(type);
          return (
            <div key={type} className="rounded-md border border-border p-3 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{LENS_LABELS[type].title}</span>
                    {row.enabled && (
                      <Badge variant="outline" className="text-[10px]">{row.share_pct} %</Badge>
                    )}
                    {row.enabled && row.proof_level !== 'unknown' && (
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${PROOF_BADGE[(row.proof_level as ProofLevel)]?.className ?? ''}`}
                      >
                        {PROOF_BADGE[(row.proof_level as ProofLevel)]?.label ?? row.proof_level}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{LENS_LABELS[type].hint}</p>
                </div>
                <Switch
                  checked={row.enabled}
                  onCheckedChange={(checked) => update(type, { enabled: checked })}
                  disabled={opts.length === 0}
                />
              </div>

              {opts.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Aucune valeur mesurée disponible pour ce domaine.
                </p>
              ) : (
                <ScrollArea className="h-40 rounded border border-border/60 p-2">
                  <div className="space-y-1">
                    {opts.map((opt) => (
                      <label
                        key={opt.value}
                        className="flex items-center justify-between gap-2 text-xs py-1 cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <Checkbox
                            checked={row.values.includes(opt.value)}
                            onCheckedChange={() => toggleValue(type, opt.value)}
                            disabled={!row.enabled}
                          />
                          <span>{opt.label}</span>
                        </span>
                        <Badge variant="outline" className={`text-[10px] ${PROOF_BADGE[opt.proof_level].className}`}>
                          {PROOF_BADGE[opt.proof_level].label}
                        </Badge>
                      </label>
                    ))}
                  </div>
                </ScrollArea>
              )}

              {row.enabled && (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs mb-1">
                      Part des nouvelles pages orientées : <strong>{row.share_pct} %</strong>
                    </p>
                    <Slider
                      value={[row.share_pct]}
                      min={0}
                      max={50}
                      step={5}
                      onValueChange={([v]) => update(type, { share_pct: v ?? 0 })}
                    />
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <p className="text-xs mb-1">Répertoire de publication</p>
                      <Select
                        value={row.publish_directory ?? '__free'}
                        onValueChange={(v) => update(type, { publish_directory: v === '__free' ? null : v })}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Libre" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__free">Libre (Parménion choisit)</SelectItem>
                          {(options?.directories || []).map((d) => (
                            <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <p className="text-xs mb-1">Cible de conversion (lien interne imposé)</p>
                      <Select
                        value={
                          row.conversion_target.mode === 'free'
                            ? '__free'
                            : `${row.conversion_target.mode}:${row.conversion_target.value ?? ''}`
                        }
                        onValueChange={(v) => {
                          if (v === '__free') {
                            update(type, { conversion_target: { mode: 'free' } });
                            return;
                          }
                          const [mode, ...rest] = v.split(':');
                          update(type, {
                            conversion_target: {
                              mode: mode === 'directory' ? 'directory' : 'page',
                              value: rest.join(':'),
                            },
                          });
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Libre" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__free">Libre (meilleure page selon PageRank)</SelectItem>
                          {(options?.directories || []).map((d) => (
                            <SelectItem key={`dir-${d.value}`} value={`directory:${d.value}`}>
                              Répertoire {d.value}
                            </SelectItem>
                          ))}
                          {(options?.pages || []).slice(0, 100).map((p) => (
                            <SelectItem key={`page-${p.value}`} value={`page:${p.value}`}>
                              Page {p.value}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => void save(type)} disabled={saving === type}>
                  <Save className="h-4 w-4" />
                  <span className="ml-2">Enregistrer</span>
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
