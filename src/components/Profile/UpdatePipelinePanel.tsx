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

interface ExtractedPayload {
  final_url: string;
  status_code: number;
  title: string | null;
  meta_description: string | null;
  canonical: string | null;
  h1: string[];
  h2: string[];
  h3: string[];
  word_count: number;
  links: { internal: string[]; external: string[] };
  extracted_at: string;
}

interface Artifact {
  id: string;
  slug: string;
  url: string;
  stage: string;
  payload: ExtractedPayload;
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
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
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

      {/* Liste des artefacts */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Artefacts récents ({artifacts.length})
        </h4>
        {loadingList ? (
          <div className="text-xs text-muted-foreground animate-pulse">Chargement…</div>
        ) : artifacts.length === 0 ? (
          <div className="text-xs text-muted-foreground border border-dashed border-border rounded-lg p-4 text-center">
            Aucun artefact. Extrait une page pour commencer.
          </div>
        ) : (
          <div className="space-y-2">
            {artifacts.map(a => <ArtifactCard key={a.id} artifact={a} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function ArtifactCard({ artifact }: { artifact: Artifact }) {
  const [expanded, setExpanded] = useState(false);
  const p = artifact.payload;
  return (
    <div className="border border-border rounded-lg p-3 space-y-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left flex items-start justify-between gap-3"
      >
        <div className="flex-1 min-w-0 space-y-1">
          <div className="text-xs font-medium truncate">{p.title || artifact.url}</div>
          <div className="text-[10px] text-muted-foreground truncate font-mono">{artifact.url}</div>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><Hash className="h-2.5 w-2.5" /> {p.word_count} mots</span>
            <span className="flex items-center gap-1"><FileText className="h-2.5 w-2.5" /> H1:{p.h1?.length || 0} H2:{p.h2?.length || 0} H3:{p.h3?.length || 0}</span>
            <span className="flex items-center gap-1"><Link2 className="h-2.5 w-2.5" /> {p.links?.internal?.length || 0} int / {p.links?.external?.length || 0} ext</span>
            <span className={cn('px-1.5 py-0.5 rounded text-[9px]', p.status_code === 200 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600')}>
              {p.status_code}
            </span>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="pt-2 border-t border-border/60 space-y-3 text-[11px]">
          {p.meta_description && (
            <div>
              <div className="text-[10px] font-semibold text-muted-foreground mb-0.5">Meta description</div>
              <div className="text-foreground/80">{p.meta_description}</div>
            </div>
          )}
          {p.h1?.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-muted-foreground mb-0.5">H1</div>
              <ul className="list-disc list-inside space-y-0.5">{p.h1.map((h, i) => <li key={i}>{h}</li>)}</ul>
            </div>
          )}
          {p.h2?.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-muted-foreground mb-0.5">H2 ({p.h2.length})</div>
              <ul className="list-disc list-inside space-y-0.5 max-h-32 overflow-y-auto">{p.h2.slice(0, 15).map((h, i) => <li key={i}>{h}</li>)}</ul>
            </div>
          )}
          <div className="text-[10px] text-muted-foreground font-mono">
            slug: {artifact.slug} · extrait le {new Date(p.extracted_at).toLocaleString('fr-FR')}
          </div>
        </div>
      )}
    </div>
  );
}
