import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, RefreshCw, Trash2, Sparkles, ExternalLink, Pencil, ShieldCheck, Film, CalendarClock, Send } from 'lucide-react';
import { toast } from 'sonner';

type Feature = {
  id: string;
  slug: string;
  title: string;
  short_description: string;
  marketing_angle: string;
  target_audience: string | null;
  priority: number;
  is_active: boolean;
  last_used_at: string | null;
  use_count: number;
  readiness_score?: number | null;
  last_evidence_count?: number | null;
  doc_section_ids?: string[] | null;
  capture_route?: string | null;
};

type Post = {
  id: string;
  feature_id: string | null;
  status: string;
  media_type: string;
  generated_text: string;
  edited_text: string | null;
  hashtags: string[];
  media_urls: string[];
  media_generation_status: string;
  media_error: string | null;
  linkedin_post_url: string | null;
  linkedin_post_urn: string | null;
  publish_error: string | null;
  scheduled_for: string | null;
  published_at: string | null;
  created_at: string;
  llm_tokens_used: number | null;
  audit_status: string | null;
  audit_score: number | null;
  audited_at: string | null;
  audit_report: unknown;
};

// Vérification de l'état réel de publication, dérivée des données enregistrées.
type PublishHealth = { color: string; label: string };

function publishHealth(p: Post): PublishHealth {
  if (p.published_at && (p.linkedin_post_urn || p.linkedin_post_url)) {
    return { color: 'bg-emerald-500', label: `Publication vérifiée le ${new Date(p.published_at).toLocaleString('fr-FR')}` };
  }
  if (p.publish_error || p.status === 'failed' || (p.status === 'published' && !p.linkedin_post_urn)) {
    return { color: 'bg-amber-500', label: `Publication tentée mais échouée${p.publish_error ? ` : ${p.publish_error}` : ''}` };
  }
  return { color: 'bg-red-500', label: 'Jamais poussé vers la publication LinkedIn' };
}


const statusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'outline',
  pending_review: 'secondary',
  approved: 'default',
  publishing: 'default',
  published: 'default',
  failed: 'destructive',
  expired: 'outline',
  rejected: 'outline',
};

