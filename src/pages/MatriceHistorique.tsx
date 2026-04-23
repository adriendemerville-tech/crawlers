/**
 * MatriceHistorique — Sprint 7
 * Lists past matrix audits for the current user.
 * Actions: rouvrir, comparer, renommer, supprimer.
 * Charte: violet/gold, bordure + texte (pas de fond), pas d'emoji.
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, FolderOpen, GitCompareArrows, Pencil, Trash2, Check, X as XIcon, Loader2, Calendar, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Header } from '@/components/Header';
import { useAuth } from '@/contexts/AuthContext';
import { useMatriceAudits, type MatrixAuditRow } from '@/hooks/useMatriceAudits';
import { toast } from 'sonner';
import { scoreToHeatClasses } from '@/utils/matrice/heatmapScale';
import { cn } from '@/lib/utils';

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

function formatDuration(ms: number | null): string {
  if (!ms) return '—';
  if (ms < 1000) return `${ms} ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  return `${Math.floor(s / 60)} min ${s % 60}s`;
}

export default function MatriceHistorique() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { listAudits, getAudit, renameAudit, deleteAudit } = useMatriceAudits();

  const [audits, setAudits] = useState<MatrixAuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [reopeningId, setReopeningId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [authLoading, user, navigate]);

  const refresh = useCallback(async () => {
    setLoading(true);
    const list = await listAudits(100);
    setAudits(list);
    setLoading(false);
  }, [listAudits]);

  useEffect(() => {
    if (user) void refresh();
  }, [user, refresh]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 2) return [prev[1], id]; // keep last 2
      return [...prev, id];
    });
  };

  const handleRename = async (id: string) => {
    if (!renameValue.trim()) { setRenamingId(null); return; }
    const ok = await renameAudit(id, renameValue);
    if (ok) {
      setAudits(prev => prev.map(a => a.id === id ? { ...a, label: renameValue.trim() } : a));
      toast.success('Audit renommé');
    } else {
      toast.error('Échec du renommage');
    }
    setRenamingId(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer définitivement cet audit ?')) return;
    const ok = await deleteAudit(id);
    if (ok) {
      setAudits(prev => prev.filter(a => a.id !== id));
      setSelectedIds(prev => prev.filter(x => x !== id));
      toast.success('Audit supprimé');
    } else {
      toast.error('Échec de la suppression');
    }
  };

  const handleReopen = async (id: string) => {
    setReopeningId(id);
    const audit = await getAudit(id);
    setReopeningId(null);
    if (!audit) { toast.error('Audit introuvable'); return; }

    // Restore the same sessionStorage shape produced by MatricePrompt > handleOpenReport.
    const reportData = {
      kind: 'matrice' as const,
      url: '(historique)',
      results: audit.results.map((r: any) => ({
        prompt: r.criterionTitle,
        axe: r.criterionCategory || 'general',
        poids: r.criterionWeight ?? 1,
        score: r.parsedScore ?? r.crawlersScore ?? 0,
        parsed_score: r.parsedScore ?? null,
        crawlers_score: r.crawlersScore ?? null,
        seuil_bon: 70,
        seuil_moyen: 40,
        seuil_mauvais: 0,
      })),
      totalWeight: audit.results.length,
      weightedScore: audit.global_score ?? 0,
      parsedWeightedScore: audit.global_score ?? 0,
    };
    sessionStorage.setItem('rapport_matrice_data', JSON.stringify(reportData));
    sessionStorage.setItem('rapport_matrice_results_native', JSON.stringify(audit.results));
    window.open('/app/rapport/matrice', '_blank');
  };

  const handleCompare = () => {
    if (selectedIds.length !== 2) {
      toast.error('Sélectionnez exactement 2 audits');
      return;
    }
    navigate(`/matrice/compare?a=${selectedIds[0]}&b=${selectedIds[1]}`);
  };

  const groupedByMonth = useMemo(() => {
    const map = new Map<string, MatrixAuditRow[]>();
    for (const a of audits) {
      const d = new Date(a.created_at);
      const key = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return Array.from(map.entries());
  }, [audits]);

  return (
    <>
      <Helmet>
        <title>Historique des audits matriciels — Crawlers.fr</title>
        <meta name="description" content="Consultez et comparez vos audits matriciels passés. Suivi de progression, deltas inter-audits, reprise d'audits interrompus." />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <Header />
      <main className="min-h-screen bg-background pt-24 pb-16">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <Link to="/matrice" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                <ArrowLeft className="h-4 w-4" /> Retour à la Matrice
              </Link>
            </div>
            <div className="flex items-center gap-2">
              {selectedIds.length === 2 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCompare}
                  className="border-brand-gold text-brand-gold hover:text-brand-gold"
                >
                  <GitCompareArrows className="h-4 w-4 mr-1.5" />
                  Comparer ces 2 audits
                </Button>
              )}
            </div>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-foreground mb-2">Historique des audits</h1>
            <p className="text-sm text-muted-foreground">
              {audits.length} audit{audits.length > 1 ? 's' : ''} sauvegardé{audits.length > 1 ? 's' : ''}.
              Cochez 2 audits pour les comparer.
            </p>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-brand-violet" />
            </div>
          )}

          {!loading && audits.length === 0 && (
            <div className="border-2 border-dashed border-brand-violet rounded-md p-12 text-center">
              <BarChart3 className="h-10 w-10 mx-auto mb-3 text-brand-violet" aria-hidden />
              <p className="text-sm text-muted-foreground mb-4">
                Aucun audit sauvegardé pour le moment.
              </p>
              <Button asChild variant="outline">
                <Link to="/matrice">Lancer un premier audit</Link>
              </Button>
            </div>
          )}

          {!loading && groupedByMonth.map(([month, items]) => (
            <section key={month} className="mb-8">
              <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3 inline-flex items-center gap-2">
                <Calendar className="h-3 w-3" /> {month}
              </h2>
              <div className="border-2 border-brand-violet rounded-md overflow-hidden bg-transparent">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-brand-violet/40">
                      <th className="px-3 py-2 w-10" />
                      <th className="px-3 py-2 text-left text-xs uppercase tracking-wider text-muted-foreground">Nom</th>
                      <th className="px-3 py-2 text-center text-xs uppercase tracking-wider text-muted-foreground">Type</th>
                      <th className="px-3 py-2 text-center text-xs uppercase tracking-wider text-muted-foreground">Score</th>
                      <th className="px-3 py-2 text-center text-xs uppercase tracking-wider text-muted-foreground">Critères</th>
                      <th className="px-3 py-2 text-center text-xs uppercase tracking-wider text-muted-foreground">Durée</th>
                      <th className="px-3 py-2 text-center text-xs uppercase tracking-wider text-muted-foreground">Date</th>
                      <th className="px-3 py-2 text-right text-xs uppercase tracking-wider text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(audit => {
                      const isSel = selectedIds.includes(audit.id);
                      const isRenaming = renamingId === audit.id;
                      return (
                        <tr key={audit.id} className={cn(
                          'transition-colors border-b border-brand-violet/10 last:border-0',
                          isSel ? 'bg-brand-gold/10' : 'hover:bg-brand-violet/5',
                        )}>
                          <td className="px-3 py-2 text-center">
                            <Checkbox
                              checked={isSel}
                              onCheckedChange={() => toggleSelect(audit.id)}
                              aria-label={`Sélectionner ${audit.label}`}
                            />
                          </td>
                          <td className="px-3 py-2">
                            {isRenaming ? (
                              <div className="flex items-center gap-1">
                                <Input
                                  value={renameValue}
                                  onChange={e => setRenameValue(e.target.value)}
                                  className="h-7 text-sm"
                                  autoFocus
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') void handleRename(audit.id);
                                    if (e.key === 'Escape') setRenamingId(null);
                                  }}
                                />
                                <Button size="sm" variant="ghost" onClick={() => handleRename(audit.id)} aria-label="Valider">
                                  <Check className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setRenamingId(null)} aria-label="Annuler">
                                  <XIcon className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleReopen(audit.id)}
                                className="text-left text-foreground hover:text-brand-violet transition-colors bg-transparent font-medium"
                              >
                                {audit.label}
                              </button>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <Badge variant="outline" className="text-[10px] border-brand-violet/40">
                              {audit.audit_type}
                            </Badge>
                            {audit.status === 'partial' && (
                              <Badge variant="outline" className="ml-1 text-[10px] border-brand-gold text-brand-gold">
                                partiel
                              </Badge>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {audit.global_score != null ? (
                              <span className={cn(
                                'inline-block px-2 py-0.5 rounded font-mono text-xs',
                                scoreToHeatClasses(Number(audit.global_score)),
                              )}>
                                {Math.round(Number(audit.global_score))}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="px-3 py-2 text-center font-mono text-xs text-muted-foreground">
                            {audit.items_count}
                          </td>
                          <td className="px-3 py-2 text-center font-mono text-xs text-muted-foreground">
                            {formatDuration(audit.duration_ms)}
                          </td>
                          <td className="px-3 py-2 text-center text-xs text-muted-foreground">
                            {formatDate(audit.created_at)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="inline-flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleReopen(audit.id)}
                                disabled={reopeningId === audit.id}
                                aria-label="Rouvrir"
                                title="Rouvrir"
                              >
                                {reopeningId === audit.id
                                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  : <FolderOpen className="h-3.5 w-3.5" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { setRenamingId(audit.id); setRenameValue(audit.label); }}
                                aria-label="Renommer"
                                title="Renommer"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(audit.id)}
                                aria-label="Supprimer"
                                title="Supprimer"
                                className="text-brand-violet hover:text-brand-violet"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      </main>
    </>
  );
}
