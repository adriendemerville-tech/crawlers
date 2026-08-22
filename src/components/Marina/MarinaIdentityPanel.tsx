import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Lock, RefreshCw, IdCard, ChevronDown, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface SectorOption { key: string; label: string; canonicalText: string }
interface ModelOption { key: string; label: string }

interface IdentityCard {
  domain: string;
  source: string;
  confidence: number;
  sector: string;
  sectorLabelText: string;
  commercialModel: string;
  commercialModelLabelText: string;
  marketSector: string | null;
  productsServices: string | null;
  targetAudience: string | null;
  commercialArea: string | null;
  entityType: string | null;
  isLocalBusiness: boolean | null;
  competitors: string[];
  pagesUsed: string[];
  notes: string[];
}

interface Fields {
  sector: string;
  commercialModel: string;
  productsServices: string;
  targetAudience: string;
  commercialArea: string;
  entityType: string;
  competitors: string;
}

const EMPTY_FIELDS: Fields = {
  sector: '',
  commercialModel: '',
  productsServices: '',
  targetAudience: '',
  commercialArea: '',
  entityType: '',
  competitors: '',
};

function fieldsFromCard(card: IdentityCard): Fields {
  return {
    sector: card.sector && card.sector !== 'unknown' ? card.sector : '',
    commercialModel: card.commercialModel && card.commercialModel !== 'unknown' ? card.commercialModel : '',
    productsServices: card.productsServices || '',
    targetAudience: card.targetAudience || '',
    commercialArea: card.commercialArea || '',
    entityType: card.entityType || '',
    competitors: (card.competitors || []).join(', '),
  };
}

interface Props {
  url: string;
  isAuthenticated: boolean;
}

/**
 * Carte d'identité éditable avant le crawl : le secteur et le modèle d'affaires
 * calibrent les fourchettes de mix de pages du rapport. Verrouiller la carte la
 * rend prioritaire sur toute inférence automatique ultérieure.
 */
