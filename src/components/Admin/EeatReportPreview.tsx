import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Share2, Check, ExternalLink, Eye, Brain, Award, Shield, Info, Printer } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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
  backlinkData?: {
    referringDomains: number;
    backlinksTotal: number;
    domainRank: number;
    referringIps: number;
    referringSubnets: number;
    anchorDistribution?: { anchor: string; backlinks: number; domains: number }[];
    referringPages?: { sourceUrl: string; targetUrl: string; anchor: string; rank: number; dofollow: boolean; firstSeen: string | null }[];
  } | null;
  gbpData?: {
    avgRating: number;
    totalReviews: number;
    category: string;
    locationName: string;
  } | null;
  dataSources?: string[];
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
  { key: 'experience', label: 'Experience', icon: Eye, color: 'text-blue-500', weight: 2.0, desc: 'Preuves de vécu terrain, cas concrets, témoignages' },
  { key: 'expertise', label: 'Expertise', icon: Brain, color: 'text-purple-500', weight: 3.0, desc: 'Compétence technique, profondeur du contenu' },
  { key: 'authoritativeness', label: 'Authoritativeness', icon: Award, color: 'text-amber-500', weight: 2.5, desc: 'Reconnaissance externe, citations, backlinks' },
  { key: 'trustworthiness', label: 'Trustworthiness', icon: Shield, color: 'text-green-500', weight: 2.5, desc: 'Signaux de confiance : HTTPS, légal, contact' },
] as const;

const SIGNAL_WEIGHTS: Record<string, { weight: number; category: string }> = {
  aboutPage: { weight: 8, category: 'trustworthiness' },
  authorIdentified: { weight: 10, category: 'expertise' },
  sourcesCited: { weight: 7, category: 'expertise' },
  expertiseDemonstrated: { weight: 12, category: 'expertise' },
  contactInfo: { weight: 6, category: 'trustworthiness' },
  legalNotice: { weight: 5, category: 'trustworthiness' },
  schemaOrg: { weight: 8, category: 'authoritativeness' },
  blogSection: { weight: 6, category: 'experience' },
  testimonials: { weight: 7, category: 'experience' },
};

const SIGNAL_LABELS: Record<string, string> = {
  aboutPage: 'Page À propos',
  authorIdentified: 'Auteur identifié',
  sourcesCited: 'Sources citées',
  expertiseDemonstrated: 'Expertise démontrée',
  contactInfo: 'Contact',
  legalNotice: 'Mentions légales',
  schemaOrg: 'Schema.org',
  blogSection: 'Blog/Actualités',
  testimonials: 'Témoignages/Avis',
};

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

function getScoreBadgeClasses(score: number) {
  if (score >= 70) return 'border-green-500/30 bg-green-500/5 text-green-500';
  if (score >= 40) return 'border-amber-500/30 bg-amber-500/5 text-amber-500';
  return 'border-destructive/30 bg-destructive/5 text-destructive';
}

function getScoreLabel(score: number) {
  if (score >= 80) return 'Excellent';
  if (score >= 70) return 'Bon';
  if (score >= 50) return 'Moyen';
  if (score >= 30) return 'Faible';
  return 'Critique';
}

/** Generate contextual synthesis sentence */
function buildSynthesis(result: EeatScanResult): string {
  const cats = CATEGORY_META.map(c => ({
    label: c.label,
    value: result[c.key as keyof EeatScanResult] as number,
  }));
  const sorted = [...cats].sort((a, b) => b.value - a.value);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  if (result.score >= 70) {
    return `Score solide porté par une bonne ${best.label} (${best.value}/100). Marge de progression sur ${worst.label} (${worst.value}/100).`;
  }
  if (result.score >= 40) {
    return `Score modéré : ${best.label} (${best.value}/100) est le pilier le plus fort, mais ${worst.label} (${worst.value}/100) tire le score vers le bas.`;
  }
  return `Score faible : ${worst.label} (${worst.value}/100) est le principal frein. Prioriser les actions sur ce pilier.`;
}

