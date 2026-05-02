/**
 * UpdatePipelinePanel — Sprint 1 du Pipeline Update.
 *
 * Permet à un utilisateur Premium+ de lancer la skill atomique `update-extract-content`
 * sur une URL existante du site sélectionné, et de visualiser l'artefact `extracted`
 * (titre, meta, H1-H3, mots, liens) — équivalent du fichier `1-extracted/{slug}.md`
 * dans le modèle Anthropic.
 *
 * Sprints suivants : ajouter les onglets guidance/claims/topic_gaps/mentions/draft.
 */
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import { Loader2, Lock, RefreshCw, FileText, Link2, Hash, ShieldCheck, GitCompare, Sparkles, Check, AlertTriangle, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type Stage = 'extracted' | 'claims' | 'topic_gaps' | 'guidance' | 'mentions' | 'draft';

interface AnyArtifact {
  id: string;
  slug: string;
  url: string;
  stage: Stage;
  payload: any;
  source: string;
  created_at: string;
  updated_at: string;
}

const PREMIUM_PLANS = new Set(['premium', 'premium_yearly', 'agency_pro', 'agency_premium', 'pro_agency']);

export function UpdatePipelinePanel({ externalDomain }: { externalDomain?: string | null }) {
  const { user } = useAuth();
  const { planType, isAgencyPro } = useCredits();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [artifacts, setArtifacts] = useState<AnyArtifact[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  const isPremiumPlus = isAgencyPro || PREMIUM_PLANS.has((planType || '').toLowerCase());

  const loadArtifacts = useCallback(async () => {
    if (!user) return;
    setLoadingList(true);
    const { data } = await supabase
      .from('update_artifacts' as any)
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(80);
    setArtifacts((data as unknown as AnyArtifact[]) || []);
    setLoadingList(false);
  }, [user]);

  useEffect(() => { loadArtifacts(); }, [loadArtifacts, externalDomain]);

  // Regroupe les artefacts par slug pour afficher l'état du pipeline par page
  const bySlug = new Map<string, Partial<Record<Stage, AnyArtifact>>>();
  for (const a of artifacts) {
    if (!bySlug.has(a.slug)) bySlug.set(a.slug, {});
    bySlug.get(a.slug)![a.stage] = a;
  }
  const slugs = Array.from(bySlug.entries())
    .filter(([, stages]) => stages.extracted) // n'affiche que les pipelines démarrés
    .sort(([, a], [, b]) => {
      const ta = Math.max(...Object.values(a).map((x) => new Date(x!.updated_at).getTime()));
      const tb = Math.max(...Object.values(b).map((x) => new Date(x!.updated_at).getTime()));
      return tb - ta;
    });

  const handleExtract = async () => {
    if (!url.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('update-extract-content', {
        body: { url: url.trim(), source: 'manual' },
      });
      if (error) throw error;
      if (data?.error === 'plan_required') {
        toast.error('Plan Premium requis', { description: data.message });
        return;
      }
      if (data?.error) {
        toast.error('Extraction échouée', { description: data.message || data.error });
        return;
      }
      toast.success('Page extraite', { description: data.slug });
      setUrl('');
      await loadArtifacts();
    } catch (e) {
      toast.error('Erreur', { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  if (!isPremiumPlus) {
    return (
      <div className="border border-border rounded-lg p-6 text-center space-y-3">
        <Lock className="h-8 w-8 mx-auto text-muted-foreground" />
        <h3 className="text-sm font-semibold">Pipeline Refresh — Premium et plus</h3>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          Réoptimise tes pages existantes en déclin via une chaîne de skills atomiques :
          extraction → audit des claims → gaps SERP → refonte assistée.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header — explication du pipeline */}
      <div className="border border-border rounded-lg p-4 space-y-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <RefreshCw className="h-4 w-4" />
          Pipeline Refresh — Sprint 1 (Extract)
        </h3>
        <p className="text-xs text-muted-foreground">
          Skill atomique <code className="px-1 py-0.5 rounded bg-muted text-[10px]">/extract-content</code> :
          scrape une page existante et persiste un artefact réutilisable (TTL 30j).
          Les sprints suivants ajouteront les audits (claims, topic gaps) et la consolidation en draft.
        </p>
      </div>

      {/* Form */}
      <div className="border border-border rounded-lg p-4 space-y-3">
        <label className="text-xs font-medium">URL à analyser</label>
        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/article-a-rafraichir"
            disabled={loading}
            className="flex-1 px-3 py-2 text-xs bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
            onKeyDown={(e) => { if (e.key === 'Enter') handleExtract(); }}
          />
          <button
            onClick={handleExtract}
            disabled={loading || !url.trim()}
            className="px-4 py-2 text-xs font-medium border border-border rounded-md hover:bg-accent/40 transition-colors disabled:opacity-40 flex items-center gap-1.5"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Extraire
          </button>
        </div>
      </div>

      {/* Liste regroupée par slug — état du pipeline par page */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Pages dans le pipeline ({slugs.length})
        </h4>
        {loadingList ? (
          <div className="text-xs text-muted-foreground animate-pulse">Chargement…</div>
        ) : slugs.length === 0 ? (
          <div className="text-xs text-muted-foreground border border-dashed border-border rounded-lg p-4 text-center">
            Aucun artefact. Extrait une page pour démarrer le pipeline.
          </div>
        ) : (
          <div className="space-y-2">
            {slugs.map(([slug, stages]) => (
              <PipelineCard key={slug} slug={slug} stages={stages} onRefresh={loadArtifacts} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Carte par page — affiche extraction + actions Sprint 2
   ───────────────────────────────────────────────────────────── */

const STAGE_META: Record<Stage, { label: string; icon: typeof FileText }> = {
  extracted: { label: 'Extrait', icon: FileText },
  claims: { label: 'Claims', icon: ShieldCheck },
  topic_gaps: { label: 'Gaps', icon: GitCompare },
  guidance: { label: 'Brief', icon: Sparkles },
  mentions: { label: 'Mentions', icon: Link2 },
  draft: { label: 'Draft', icon: FileText },
};

function PipelineCard({
  slug,
  stages,
  onRefresh,
}: {
  slug: string;
  stages: Partial<Record<Stage, AnyArtifact>>;
  onRefresh: () => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [running, setRunning] = useState<Stage | null>(null);
  const [competitorInput, setCompetitorInput] = useState('');

  const extracted = stages.extracted!;
  const p = extracted.payload;

  const runSkill = async (
    fn: 'update-claims-audit' | 'update-topic-gaps' | 'update-guidance' | 'update-internal-mentions' | 'update-draft-consolidate' | 'update-publish-draft',
    stage: Stage,
    extra: Record<string, unknown> = {},
  ) => {
    setRunning(stage);
    try {
      const { data, error } = await supabase.functions.invoke(fn, {
        body: { slug, ...extra },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error('Échec', { description: data.message || data.error });
        return;
      }
      toast.success(`${STAGE_META[stage].label} OK`);
      await onRefresh();
    } catch (e) {
      toast.error('Erreur', { description: (e as Error).message });
    } finally {
      setRunning(null);
    }
  };

  const handleClaims = () => runSkill('update-claims-audit', 'claims');
  const handleGuidance = () => runSkill('update-guidance', 'guidance');
  const handleMentions = () => runSkill('update-internal-mentions', 'mentions');
  const handleConsolidate = () => runSkill('update-draft-consolidate', 'draft');
  const [publishing, setPublishing] = useState(false);
  const handlePublish = async () => {
    if (!confirm('Publier ce draft en mode patch sur la page existante du CMS ?')) return;
    setPublishing(true);
    try {
      const { data, error } = await supabase.functions.invoke('update-publish-draft', { body: { slug } });
      if (error) throw error;
      if (data?.error) { toast.error('Publication échouée', { description: data.message || data.error }); return; }
      toast.success('Patch CMS envoyé', { description: data?.target_url });
    } catch (e) {
      toast.error('Erreur', { description: (e as Error).message });
    } finally {
      setPublishing(false);
    }
  };
  const handleTopicGaps = () => {
    const urls = competitorInput
      .split(/[\s,;]+/)
      .map((u) => u.trim())
      .filter((u) => /^https?:\/\//i.test(u))
      .slice(0, 3);
    if (urls.length === 0) {
      toast.error('Ajoute 1 à 3 URLs concurrentes');
      return;
    }
    runSkill('update-topic-gaps', 'topic_gaps', { competitor_urls: urls });
  };

  return (
    <div className="border border-border rounded-lg p-3 space-y-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left flex items-start justify-between gap-3"
      >
        <div className="flex-1 min-w-0 space-y-1">
          <div className="text-xs font-medium truncate">{p?.title || extracted.url}</div>
          <div className="text-[10px] text-muted-foreground truncate font-mono">{extracted.url}</div>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1"><Hash className="h-2.5 w-2.5" /> {p?.word_count || 0} mots</span>
            <span className="flex items-center gap-1"><FileText className="h-2.5 w-2.5" /> H1:{p?.h1?.length || 0} H2:{p?.h2?.length || 0} H3:{p?.h3?.length || 0}</span>
            <span className="flex items-center gap-1"><Link2 className="h-2.5 w-2.5" /> {p?.links?.internal?.length || 0} int / {p?.links?.external?.length || 0} ext</span>
          </div>
          {/* Pipeline progress — pastilles par stage */}
          <div className="flex items-center gap-1.5 pt-1">
            {(Object.keys(STAGE_META) as Stage[]).map((s) => {
              const present = !!stages[s];
              const Icon = STAGE_META[s].icon;
              return (
                <span
                  key={s}
                  className={cn(
                    'flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] border',
                    present ? 'border-foreground/40 text-foreground' : 'border-border/40 text-muted-foreground/50',
                  )}
                  title={STAGE_META[s].label}
                >
                  <Icon className="h-2.5 w-2.5" />
                  {STAGE_META[s].label}
                </span>
              );
            })}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="pt-2 border-t border-border/60 space-y-3 text-[11px]">
          {/* Actions Sprint 2 */}
          <div className="grid gap-2">
            <ActionRow
              icon={ShieldCheck}
              label="Audit des claims"
              hint="Extrait les statistiques/citations et les vérifie via SerpAPI."
              running={running === 'claims'}
              done={!!stages.claims}
              onClick={handleClaims}
            />

            <div className="border border-border/60 rounded-md p-2 space-y-1.5">
              <div className="flex items-center gap-2 text-[11px] font-medium">
                <GitCompare className="h-3 w-3" />
                Gaps thématiques vs concurrents
                {stages.topic_gaps && <Check className="h-3 w-3 text-emerald-600" />}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Compare la couverture (H1-H3) à 1-3 concurrents. Sépare par espace ou virgule.
              </p>
              <div className="flex gap-2">
                <input
                  value={competitorInput}
                  onChange={(e) => setCompetitorInput(e.target.value)}
                  placeholder="https://concurrent1.com/page  https://concurrent2.com/page"
                  disabled={running === 'topic_gaps'}
                  className="flex-1 px-2 py-1 text-[10px] bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <button
                  onClick={handleTopicGaps}
                  disabled={running !== null}
                  className="px-3 py-1 text-[10px] font-medium border border-border rounded hover:bg-accent/40 transition-colors disabled:opacity-40 flex items-center gap-1"
                >
                  {running === 'topic_gaps' ? <Loader2 className="h-3 w-3 animate-spin" /> : <GitCompare className="h-3 w-3" />}
                  Analyser
                </button>
              </div>
            </div>

            <ActionRow
              icon={Sparkles}
              label="Brief de refonte (LLM)"
              hint="Synthèse extraction + claims + gaps en plan d'action JSON."
              running={running === 'guidance'}
              done={!!stages.guidance}
              onClick={handleGuidance}
              disabled={running !== null}
            />
          </div>

          {/* Aperçus payload */}
          {stages.claims && <ClaimsPreview payload={stages.claims.payload} />}
          {stages.topic_gaps && <TopicGapsPreview payload={stages.topic_gaps.payload} />}
          {stages.guidance && <GuidancePreview payload={stages.guidance.payload} />}

          <div className="text-[10px] text-muted-foreground font-mono">
            slug: {slug} · extrait le {p?.extracted_at ? new Date(p.extracted_at).toLocaleString('fr-FR') : '—'}
          </div>
        </div>
      )}
    </div>
  );
}

function ActionRow({
  icon: Icon, label, hint, running, done, onClick, disabled,
}: {
  icon: typeof FileText; label: string; hint: string;
  running: boolean; done: boolean; onClick: () => void; disabled?: boolean;
}) {
  return (
    <div className="border border-border/60 rounded-md p-2 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-[11px] font-medium">
          <Icon className="h-3 w-3" />
          {label}
          {done && <Check className="h-3 w-3 text-emerald-600" />}
        </div>
        <p className="text-[10px] text-muted-foreground">{hint}</p>
      </div>
      <button
        onClick={onClick}
        disabled={disabled || running}
        className="px-3 py-1 text-[10px] font-medium border border-border rounded hover:bg-accent/40 transition-colors disabled:opacity-40 flex items-center gap-1 shrink-0"
      >
        {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
        {done ? 'Rejouer' : 'Lancer'}
      </button>
    </div>
  );
}

function ClaimsPreview({ payload }: { payload: any }) {
  const summary = payload?.summary;
  const claims = (payload?.claims || []).slice(0, 5);
  if (!summary) return null;
  return (
    <div className="border border-border/40 rounded-md p-2 space-y-1.5">
      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Claims audités</div>
      <div className="flex items-center gap-3 text-[10px]">
        <span className="flex items-center gap-1"><Check className="h-2.5 w-2.5 text-emerald-600" /> {summary.verified} vérifiés</span>
        <span className="flex items-center gap-1"><HelpCircle className="h-2.5 w-2.5 text-amber-600" /> {summary.unverified} à vérifier</span>
        <span className="flex items-center gap-1"><AlertTriangle className="h-2.5 w-2.5 text-red-600" /> {summary.contradicted} contredits</span>
        <span className="text-muted-foreground">conf. moy. {Math.round((summary.avg_confidence || 0) * 100)}%</span>
      </div>
      <ul className="space-y-1">
        {claims.map((c: any, i: number) => (
          <li key={i} className="text-[10px] flex gap-2">
            <span className={cn(
              'shrink-0 px-1 rounded text-[9px]',
              c.verdict === 'verified' && 'bg-emerald-500/10 text-emerald-700',
              c.verdict === 'unverified' && 'bg-amber-500/10 text-amber-700',
              c.verdict === 'contradicted' && 'bg-red-500/10 text-red-700',
              c.verdict === 'unknown' && 'bg-muted text-muted-foreground',
            )}>{c.type}</span>
            <span className="truncate">{c.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TopicGapsPreview({ payload }: { payload: any }) {
  const gaps = (payload?.gaps || []).slice(0, 8);
  return (
    <div className="border border-border/40 rounded-md p-2 space-y-1.5">
      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
        Couverture {payload?.coverage_score ?? '—'}% · {payload?.our_word_count || 0} vs {payload?.avg_competitor_word_count || 0} mots
      </div>
      {gaps.length === 0 ? (
        <div className="text-[10px] text-muted-foreground">Aucun gap significatif détecté.</div>
      ) : (
        <ul className="space-y-0.5">
          {gaps.map((g: any, i: number) => (
            <li key={i} className="text-[10px] flex items-center gap-2">
              <span className="px-1 rounded bg-muted text-[9px]">{g.kind}</span>
              <span className="font-mono">{g.topic}</span>
              <span className="text-muted-foreground">×{g.present_in}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function GuidancePreview({ payload }: { payload: any }) {
  return (
    <div className="border border-border/40 rounded-md p-2 space-y-1.5">
      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Brief de refonte</div>
      {payload?.angle && <div className="text-[11px] italic">« {payload.angle} »</div>}
      <div className="text-[10px] text-muted-foreground">
        Intent: {payload?.target_intent || '—'} · ~{payload?.estimated_word_count || '—'} mots · {(payload?.sections || []).length} sections
      </div>
      {payload?.must_fix?.length > 0 && (
        <div className="text-[10px]">
          <span className="font-medium text-red-700">À corriger ({payload.must_fix.length}) : </span>
          {payload.must_fix.slice(0, 3).map((f: any) => f.claim).join(' · ')}
        </div>
      )}
      {payload?.must_add?.length > 0 && (
        <div className="text-[10px]">
          <span className="font-medium text-emerald-700">À ajouter ({payload.must_add.length}) : </span>
          {payload.must_add.slice(0, 4).map((a: any) => a.section).join(' · ')}
        </div>
      )}
    </div>
  );
}