export function LinkedInAutomationDashboard() {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedFeatureId, setSelectedFeatureId] = useState<string>('auto');
  const [mediaType, setMediaType] = useState<'auto' | 'carousel' | 'video'>('auto');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [auditingId, setAuditingId] = useState<string | null>(null);
  const [mediaGenId, setMediaGenId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const loadAll = async () => {
    setLoading(true);
    const [{ data: feats }, { data: p }] = await Promise.all([
      supabase
        .from('linkedin_features_catalog')
        .select('*')
        .order('priority', { ascending: false }),
      supabase
        .from('linkedin_scheduled_posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(80),
    ]);
    setFeatures(feats || []);
    setPosts(p || []);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('linkedin-post-generator', {
        body: {
          ...(selectedFeatureId !== 'auto' ? { feature_id: selectedFeatureId } : {}),
          ...(mediaType !== 'auto' ? { media_type: mediaType } : {}),
        },
      });
      if (error) throw error;
      toast.success(`Brouillon créé pour : ${data.feature?.title}`);
      await loadAll();
    } catch (e: any) {
      toast.error(`Échec génération : ${e.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const saveEdited = async (id: string, edited: string) => {
    setSavingId(id);
    const { error } = await supabase
      .from('linkedin_scheduled_posts')
      .update({ edited_text: edited })
      .eq('id', id);
    setSavingId(null);
    if (error) toast.error(error.message);
    else toast.success('Texte enregistré');
  };

  // Répercute le texte sur le post LinkedIn déjà publié (médias non modifiables).
  const syncToLinkedIn = async (p: Post) => {
    const text = (drafts[p.id] ?? p.edited_text ?? p.generated_text ?? '').trim();
    setSyncingId(p.id);
    try {
      const { data, error } = await supabase.functions.invoke('linkedin-edit-post', {
        body: { post_id: p.id, text },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).details || (data as any).error);
      toast.success('Post mis à jour sur LinkedIn');
      await loadAll();
    } catch (e: any) {
      toast.error(`Échec modification : ${e.message}`);
    } finally {
      setSyncingId(null);
    }
  };

  // Relit le post publié sur LinkedIn et le corrige s'il ne respecte plus les règles.
  const auditPost = async (p: Post) => {
    setAuditingId(p.id);
    try {
      const { data, error } = await supabase.functions.invoke('linkedin-post-auditor', {
        body: { post_id: p.id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).details || (data as any).error);
      const r = (data as any)?.results?.[0];
      const action = r?.action ?? 'none';
      const labels: Record<string, string> = {
        none: 'Post conforme, aucune correction nécessaire',
        patched: `Post corrigé sur LinkedIn (score ${r?.previous_score} → ${r?.score})`,
        rejected_fix: 'Correction proposée rejetée par les garde-fous',
        skipped_max_attempts: 'Nombre maximum de corrections atteint',
        llm_failed: 'Analyse LLM indisponible',
      };
      toast.success(labels[action] ?? `Audit terminé : ${action}`);
      await loadAll();
    } catch (e: any) {
      toast.error(`Échec audit : ${e.message}`);
    } finally {
      setAuditingId(null);
    }
  };



  // Génère le média du post (carrousel WaveSpeed / screencast Pagebolt-Browserless).
  const generateMedia = async (p: Post) => {
    setMediaGenId(p.id);
    try {
      const { data, error } = await supabase.functions.invoke('linkedin-media-generator', {
        body: { post_id: p.id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).details || (data as any).error);
      toast.success('Contenu média généré');
      await loadAll();
    } catch (e: any) {
      toast.error(`Échec génération média : ${e.message}`);
    } finally {
      setMediaGenId(null);
    }
  };

  // Publication manuelle immédiate : bypasse le cron et l'anti-spam 1 post / 7 jours.
  const publishNow = async (p: Post) => {
    if (!confirm('Publier ce post sur LinkedIn maintenant ? (contourne la limite d\'un post par semaine)')) return;
    setPublishingId(p.id);
    try {
      const text = (drafts[p.id] ?? '').trim();
      if (text && text !== (p.edited_text ?? p.generated_text ?? '')) {
        await supabase.from('linkedin_scheduled_posts').update({ edited_text: text }).eq('id', p.id);
      }
      const { data, error } = await supabase.functions.invoke('linkedin-publisher', {
        body: { post_id: p.id, force: true },
      });
      if (error) throw error;
      const res = data as any;
      if (res?.error) throw new Error(res.details || res.error);
      if (res?.skipped) toast.warning(`Publication ignorée : ${res.reason}`);
      else toast.success('Post publié sur LinkedIn');
      await loadAll();
    } catch (e: any) {
      toast.error(`Échec publication : ${e.message}`);
    } finally {
      setPublishingId(null);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from('linkedin_scheduled_posts')
      .update({ status })
      .eq('id', id);
    if (error) toast.error(error.message);
    else {
      toast.success(`Statut : ${status}`);
      await loadAll();
    }
  };

  const deletePost = async (id: string) => {
    if (!confirm('Supprimer ce brouillon ?')) return;
    const { error } = await supabase.from('linkedin_scheduled_posts').delete().eq('id', id);
    if (error) toast.error(error.message);
    else {
      toast.success('Supprimé');
      await loadAll();
    }
  };

  const toggleFeature = async (id: string, is_active: boolean) => {
    const { error } = await supabase
      .from('linkedin_features_catalog')
      .update({ is_active: !is_active })
      .eq('id', id);
    if (error) toast.error(error.message);
    else await loadAll();
  };

  const draftPosts = posts.filter((p) => !p.published_at && p.status !== 'published');
  const publishedPosts = posts
    .filter((p) => p.published_at || p.status === 'published')
    .sort((a, b) => new Date(b.published_at ?? b.created_at).getTime() - new Date(a.published_at ?? a.created_at).getTime());


  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Automatisation LinkedIn</h2>
        <p className="text-muted-foreground">
          Publication hebdomadaire automatisée valorisant les fonctionnalités Crawlers. Sprint 1 : génération de texte uniquement (médias en Sprint 2/3).
        </p>
      </div>

      {/* Générateur */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Générer un nouveau brouillon
          </CardTitle>
          <CardDescription>
            Sélectionne une feature (ou laisse la rotation automatique) et le format média cible.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium mb-1 block">Feature</label>
              <Select value={selectedFeatureId} onValueChange={setSelectedFeatureId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Rotation automatique</SelectItem>
                  {features.filter(f => f.is_active).map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Format média</label>
              <Select value={mediaType} onValueChange={(v) => setMediaType(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Alternance auto (semaine paire/impaire)</SelectItem>
                  <SelectItem value="carousel">Carrousel 6 images</SelectItem>
                  <SelectItem value="video">Vidéo screencast</SelectItem>
                  
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button variant="outline" onClick={handleGenerate} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Générer le brouillon
          </Button>
        </CardContent>
      </Card>

      {/* Posts */}
      <Tabs defaultValue="drafts">
        <div className="flex items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="drafts">Brouillons & posts ({draftPosts.length})</TabsTrigger>
            <TabsTrigger value="history">Historique publié ({publishedPosts.length})</TabsTrigger>
          </TabsList>
          <Button variant="outline" size="sm" onClick={loadAll}>
            <RefreshCw className="h-4 w-4 mr-2" /> Rafraîchir
          </Button>
        </div>
        {(['drafts', 'history'] as const).map((tab) => (
        <TabsContent key={tab} value={tab} className="space-y-4">
          {(tab === 'drafts' ? draftPosts : publishedPosts).length === 0 && (
            <p className="text-muted-foreground text-sm">
              {tab === 'drafts' ? 'Aucun brouillon pour le moment.' : 'Aucun post publié pour le moment.'}
            </p>
          )}
          {(tab === 'drafts' ? draftPosts : publishedPosts).map((p) => {
            const feature = features.find((f) => f.id === p.feature_id);
            const currentText = p.edited_text ?? p.generated_text;
            const health = publishHealth(p);
            return (
              <Card key={p.id} className="border-2">
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-block h-3 w-3 rounded-full ${health.color}`}
                        title={health.label}
                        aria-label={health.label}
                      />
                      <Badge variant={statusVariant[p.status] || 'outline'}>{p.status}</Badge>
                      <Badge variant="outline">{p.media_type}</Badge>
                      <Badge variant="outline" className="text-xs">
                        Média : {p.media_generation_status || 'none'}
                        {p.media_urls?.length ? ` (${p.media_urls.length})` : ''}
                      </Badge>
                      {feature && <span className="text-sm font-medium">{feature.title}</span>}
                      {p.audit_status && (
                        <Badge
                          variant={p.audit_status === 'passed' || p.audit_status === 'patched' ? 'default' : 'outline'}
                          title={p.audited_at ? `Audité le ${new Date(p.audited_at).toLocaleString('fr-FR')}` : undefined}
                        >
                          Audit : {p.audit_status}
                          {typeof p.audit_score === 'number' ? ` (${p.audit_score}/100)` : ''}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground text-right space-y-0.5">
                      <div>
                        {new Date(p.created_at).toLocaleString('fr-FR')}
                        {p.llm_tokens_used && ` · ${p.llm_tokens_used} tokens`}
                      </div>
                      <div className="flex items-center gap-1 justify-end">
                        <CalendarClock className="h-3 w-3" />
                        {p.published_at
                          ? `Publié le ${new Date(p.published_at).toLocaleString('fr-FR')}`
                          : p.scheduled_for
                            ? `Programmé le ${new Date(p.scheduled_for).toLocaleString('fr-FR')}`
                            : 'Aucune date de programmation'}
                      </div>
                      <div>{health.label}</div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea
                    className="min-h-[220px] font-mono text-sm"
                    value={drafts[p.id] ?? currentText}
                    onChange={(e) => setDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                    onBlur={(e) => {
                      if (e.target.value !== currentText) saveEdited(p.id, e.target.value);
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    {(drafts[p.id] ?? currentText ?? '').trim().length} caractères (1000–1500 requis, hashtags exclus)
                  </p>

                  {p.hashtags?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {p.hashtags.map((h) => (
                        <Badge key={h} variant="outline" className="text-xs">{h}</Badge>
                      ))}
                    </div>
                  )}
                  {p.media_error && (
                    <p className="text-sm text-destructive">Erreur média : {p.media_error}</p>
                  )}
                  {p.publish_error && (
                    <p className="text-sm text-destructive">Erreur publication : {p.publish_error}</p>
                  )}
                  <div className="flex flex-wrap gap-2 pt-2">
                    {p.status === 'pending_review' && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => updateStatus(p.id, 'approved')}>
                          Approuver
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => updateStatus(p.id, 'rejected')}>
                          Rejeter
                        </Button>
                      </>
                    )}
                    {p.status === 'approved' && (
                      <Badge variant="default">
                        Approuvé — publication automatique (Sprint 2/3 requis pour publier)
                      </Badge>
                    )}
                    {p.status === 'published' && p.linkedin_post_urn && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => syncToLinkedIn(p)}
                        disabled={syncingId === p.id}
                        title="Met à jour le texte du post publié (les médias ne sont pas modifiables)"
                      >
                        {syncingId === p.id ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Pencil className="h-4 w-4 mr-2" />
                        )}
                        Modifier sur LinkedIn
                      </Button>
                    )}
                    {p.status === 'published' && p.linkedin_post_urn && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => auditPost(p)}
                        disabled={auditingId === p.id}
                        title="Relit le post publié, le note et le corrige si les règles ne sont pas respectées"
                      >
                        {auditingId === p.id ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <ShieldCheck className="h-4 w-4 mr-2" />
                        )}
                        Auditer maintenant
                      </Button>
                    )}
                    {p.linkedin_post_url && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={p.linkedin_post_url} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-4 w-4 mr-2" /> Voir sur LinkedIn
                        </a>
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => generateMedia(p)}
                      disabled={mediaGenId === p.id}
                      title="Génère le média du post : carrousel WaveSpeed ou capture vidéo de l'outil"
                    >
                      {mediaGenId === p.id ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Film className="h-4 w-4 mr-2" />
                      )}
                      Générer le média
                    </Button>

                    {!p.published_at && p.status !== 'published' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => publishNow(p)}
                        disabled={publishingId === p.id}
                        title="Publie immédiatement sur LinkedIn, sans attendre le cron ni la limite d'un post par semaine"
                      >
                        {publishingId === p.id ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4 mr-2" />
                        )}
                        Publier maintenant
                      </Button>
                    )}


                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deletePost(p.id)}
                      disabled={savingId === p.id}
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Supprimer
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>
        ))}
      </Tabs>

      {/* Catalogue features */}
      <Card>
        <CardHeader>
          <CardTitle>Catalogue des fonctionnalités ({features.length})</CardTitle>
          <CardDescription>
            La rotation automatique sélectionne d'abord les features actives les moins récemment utilisées.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            {features.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between border rounded-md px-3 py-2 gap-2"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{f.title}</span>
                    <Badge variant="outline" className="text-xs">Priorité {f.priority}</Badge>
                    <Badge variant="outline" className="text-xs">Utilisé {f.use_count}x</Badge>
                    <Badge variant="outline" className="text-xs">
                      {f.last_evidence_count === null || f.last_evidence_count === undefined
                        ? 'Données non vérifiées'
                        : f.last_evidence_count > 0
                          ? `En production (${f.last_evidence_count} enreg.)`
                          : 'Aucune donnée réelle'}
                    </Badge>
                    {!!f.doc_section_ids?.length && (
                      <Badge variant="outline" className="text-xs">
                        Doc : {f.doc_section_ids.join(', ')}
                      </Badge>
                    )}
                    {f.last_used_at && (
                      <span className="text-xs text-muted-foreground">
                        dernière : {new Date(f.last_used_at).toLocaleDateString('fr-FR')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{f.marketing_angle}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleFeature(f.id, f.is_active)}
                >
                  {f.is_active ? 'Actif' : 'Inactif'}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
