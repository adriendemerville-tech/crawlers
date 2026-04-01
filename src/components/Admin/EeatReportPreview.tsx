import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Share2, Check, ExternalLink, Eye, Brain, Award, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface EeatScanResult {
  url: string;
  score: number;
  experience: number;
  expertise: number;
  authoritativeness: number;
  trustworthiness: number;
  signals: {
    authorIdentified: boolean;
    sourcesCited: boolean;
    expertiseDemonstrated: boolean;
    aboutPage: boolean;
    contactInfo: boolean;
    legalNotice: boolean;
    schemaOrg?: boolean;
    blogSection?: boolean;
    testimonials?: boolean;
  };
  trustSignals: string[];
  missingSignals: string[];
  issues: string[];
  strengths?: string[];
  recommendations?: string[];
  crawlInfo?: {
    pagesAnalyzed: number;
    source: string;
    crawledAt: string;
    sitemapUrlsFound: number;
    crawledUrls?: string[];
  } | null;
  scannedAt: string;
}

const CATEGORY_META = [
  { key: 'experience', label: 'Experience', icon: Eye, color: 'text-blue-500' },
  { key: 'expertise', label: 'Expertise', icon: Brain, color: 'text-purple-500' },
  { key: 'authoritativeness', label: 'Authoritativeness', icon: Award, color: 'text-amber-500' },
  { key: 'trustworthiness', label: 'Trustworthiness', icon: Shield, color: 'text-green-500' },
] as const;

function getScoreColor(score: number) {
  if (score >= 70) return 'text-green-500';
  if (score >= 40) return 'text-amber-500';
  return 'text-destructive';
}

function getScoreBg(score: number) {
  if (score >= 70) return 'bg-green-500';
  if (score >= 40) return 'bg-amber-500';
  return 'bg-destructive';
}