/** Calculate weighted contribution of each category to the total */
function getCategoryContributions(result: EeatScanResult) {
  const totalWeight = CATEGORY_META.reduce((s, c) => s + c.weight, 0);
  return CATEGORY_META.map(cat => {
    const value = result[cat.key as keyof EeatScanResult] as number;
    const maxContribution = (cat.weight / totalWeight) * 100;
    const actualContribution = (value / 100) * maxContribution;
    return {
      ...cat,
      value,
      maxContribution: Math.round(maxContribution * 10) / 10,
      actualContribution: Math.round(actualContribution * 10) / 10,
    };
  });
}

function buildReportHTML(result: EeatScanResult): string {
  const domain = (() => { try { return new URL(result.url.startsWith('http') ? result.url : `https://${result.url}`).hostname; } catch { return result.url; } })();
  const contributions = getCategoryContributions(result);
  const synthesis = buildSynthesis(result);

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Rapport E-E-A-T — ${domain}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:Inter,system-ui,sans-serif;background:#0d0f17;color:#e2e8f0;padding:2rem}
.container{max-width:800px;margin:auto}
h1{font-size:1.5rem;margin-bottom:.5rem}h2{font-size:1.1rem;margin:1.5rem 0 .75rem;color:#94a3b8}
.score-big{font-size:3rem;font-weight:800;text-align:center;margin:1.5rem 0}
.synthesis{text-align:center;font-size:.9rem;color:#94a3b8;margin:-.5rem 0 1.5rem;max-width:600px;margin-left:auto;margin-right:auto;line-height:1.5}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin:1rem 0}
.card{background:#1e2235;border-radius:.75rem;padding:1.25rem;border:1px solid #2d3348}
.card h3{font-size:.85rem;color:#94a3b8;margin-bottom:.5rem;display:flex;align-items:center;gap:.5rem}
.card .val{font-size:1.75rem;font-weight:700}
.card .weight{font-size:.65rem;color:#64748b;margin-top:.25rem}
.bar{height:6px;border-radius:3px;background:#2d3348;margin-top:.5rem}.bar-fill{height:100%;border-radius:3px}
.tag{display:inline-block;padding:.25rem .6rem;border-radius:9999px;font-size:.7rem;margin:.2rem;background:#2d3348}
.tag.ok{background:#166534;color:#86efac}.tag.miss{background:#7f1d1d;color:#fca5a5}.tag.mid{background:#713f12;color:#fde68a}
.footer{margin-top:2rem;text-align:center;font-size:.7rem;color:#64748b}
.green{color:#22c55e}.amber{color:#eab308}.red{color:#ef4444}
.bar-green .bar-fill{background:#22c55e}.bar-amber .bar-fill{background:#eab308}.bar-red .bar-fill{background:#ef4444}
.contrib-bar{display:flex;align-items:center;gap:.5rem;margin:.4rem 0;font-size:.8rem}
.contrib-bar .label{width:130px;color:#94a3b8;text-align:right;flex-shrink:0}
.contrib-bar .track{flex:1;height:14px;background:#2d3348;border-radius:4px;position:relative;overflow:hidden}
.contrib-bar .fill{height:100%;border-radius:4px;position:absolute;left:0;top:0}
.contrib-bar .ghost{height:100%;border-radius:4px;position:absolute;left:0;top:0;opacity:.15}
.contrib-bar .pts{width:60px;font-weight:600;font-size:.75rem}
.signal-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem;margin:.5rem 0}
.signal-item{border-radius:.5rem;padding:.5rem;text-align:center;font-size:.7rem;border:1px solid}
.signal-green{border-color:rgba(34,197,94,.3);background:rgba(34,197,94,.05);color:#22c55e}
.signal-amber{border-color:rgba(234,179,8,.3);background:rgba(234,179,8,.05);color:#eab308}
.signal-red{border-color:rgba(239,68,68,.3);background:rgba(239,68,68,.05);color:#ef4444}
@media print {
  body{padding:1rem}
  .card,.grid,.signal-grid,.contrib-bar,.signal-item{page-break-inside:avoid;break-inside:avoid}
  h2{page-break-after:avoid;break-after:avoid}
  .footer{page-break-before:avoid}
  .container>*{page-break-inside:avoid;break-inside:avoid}
}
@page{margin:15mm 10mm}
</style></head><body><div class="container">
<h1>Rapport E-E-A-T</h1>
<p style="color:#94a3b8;font-size:.85rem">${domain} · ${new Date(result.scannedAt).toLocaleDateString('fr-FR')}</p>
<div class="score-big ${result.score >= 70 ? 'green' : result.score >= 40 ? 'amber' : 'red'}">${result.score}<span style="font-size:1rem;color:#64748b">/100</span></div>
<p class="synthesis">💡 ${synthesis}</p>

<h2>📊 Décomposition du score</h2>
<div class="card" style="margin-bottom:1rem">
${contributions.map(c => {
  const cls = c.value >= 70 ? 'green' : c.value >= 40 ? 'amber' : 'red';
  const barColor = c.value >= 70 ? '#22c55e' : c.value >= 40 ? '#eab308' : '#ef4444';
  return `<div class="contrib-bar">
    <span class="label">${c.label}</span>
    <div class="track">
      <div class="ghost" style="width:${c.maxContribution}%;background:${barColor}"></div>
      <div class="fill" style="width:${c.actualContribution}%;background:${barColor}"></div>
    </div>
    <span class="pts ${cls}">${c.actualContribution}/${c.maxContribution} pts</span>
  </div>`;
}).join('')}
<p style="font-size:.65rem;color:#64748b;margin-top:.5rem;text-align:center">Chaque pilier a un poids différent. La barre fantôme indique la contribution maximale possible.</p>
</div>

<div class="grid">
${CATEGORY_META.map(c => {
  const v = result[c.key as keyof EeatScanResult] as number;
  const cls = v >= 70 ? 'green' : v >= 40 ? 'amber' : 'red';
  return `<div class="card"><h3>${c.label}</h3><div class="val ${cls}">${v}<span style="font-size:.75rem;color:#64748b">/100</span></div><div class="weight">Poids : ×${c.weight} · ${v >= 70 ? 'Bon' : v >= 40 ? 'Moyen' : 'Faible'}</div><div class="bar bar-${cls}"><div class="bar-fill" style="width:${v}%"></div></div></div>`;
}).join('')}
</div>

<h2>Signaux structurels</h2>
<div class="signal-grid">
${Object.entries(SIGNAL_LABELS).map(([key, label]) => {
  const ok = (result.signals as any)[key] ?? false;
  const w = SIGNAL_WEIGHTS[key]?.weight ?? 5;
  const cls = ok ? 'signal-green' : w >= 10 ? 'signal-red' : 'signal-amber';
  return `<div class="${cls} signal-item">${ok ? '✓' : '✗'} ${label}<br><span style="font-size:.6rem;opacity:.7">Poids: ${w} pts · ${SIGNAL_WEIGHTS[key]?.category || ''}</span></div>`;
}).join('')}
</div>

<h2>Signaux détectés</h2>
<div>${result.trustSignals.map(s => `<span class="tag ok">✓ ${s}</span>`).join('')}</div>
<h2>Signaux manquants</h2>
<div>${result.missingSignals.map(s => `<span class="tag miss">✗ ${s}</span>`).join('')}</div>
${result.backlinkData ? `<h2>🔗 Données Backlinks (réelles)</h2>
<div class="grid" style="grid-template-columns:1fr 1fr 1fr">
<div class="card" style="text-align:center"><div class="val">${result.backlinkData.referringDomains}</div><p style="font-size:.7rem;color:#94a3b8">Domaines référents</p></div>
<div class="card" style="text-align:center"><div class="val">${result.backlinkData.domainRank}</div><p style="font-size:.7rem;color:#94a3b8">Domain Rank</p></div>
<div class="card" style="text-align:center"><div class="val">${result.backlinkData.backlinksTotal.toLocaleString()}</div><p style="font-size:.7rem;color:#94a3b8">Backlinks totaux</p></div>
</div>
${result.backlinkData.anchorDistribution?.length ? `<div class="card" style="margin:.5rem 0"><p style="font-size:.75rem;color:#94a3b8;margin-bottom:.5rem">Top ancres</p>${result.backlinkData.anchorDistribution.slice(0, 5).map(a => `<div style="display:flex;justify-content:space-between;font-size:.75rem;margin:.2rem 0"><span>"${a.anchor}"</span><span style="color:#94a3b8">${a.backlinks} liens</span></div>`).join('')}</div>` : ''}
${result.backlinkData.referringPages?.length ? `<div class="card" style="margin:.5rem 0"><p style="font-size:.75rem;color:#94a3b8;margin-bottom:.5rem">🔗 Pages référentes (cliquez pour vérifier)</p>${result.backlinkData.referringPages.slice(0, 20).map(bp => `<div style="font-size:.75rem;margin:.4rem 0;padding:.4rem 0;border-bottom:1px solid #2d3348"><a href="${bp.sourceUrl}" target="_blank" style="color:#3b82f6;text-decoration:none;word-break:break-all">${bp.sourceUrl}</a><div style="color:#64748b;font-size:.65rem;margin-top:.2rem">→ ${bp.targetUrl} · Ancre: "${bp.anchor || '(vide)'}" · Rank: ${bp.rank}${bp.dofollow ? ' · dofollow' : ' · nofollow'}</div></div>`).join('')}</div>` : ''}
<p style="font-size:.6rem;color:#64748b">Source : DataForSEO · Données en temps réel</p>` : ''}
${result.gbpData ? `<h2>📍 Google Business Profile (réel)</h2>
<div class="grid" style="grid-template-columns:1fr 1fr 1fr">
<div class="card" style="text-align:center"><div class="val amber">${result.gbpData.avgRating}★</div><p style="font-size:.7rem;color:#94a3b8">Note moyenne</p></div>
<div class="card" style="text-align:center"><div class="val">${result.gbpData.totalReviews}</div><p style="font-size:.7rem;color:#94a3b8">Avis Google</p></div>
<div class="card" style="text-align:center"><div style="font-size:.85rem;font-weight:600">${result.gbpData.category || 'N/A'}</div><p style="font-size:.7rem;color:#94a3b8">Catégorie</p></div>
</div>
<p style="font-size:.6rem;color:#64748b">Source : Google Business Profile · Données vérifiées</p>` : ''}
${result.issues.length ? `<h2>Problèmes identifiés</h2><ul style="padding-left:1.2rem;color:#fca5a5;font-size:.85rem">${result.issues.map(i => `<li style="margin:.3rem 0">${i}</li>`).join('')}</ul>` : ''}
<h2>🔬 Méthodologie</h2>
<div class="card" style="margin-bottom:1rem">
<h3 style="margin-bottom:.5rem">Méthodologie générale E-E-A-T</h3>
<p style="font-size:.8rem;color:#94a3b8;line-height:1.5">L'audit E-E-A-T évalue un site selon les 4 piliers des Quality Rater Guidelines de Google : Experience (vécu terrain), Expertise (compétence technique), Authoritativeness (reconnaissance externe) et Trustworthiness (signaux de confiance). L'analyse combine une télémétrie automatique (crawl HTML, détection Schema.org, balises, liens) et une analyse sémantique par IA (qualité rédactionnelle, originalité, pertinence).</p>
</div>
<div class="card" style="margin-bottom:1rem">
<h3 style="margin-bottom:.5rem">Construction du score</h3>
<p style="font-size:.8rem;color:#94a3b8;line-height:1.5">Le score global est une <strong>moyenne pondérée</strong> des 4 piliers : Expertise (×3.0), Authoritativeness (×2.5), Trustworthiness (×2.5), Experience (×2.0). Chaque pilier combine des signaux de télémétrie (présence de balises, pages, Schema.org) et une analyse sémantique IA. Un signal individuel peut valoir de 5 à 12 points. Ainsi, un site avec plusieurs signaux partiellement remplis peut obtenir un score modéré même avec peu de signaux parfaitement validés.</p>
</div>
<div class="card" style="margin-bottom:1rem">
<h3 style="margin-bottom:.5rem">Méthodologie spécifique</h3>
<p style="font-size:.8rem;color:#94a3b8;line-height:1.5">${result.crawlInfo ? `<strong>${result.crawlInfo.pagesAnalyzed} pages</strong> analysées (${result.crawlInfo.source === 'cache' ? 'crawl complet récent en cache' : 'crawl intermédiaire dédié'}).${result.crawlInfo.sitemapUrlsFound > 0 ? ` ${result.crawlInfo.sitemapUrlsFound} URLs sitemap détectées.` : ''}${result.crawlInfo.crawledAt ? ` Crawl du ${new Date(result.crawlInfo.crawledAt).toLocaleDateString('fr-FR')}.` : ''}` : 'Analyse mono-page (page d\'accueil uniquement).'}</p>
${result.crawlInfo?.crawledUrls?.length ? `<div style="margin-top:.5rem"><p style="font-size:.75rem;color:#94a3b8;font-weight:600;margin-bottom:.25rem">Pages crawlées :</p><ul style="padding-left:1.2rem;font-size:.75rem;color:#64748b">${result.crawlInfo.crawledUrls.map(u => `<li style="margin:.2rem 0"><a href="${u}" style="color:#3b82f6;text-decoration:none">${u}</a></li>`).join('')}</ul></div>` : ''}
</div>
<div class="card" style="margin-bottom:1rem">
<h3 style="margin-bottom:.5rem">Sources de données externes</h3>
<div style="font-size:.8rem;color:#94a3b8;line-height:1.6">
<p style="margin-bottom:.5rem"><strong>🔗 Backlinks (DataForSEO) :</strong> ${result.backlinkData ? `<span style="color:${result.backlinkData.referringDomains >= 50 ? '#22c55e' : result.backlinkData.referringDomains >= 10 ? '#f59e0b' : '#ef4444'}">Détectés</span> — ${result.backlinkData.referringDomains} domaines référents, ${result.backlinkData.backlinksTotal.toLocaleString()} liens totaux, Domain Rank ${result.backlinkData.domainRank}/100 ${result.backlinkData.domainRank >= 50 ? '(solide)' : result.backlinkData.domainRank >= 20 ? '(modéré)' : '(faible)'}. ${result.backlinkData.referringDomains < 10 ? '<em>⚠️ Profil de liens insuffisant pour un bon score Authoritativeness.</em>' : result.backlinkData.referringDomains < 50 ? '<em>Profil de liens correct mais perfectible.</em>' : '<em>Bon profil de liens.</em>'}` : '<span style="color:#ef4444">Aucun backlink détecté.</span> Le pilier Authoritativeness est pénalisé. Il est recommandé de travailler le netlinking (articles invités, partenariats, annuaires de qualité).'}</p>
<p><strong>📍 Google Business Profile :</strong> ${result.gbpData ? `<span style="color:${result.gbpData.avgRating >= 4.0 ? '#22c55e' : result.gbpData.avgRating >= 3.0 ? '#f59e0b' : '#ef4444'}">Détecté</span> — "${result.gbpData.locationName || 'Fiche active'}", note ${result.gbpData.avgRating}★ sur ${result.gbpData.totalReviews} avis${result.gbpData.category ? `, catégorie "${result.gbpData.category}"` : ''}. ${result.gbpData.totalReviews < 10 ? '<em>⚠️ Peu d\'avis — impact limité sur Experience et Trustworthiness.</em>' : result.gbpData.avgRating >= 4.0 ? '<em>Signal de confiance positif.</em>' : '<em>Note moyenne — les avis négatifs peuvent affecter le score Trustworthiness.</em>'}` : '<span style="color:#ef4444">Aucune fiche Google Business détectée.</span> Les piliers Experience et Trustworthiness sont évalués sans données de réputation client. Créer une fiche GMB avec des avis vérifiés renforcerait significativement ces scores.'}</p>
</div>
</div>
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
  ['Moyenne pondérée', 'Calcul dans lequel chaque pilier a un coefficient (poids) reflétant son importance SEO.'],
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
  const contributions = getCategoryContributions(result);
  const synthesis = buildSynthesis(result);

  const htmlContent = buildReportHTML(result);

  const handleDownloadPDF = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(htmlContent);
    w.document.close();
    setTimeout(() => { w.print(); }, 500);
  };

  const handlePrint = () => {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(htmlContent);
    doc.close();
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 500);
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
    <TooltipProvider>
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
            <Button size="sm" variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-1" /> Imprimer
            </Button>
            <Button size="sm" variant="outline" onClick={handleShare} disabled={sharing}>
              {copied ? <Check className="h-4 w-4 mr-1" /> : <Share2 className="h-4 w-4 mr-1" />}
              {copied ? 'Copié !' : sharing ? 'Partage…' : 'Partager'}
            </Button>
          </div>
        </div>

        {/* Report preview */}
        <div className="p-4 space-y-6">
          {/* Score overview + synthesis */}
          <div className="text-center py-4">
            <div className={`text-5xl font-extrabold ${getScoreColor(result.score)}`}>
              {result.score}<span className="text-lg text-muted-foreground">/100</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">Score global E-E-A-T</p>
            <p className={`text-xs mt-2 px-4 py-1.5 inline-block rounded-full ${getScoreBadgeClasses(result.score)}`}>
              {getScoreLabel(result.score)}
            </p>
            {result.crawlInfo && (
              <p className="text-xs text-muted-foreground mt-2">
                📄 {result.crawlInfo.pagesAnalyzed} pages analysées ({result.crawlInfo.source === 'cache' ? 'crawl récent en cache' : 'crawl intermédiaire'})
                {result.crawlInfo.sitemapUrlsFound > 0 && ` · ${result.crawlInfo.sitemapUrlsFound} URLs sitemap`}
              </p>
            )}
          </div>

          {/* Contextual synthesis */}
          <div className="text-center px-4 -mt-2">
            <p className="text-sm text-muted-foreground leading-relaxed bg-muted/30 rounded-lg px-4 py-3 inline-block max-w-xl">
              💡 {synthesis}
            </p>
          </div>

          {/* Score decomposition chart */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">📊 Décomposition du score</h3>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  Chaque pilier a un poids différent dans le score final. La barre claire indique la contribution maximale possible, la barre pleine la contribution réelle.
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="rounded-lg border border-border p-4 bg-background space-y-3">
              {contributions.map(c => {
                const barColor = c.value >= 70 ? 'bg-green-500' : c.value >= 40 ? 'bg-amber-500' : 'bg-destructive';
                const ghostColor = c.value >= 70 ? 'bg-green-500/15' : c.value >= 40 ? 'bg-amber-500/15' : 'bg-destructive/15';
                return (
                  <div key={c.key} className="flex items-center gap-3">
                    <div className="w-28 text-right flex items-center justify-end gap-1.5 shrink-0">
                      <c.icon className={`h-3.5 w-3.5 ${c.color}`} />
                      <span className="text-xs text-muted-foreground">{c.label}</span>
                    </div>
                    <div className="flex-1 h-4 bg-muted rounded relative overflow-hidden">
                      <div className={`absolute inset-y-0 left-0 rounded ${ghostColor}`} style={{ width: `${c.maxContribution}%` }} />
                      <div className={`absolute inset-y-0 left-0 rounded ${barColor}`} style={{ width: `${c.actualContribution}%` }} />
                    </div>
                    <div className={`w-20 text-xs font-semibold text-right ${getScoreColor(c.value)}`}>
                      {c.actualContribution}/{c.maxContribution}
                    </div>
                  </div>
                );
              })}
              <p className="text-[10px] text-muted-foreground text-center mt-1">
                Poids : Expertise ×3.0 · Authoritativeness ×2.5 · Trustworthiness ×2.5 · Experience ×2.0
              </p>
            </div>
          </div>

          {/* Category scores with individual score + weight */}
          <div className="grid grid-cols-2 gap-3">
            {CATEGORY_META.map(cat => {
              const value = result[cat.key as keyof EeatScanResult] as number;
              return (
                <div key={cat.key} className="rounded-lg border border-border p-4 bg-background">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <cat.icon className={`h-4 w-4 ${cat.color}`} />
                    {cat.label}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className={`text-2xl font-bold ${getScoreColor(value)}`}>{value}</span>
                    <span className="text-xs text-muted-foreground">/100</span>
                    <Badge variant="outline" className={`ml-auto text-[10px] ${getScoreBadgeClasses(value)}`}>
                      {getScoreLabel(value)}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">Poids : ×{cat.weight}</p>
                  <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full ${getScoreBg(value)}`} style={{ width: `${value}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Structural signals with 3 levels + weight */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Signaux structurels</h3>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {Object.entries(SIGNAL_LABELS).map(([key, label]) => {
                const ok = (result.signals as any)[key] ?? false;
                const weight = SIGNAL_WEIGHTS[key]?.weight ?? 5;
                const category = SIGNAL_WEIGHTS[key]?.category ?? '';
                // 3 levels: green if present, amber if absent but low weight, red if absent and high weight
                let classes: string;
                let icon: string;
                if (ok) {
                  classes = 'border-green-500/30 bg-green-500/5 text-green-500';
                  icon = '✓';
                } else if (weight >= 10) {
                  classes = 'border-destructive/30 bg-destructive/5 text-destructive';
                  icon = '✗';
                } else {
                  classes = 'border-amber-500/30 bg-amber-500/5 text-amber-500';
                  icon = '⚠';
                }
                return (
                  <Tooltip key={key}>
                    <TooltipTrigger asChild>
                      <div className={`rounded-md border p-2 text-center cursor-help ${classes}`}>
                        <div>{icon} {label}</div>
                        <div className="text-[9px] opacity-60 mt-0.5">{weight} pts · {category}</div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="text-xs max-w-xs">
                      {ok ? `Signal détecté (+${weight} pts vers ${category})` : `Signal manquant (−${weight} pts sur ${category})`}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
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

          {/* Backlink data */}
          {result.backlinkData && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">🔗 Données Backlinks (réelles)</h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-border p-3 bg-background text-center">
                  <div className="text-xl font-bold text-foreground">{result.backlinkData.referringDomains}</div>
                  <div className="text-[10px] text-muted-foreground">Domaines référents</div>
                </div>
                <div className="rounded-lg border border-border p-3 bg-background text-center">
                  <div className="text-xl font-bold text-foreground">{result.backlinkData.domainRank}</div>
                  <div className="text-[10px] text-muted-foreground">Domain Rank</div>
                </div>
                <div className="rounded-lg border border-border p-3 bg-background text-center">
                  <div className="text-xl font-bold text-foreground">{result.backlinkData.backlinksTotal.toLocaleString()}</div>
                  <div className="text-[10px] text-muted-foreground">Backlinks totaux</div>
                </div>
              </div>
              {result.backlinkData.anchorDistribution && result.backlinkData.anchorDistribution.length > 0 && (
                <div className="rounded-lg border border-border p-3 bg-background">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Top ancres</p>
                  <div className="space-y-1">
                    {result.backlinkData.anchorDistribution.slice(0, 5).map((a, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-foreground truncate max-w-[60%]">"{a.anchor}"</span>
                        <span className="text-muted-foreground">{a.backlinks} liens · {a.domains} domaines</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {result.backlinkData.referringPages && result.backlinkData.referringPages.length > 0 && (
                <div className="rounded-lg border border-border p-3 bg-background">
                  <p className="text-xs font-medium text-muted-foreground mb-2">🔗 Pages référentes (cliquez pour vérifier le backlink)</p>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {result.backlinkData.referringPages.map((bp, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs border-b border-border/50 pb-1.5 last:border-0">
                        <div className="flex-1 min-w-0">
                          <a href={bp.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate block" title={bp.sourceUrl}>
                            {bp.sourceUrl}
                          </a>
                          <div className="flex items-center gap-2 mt-0.5 text-muted-foreground">
                            <span>→ {bp.targetUrl}</span>
                          </div>
                        </div>
                        <div className="shrink-0 text-right text-muted-foreground">
                          <div className="text-[10px]">Ancre: "{bp.anchor || '(vide)'}"</div>
                          <div className="text-[10px]">Rank: {bp.rank}{bp.dofollow ? ' · dofollow' : ' · nofollow'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-[10px] text-muted-foreground">Source : DataForSEO · Données en temps réel</p>
            </div>
          )}

          {/* GBP data */}
          {result.gbpData && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">📍 Google Business Profile (réel)</h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-border p-3 bg-background text-center">
                  <div className="text-xl font-bold text-amber-500">{result.gbpData.avgRating}★</div>
                  <div className="text-[10px] text-muted-foreground">Note moyenne</div>
                </div>
                <div className="rounded-lg border border-border p-3 bg-background text-center">
                  <div className="text-xl font-bold text-foreground">{result.gbpData.totalReviews}</div>
                  <div className="text-[10px] text-muted-foreground">Avis Google</div>
                </div>
                <div className="rounded-lg border border-border p-3 bg-background text-center">
                  <div className="text-xs font-medium text-foreground">{result.gbpData.category || 'N/A'}</div>
                  <div className="text-[10px] text-muted-foreground">Catégorie</div>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">Source : Google Business Profile · Données vérifiées</p>
            </div>
          )}

          {/* Data sources */}
          {result.dataSources && result.dataSources.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-muted-foreground">Sources :</span>
              {result.dataSources.map((s, i) => (
                <Badge key={i} variant="outline" className="text-[9px] py-0">
                  {s === 'crawl_html' ? '🕷️ Crawl HTML' : 
                   s === 'llm_semantic' ? '🤖 IA Sémantique' : 
                   s === 'dataforseo_backlinks' ? '🔗 Backlinks DataForSEO' : 
                   s === 'google_business_profile' ? '📍 Google Business' : s}
                </Badge>
              ))}
            </div>
          )}


          <div className="space-y-3 pt-2">
            <h3 className="text-sm font-semibold text-foreground">🔬 Méthodologie</h3>
            <div className="rounded-lg border border-border p-4 bg-muted/30 text-sm space-y-3">
              <div>
                <p className="font-medium text-foreground mb-1">Méthodologie générale E-E-A-T</p>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  L'audit E-E-A-T évalue un site selon les 4 piliers des Quality Rater Guidelines de Google : 
                  Experience (vécu terrain), Expertise (compétence technique), Authoritativeness (reconnaissance externe) 
                  et Trustworthiness (signaux de confiance). L'analyse combine une télémétrie automatique (crawl HTML, 
                  détection Schema.org, balises, liens) et une analyse sémantique par IA (qualité rédactionnelle, 
                  originalité, pertinence).
                </p>
              </div>
              <div>
                <p className="font-medium text-foreground mb-1">Construction du score</p>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Le score global est une <strong className="text-foreground">moyenne pondérée</strong> des 4 piliers : 
                  Expertise (×3.0), Authoritativeness (×2.5), Trustworthiness (×2.5), Experience (×2.0). 
                  Chaque pilier combine des signaux de télémétrie (présence de balises, pages, Schema.org) et une 
                  analyse sémantique IA. Un signal individuel peut valoir de 5 à 12 points. Ainsi, un site avec 
                  plusieurs signaux partiellement remplis peut obtenir un score modéré même avec peu de signaux 
                  parfaitement validés.
                </p>
              </div>
              <div>
                <p className="font-medium text-foreground mb-1">Méthodologie spécifique de ce rapport</p>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {result.crawlInfo ? (
                    <>
                      <strong className="text-foreground">{result.crawlInfo.pagesAnalyzed} pages</strong> ont été analysées 
                      ({result.crawlInfo.source === 'cache' ? 'crawl complet récent en cache' : 'crawl intermédiaire dédié'}).
                      {result.crawlInfo.sitemapUrlsFound > 0 && <> {result.crawlInfo.sitemapUrlsFound} URLs détectées dans le sitemap.</>}
                      {result.crawlInfo.crawledAt && <> Crawl effectué le {new Date(result.crawlInfo.crawledAt).toLocaleDateString('fr-FR')}.</>}
                    </>
                  ) : (
                    <>Analyse mono-page (page d'accueil uniquement).</>
                  )}
                </p>
                {result.crawlInfo?.crawledUrls && result.crawlInfo.crawledUrls.length > 0 && (
                  <div className="mt-2">
                    <p className="font-medium text-foreground text-xs mb-1">Pages crawlées :</p>
                    <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
                      {result.crawlInfo.crawledUrls.map((u, i) => (
                        <li key={i} className="truncate">
                          <a href={u} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{u}</a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>

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
                { term: 'Moyenne pondérée', desc: 'Calcul dans lequel chaque pilier a un coefficient (poids) reflétant son importance SEO.' },
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
    </TooltipProvider>
  );
}