export default function MarinaIdentityPanel({ url, isAuthenticated }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<'resolve' | 'recompute' | 'lock' | null>(null);
  const [card, setCard] = useState<IdentityCard | null>(null);
  const [locked, setLocked] = useState(false);
  const [fields, setFields] = useState<Fields>(EMPTY_FIELDS);
  const [baseline, setBaseline] = useState<Fields>(EMPTY_FIELDS);
  const [sectors, setSectors] = useState<SectorOption[]>([]);
  const [models, setModels] = useState<ModelOption[]>([]);

  const dirty = useMemo(
    () => (Object.keys(fields) as (keyof Fields)[]).some((k) => fields[k].trim() !== baseline[k].trim()),
    [fields, baseline],
  );

  // Un changement d'URL invalide la carte affichée.
  useEffect(() => {
    setCard(null);
    setLocked(false);
    setFields(EMPTY_FIELDS);
    setBaseline(EMPTY_FIELDS);
  }, [url]);

  const call = useCallback(async (action: string, extra: Record<string, unknown> = {}) => {
    const session = (await supabase.auth.getSession()).data.session;
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/marina`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, url: url.trim(), ...extra }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data as { card: IdentityCard; locked?: boolean; options?: { sectors: SectorOption[]; commercialModels: ModelOption[] } };
  }, [url]);

  const applyResult = (data: { card: IdentityCard; locked?: boolean; options?: { sectors: SectorOption[]; commercialModels: ModelOption[] } }, resetBaseline: boolean) => {
    setCard(data.card);
    if (typeof data.locked === 'boolean') setLocked(data.locked);
    if (data.options) {
      setSectors(data.options.sectors);
      setModels(data.options.commercialModels);
    }
    const next = fieldsFromCard(data.card);
    if (resetBaseline) {
      setFields(next);
      setBaseline(next);
    } else {
      setBaseline(fields);
    }
  };

  const payload = () => ({
    fields: {
      sector: fields.sector || null,
      commercialModel: fields.commercialModel || null,
      marketSector: fields.sector ? sectors.find((s) => s.key === fields.sector)?.canonicalText || null : null,
      productsServices: fields.productsServices || null,
      targetAudience: fields.targetAudience || null,
      commercialArea: fields.commercialArea || null,
      entityType: fields.entityType || null,
      competitors: fields.competitors
        ? fields.competitors.split(',').map((c) => c.trim()).filter(Boolean)
        : [],
    },
  });

  const run = async (action: 'resolve' | 'recompute' | 'lock', force = false) => {
    if (!url.trim()) { toast.error('Renseignez d’abord une URL.'); return; }
    if (!isAuthenticated) { toast.error('Connectez-vous pour préparer la carte d’identité.'); return; }
    setBusy(action);
    try {
      if (action === 'resolve') {
        applyResult(await call('identity_resolve', { force }), true);
      } else if (action === 'recompute') {
        applyResult(await call('identity_recompute', payload()), false);
        toast.success('Axes recalculés — verrouillez pour enregistrer.');
      } else {
        applyResult(await call('identity_lock', payload()), true);
        setLocked(true);
        toast.success('Carte verrouillée : elle prime sur toute inférence automatique.');
      }
    } catch (e) {
      toast.error((e as Error)?.message || 'Opération impossible.');
    } finally {
      setBusy(null);
    }
  };

  const set = (k: keyof Fields, v: string) => setFields((f) => ({ ...f, [k]: v }));

  return (
    <div className="mt-3 flex h-full flex-col text-left">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 rounded-lg border border-border bg-card/50 px-4 py-3 text-sm text-foreground hover:bg-card transition-colors"
      >
        <span className="flex items-center gap-2">
          <IdCard className="w-4 h-4 text-primary" />
          Carte d’identité du site
          {locked && <Badge variant="outline" className="border-primary/40 text-primary">Verrouillée</Badge>}
          {card && !locked && (
            <span className="text-xs text-muted-foreground">confiance {card.confidence}/100</span>
          )}
        </span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="mt-2 rounded-lg border border-border bg-card/40 p-4 space-y-4">
          <p className="text-xs text-muted-foreground">
            Le secteur et le modèle d’affaires calibrent les fourchettes de mix de pages du rapport.
            Vérifiez-les avant de lancer le crawl : une carte verrouillée est réputée exacte et n’est plus réinférée.
          </p>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => run('resolve')}
              disabled={busy !== null || !url.trim()}
            >
              {busy === 'resolve' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <IdCard className="w-3.5 h-3.5" />}
              <span className="ml-2">{card ? 'Relire la carte' : 'Préparer la carte'}</span>
            </Button>
            {card && (
              <Button variant="outline" size="sm" onClick={() => run('resolve', true)} disabled={busy !== null || locked}>
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="ml-2">Réinférer depuis le site</span>
              </Button>
            )}
          </div>

          {card && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs text-muted-foreground space-y-1 block">
                  Secteur
                  <select
                    value={fields.sector}
                    onChange={(e) => set('sector', e.target.value)}
                    className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground"
                  >
                    <option value="">Non résolu</option>
                    {sectors.map((s) => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </select>
                </label>

                <label className="text-xs text-muted-foreground space-y-1 block">
                  Modèle d’affaires
                  <select
                    value={fields.commercialModel}
                    onChange={(e) => set('commercialModel', e.target.value)}
                    className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground"
                  >
                    <option value="">Non résolu</option>
                    {models.map((m) => (
                      <option key={m.key} value={m.key}>{m.label}</option>
                    ))}
                  </select>
                </label>

                <label className="text-xs text-muted-foreground space-y-1 block">
                  Type d’entité
                  <Input
                    value={fields.entityType}
                    onChange={(e) => set('entityType', e.target.value)}
                    placeholder="Entreprise, association, indépendant…"
                    className="bg-background"
                  />
                </label>

                <label className="text-xs text-muted-foreground space-y-1 block">
                  Zone commerciale
                  <Input
                    value={fields.commercialArea}
                    onChange={(e) => set('commercialArea', e.target.value)}
                    placeholder="France, Provence, national…"
                    className="bg-background"
                  />
                </label>

                <label className="text-xs text-muted-foreground space-y-1 block sm:col-span-2">
                  Produits et services
                  <Textarea
                    value={fields.productsServices}
                    onChange={(e) => set('productsServices', e.target.value)}
                    rows={2}
                    placeholder="Ce que le site vend réellement"
                    className="bg-background"
                  />
                </label>

                <label className="text-xs text-muted-foreground space-y-1 block sm:col-span-2">
                  Cible
                  <Textarea
                    value={fields.targetAudience}
                    onChange={(e) => set('targetAudience', e.target.value)}
                    rows={2}
                    placeholder="À qui le site s’adresse"
                    className="bg-background"
                  />
                </label>

                <label className="text-xs text-muted-foreground space-y-1 block sm:col-span-2">
                  Concurrents (séparés par des virgules, 6 max)
                  <Input
                    value={fields.competitors}
                    onChange={(e) => set('competitors', e.target.value)}
                    placeholder="concurrent1.fr, concurrent2.fr"
                    className="bg-background"
                  />
                </label>
              </div>

              <div className="rounded-md border border-border bg-background/60 p-3 text-xs space-y-1">
                <div className="text-foreground">
                  Axes retenus : <span className="text-primary">{card.sectorLabelText}</span> — {card.commercialModelLabelText}
                </div>
                <div className="text-muted-foreground">Confiance {card.confidence}/100</div>
                {card.notes?.map((n, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-muted-foreground">
                    <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                    <span>{n}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => run('recompute')} disabled={busy !== null || !dirty}>
                  {busy === 'recompute' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  <span className="ml-2">Recalculer</span>
                </Button>
                <Button variant="outline" size="sm" onClick={() => run('lock')} disabled={busy !== null}>
                  {busy === 'lock' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                  <span className="ml-2">Verrouiller la carte</span>
                </Button>
                {locked && !dirty && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary" /> Utilisée telle quelle par le prochain audit
                  </span>
                )}
                {dirty && (
                  <span className="text-xs text-muted-foreground">Modifications non enregistrées</span>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