function buildReportHTML(result: EeatScanResult): string {
  const domain = (() => { try { return new URL(result.url.startsWith('http') ? result.url : `https://${result.url}`).hostname; } catch { return result.url; } })();
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Rapport E-E-A-T — ${domain}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:Inter,system-ui,sans-serif;background:#0d0f17;color:#e2e8f0;padding:2rem}
.container{max-width:800px;margin:auto}
h1{font-size:1.5rem;margin-bottom:.5rem}h2{font-size:1.1rem;margin:1.5rem 0 .75rem;color:#94a3b8}
.score-big{font-size:3rem;font-weight:800;text-align:center;margin:1.5rem 0}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin:1rem 0}
.card{background:#1e2235;border-radius:.75rem;padding:1.25rem;border:1px solid #2d3348}
.card h3{font-size:.85rem;color:#94a3b8;margin-bottom:.5rem;display:flex;align-items:center;gap:.5rem}
.card .val{font-size:1.75rem;font-weight:700}
.bar{height:6px;border-radius:3px;background:#2d3348;margin-top:.5rem}.bar-fill{height:100%;border-radius:3px}
.tag{display:inline-block;padding:.25rem .6rem;border-radius:9999px;font-size:.7rem;margin:.2rem;background:#2d3348}
.tag.ok{background:#166534;color:#86efac}.tag.miss{background:#7f1d1d;color:#fca5a5}
.footer{margin-top:2rem;text-align:center;font-size:.7rem;color:#64748b}
.green{color:#22c55e}.amber{color:#eab308}.red{color:#ef4444}
.bar-green .bar-fill{background:#22c55e}.bar-amber .bar-fill{background:#eab308}.bar-red .bar-fill{background:#ef4444}
</style></head><body><div class="container">
<h1>Rapport E-E-A-T</h1>
<p style="color:#94a3b8;font-size:.85rem">${domain} · ${new Date(result.scannedAt).toLocaleDateString('fr-FR')}</p>
<div class="score-big ${result.score >= 70 ? 'green' : result.score >= 40 ? 'amber' : 'red'}">${result.score}<span style="font-size:1rem;color:#64748b">/100</span></div>
<div class="grid">
${CATEGORY_META.map(c => {
  const v = result[c.key as keyof EeatScanResult] as number;
  const cls = v >= 70 ? 'green' : v >= 40 ? 'amber' : 'red';
  return `<div class="card"><h3>${c.label}</h3><div class="val ${cls}">${v}</div><div class="bar bar-${cls}"><div class="bar-fill" style="width:${v}%"></div></div></div>`;
}).join('')}
</div>
<h2>Signaux détectés</h2>
<div>${result.trustSignals.map(s => `<span class="tag ok">✓ ${s}</span>`).join('')}</div>
<h2>Signaux manquants</h2>
<div>${result.missingSignals.map(s => `<span class="tag miss">✗ ${s}</span>`).join('')}</div>
${result.issues.length ? `<h2>Problèmes identifiés</h2><ul style="padding-left:1.2rem;color:#fca5a5;font-size:.85rem">${result.issues.map(i => `<li style="margin:.3rem 0">${i}</li>`).join('')}</ul>` : ''}
<h2>Glossaire</h2>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;font-size:.75rem">
${[
  ['Experience', "Preuves que l'auteur a vécu ou pratiqué le sujet (cas concrets, témoignages)."],
  ['Expertise', 'Qualifications et profondeur technique du contenu sur le sujet traité.'],
  ['Authoritativeness', 'Reconnaissance externe : backlinks, citations, mentions par des sources faisant autorité.'],
  ['Trustworthiness', 'Signaux de confiance : HTTPS, mentions légales, contact, avis vérifiés.'],
  ['Télémétrie', 'Données mesurées par crawl HTML (balises, Schema.org, liens). Aucune IA.'],
  ['Heuristique', 'Score calculé par règles pondérées à partir de signaux bruts.'],
  ['LLM', 'Analyse sémantique par IA (originalité, pertinence, qualité rédactionnelle).'],
].map(([t, d]) => `<div class="card" style="padding:.75rem"><strong>${t}</strong> — ${d}</div>`).join('')}
</div>
<div class="footer">Généré par Crawlers.fr — Audit E-E-A-T</div>
</div></body></html>`;
}

export function EeatReportPreview({ result }: { result: EeatScanResult }) {
  const { toast } = useToast();
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const htmlContent = buildReportHTML(result);

  const handleDownloadPDF = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(htmlContent);
    w.document.close();
    setTimeout(() => { w.print(); }, 500);
  };

  const handleShare = async () => {
    setSharing(true);
    try {
      const htmlContent = buildReportHTML(result);
      const { data: responseData, error } = await supabase.functions.invoke('share-actions', {
        body: {
          action: 'create',
          type: 'eeat',
          url: result.url,
          data: result,
          language: 'fr',
          preRenderedHtml: htmlContent,
        },
      });
      if (error) throw error;

      const shareId = responseData?.shareId;
      if (!shareId) throw new Error('No share ID returned');

      // Resolve to signed URL
      const { data: resolveData, error: resolveError } = await supabase.functions.invoke('share-actions', {
        body: { action: 'resolve', shareId },
      });
      if (resolveError || !resolveData?.signedUrl) throw resolveError || new Error('No signed URL');

      await navigator.clipboard.writeText(resolveData.signedUrl);
      setCopied(true);
      toast({ title: 'Lien copié !', description: 'Valide 7 jours.' });
      setTimeout(() => setCopied(false), 3000);
    } catch (e: any) {
      toast({ title: 'Erreur partage', description: e.message, variant: 'destructive' });
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-card/95 backdrop-blur-sm">
        <div className="flex items-center gap-2 min-w-0">
          <Badge variant="outline" className="shrink-0">Rapport E-E-A-T</Badge>
          <span className="text-sm text-muted-foreground truncate">{result.url}</span>
          <span className={`text-lg font-bold ${getScoreColor(result.score)}`}>{result.score}/100</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" variant="outline" onClick={handleDownloadPDF}>
            <Download className="h-4 w-4 mr-1" /> PDF
          </Button>
          <Button size="sm" variant="outline" onClick={handleShare} disabled={sharing}>
            {copied ? <Check className="h-4 w-4 mr-1" /> : <Share2 className="h-4 w-4 mr-1" />}
            {copied ? 'Copié !' : sharing ? 'Partage…' : 'Partager'}
          </Button>
        </div>
      </div>

      {/* Report preview */}
      <div className="p-4 space-y-6">
        {/* Score overview */}
        <div className="text-center py-4">
          <div className={`text-5xl font-extrabold ${getScoreColor(result.score)}`}>
            {result.score}<span className="text-lg text-muted-foreground">/100</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Score global E-E-A-T</p>
          {result.crawlInfo && (
            <p className="text-xs text-muted-foreground mt-2">
              📄 {result.crawlInfo.pagesAnalyzed} pages analysées ({result.crawlInfo.source === 'cache' ? 'crawl récent en cache' : 'crawl intermédiaire'})
              {result.crawlInfo.sitemapUrlsFound > 0 && ` · ${result.crawlInfo.sitemapUrlsFound} URLs sitemap`}
            </p>
          )}
        </div>

        {/* Category scores */}
        <div className="grid grid-cols-2 gap-3">
          {CATEGORY_META.map(cat => {
            const value = result[cat.key as keyof EeatScanResult] as number;
            return (
              <div key={cat.key} className="rounded-lg border border-border p-4 bg-background">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <cat.icon className={`h-4 w-4 ${cat.color}`} />
                  {cat.label}
                </div>
                <div className={`text-2xl font-bold ${getScoreColor(value)}`}>{value}</div>
                <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full ${getScoreBg(value)}`} style={{ width: `${value}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Signals */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">✓ Signaux détectés</h3>
            <div className="flex flex-wrap gap-1.5">
              {result.trustSignals.map((s, i) => (
                <Badge key={i} className="bg-green-500/10 text-green-500 border-green-500/20">{s}</Badge>
              ))}
              {result.trustSignals.length === 0 && <span className="text-xs text-muted-foreground italic">Aucun</span>}
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">✗ Signaux manquants</h3>
            <div className="flex flex-wrap gap-1.5">
              {result.missingSignals.map((s, i) => (
                <Badge key={i} variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20">{s}</Badge>
              ))}
              {result.missingSignals.length === 0 && <span className="text-xs text-muted-foreground italic">Aucun</span>}
            </div>
          </div>
        </div>

        {/* Issues */}
        {result.issues.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Problèmes identifiés</h3>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {result.issues.map((issue, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-destructive mt-0.5">•</span>
                  {issue}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Structural signals detail */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Signaux structurels</h3>
          <div className="grid grid-cols-3 gap-2 text-xs">
            {[
              { label: 'Page À propos', ok: result.signals.aboutPage },
              { label: 'Auteur identifié', ok: result.signals.authorIdentified },
              { label: 'Sources citées', ok: result.signals.sourcesCited },
              { label: 'Expertise démontrée', ok: result.signals.expertiseDemonstrated },
              { label: 'Contact', ok: result.signals.contactInfo },
              { label: 'Mentions légales', ok: result.signals.legalNotice },
              { label: 'Schema.org', ok: result.signals.schemaOrg ?? false },
              { label: 'Blog/Actualités', ok: result.signals.blogSection ?? false },
              { label: 'Témoignages/Avis', ok: result.signals.testimonials ?? false },
            ].map((s, i) => (
              <div key={i} className={`rounded-md border p-2 text-center ${s.ok ? 'border-green-500/30 bg-green-500/5 text-green-500' : 'border-destructive/30 bg-destructive/5 text-destructive'}`}>
                {s.ok ? '✓' : '✗'} {s.label}
              </div>
            ))}
          </div>
        </div>

        {/* Strengths */}
        {result.strengths && result.strengths.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">💪 Points forts</h3>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {result.strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommendations */}
        {result.recommendations && result.recommendations.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">📋 Recommandations</h3>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {result.recommendations.map((r, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">→</span>
                  {r}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Glossary */}
        <div className="space-y-3 pt-2">
          <h3 className="text-sm font-semibold text-foreground">📖 Glossaire</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {[
              { term: 'Experience', desc: 'Preuves que l\'auteur a vécu ou pratiqué le sujet (cas concrets, témoignages, captures).' },
              { term: 'Expertise', desc: 'Qualifications et profondeur technique du contenu sur le sujet traité.' },
              { term: 'Authoritativeness', desc: 'Reconnaissance externe : backlinks, citations, mentions par des sources faisant autorité.' },
              { term: 'Trustworthiness', desc: 'Signaux de confiance : HTTPS, mentions légales, contact, politique de confidentialité, avis.' },
              { term: 'Télémétrie', desc: 'Données mesurées automatiquement par crawl HTML (balises, Schema.org, liens). Aucune IA.' },
              { term: 'Heuristique', desc: 'Score calculé par règles pondérées à partir de signaux bruts détectés par le crawler.' },
              { term: 'LLM', desc: 'Analyse sémantique par intelligence artificielle (originalité, pertinence, qualité rédactionnelle).' },
            ].map((g, i) => (
              <div key={i} className="rounded-md border border-border p-2.5 bg-muted/30">
                <span className="font-semibold text-foreground">{g.term}</span>
                <span className="text-muted-foreground ml-1">— {g.desc}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground pt-4 border-t border-border">
          Généré par Crawlers.fr — {new Date(result.scannedAt).toLocaleDateString('fr-FR')}
        </p>
      </div>
    </div>
  );
}
