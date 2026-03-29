import { FileText, Code2, Image, Link2, ChevronUp, RotateCcw, Loader2, Save, Upload, Plug } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { t3 } from '@/utils/i18n';

const themes = {
  cocoon: {
    accent: '#fbbf24',
    accentClass: 'text-[#fbbf24]',
    accentBg: 'bg-[#fbbf24]/5',
    accentBorder: 'border-[#fbbf24]/20',
    accentLabel: 'text-[#fbbf24]/60',
    accentStrong: 'text-[#fbbf24]',
    accentMuted: 'text-[#fbbf24]/70',
    accentFocusRing: 'focus:ring-[#fbbf24]/40',
    accentBorderL: 'border-[#fbbf24]/30',
    guideBg: 'bg-[#1a1035]',
  },
  green: {
    accent: '#10b981',
    accentClass: 'text-emerald-400',
    accentBg: 'bg-emerald-500/5',
    accentBorder: 'border-emerald-500/20',
    accentLabel: 'text-emerald-400/60',
    accentStrong: 'text-emerald-400',
    accentMuted: 'text-emerald-400/70',
    accentFocusRing: 'focus:ring-emerald-400/40',
    accentBorderL: 'border-emerald-500/30',
    guideBg: 'bg-[#0b1a14]',
  },
};

interface ContentArchitectPreviewProps {
  result: any;
  setResult: (v: any) => void;
  loading: boolean;
  url: string;
  isEdited: boolean;
  onResetEdits: () => void;
  showGuide: boolean;
  setShowGuide: (v: boolean) => void;
  language: string;
  counters: { h1: number; h2: number; h3: number; chars: number; medias: number; links: number };
  onSaveDraft?: () => void;
  onPublish?: () => void;
  publishing?: boolean;
  savingDraft?: boolean;
  hasCmsConnection?: boolean;
  isExistingPage?: boolean;
  creditsCost?: number | null;
  colorTheme?: 'cocoon' | 'green';
}

export function ContentArchitectPreview({
  result, setResult, loading, url, isEdited, onResetEdits, showGuide, setShowGuide, language, counters,
  onSaveDraft, onPublish, publishing, savingDraft, hasCmsConnection, isExistingPage, creditsCost, colorTheme = 'cocoon',
}: ContentArchitectPreviewProps) {
  const t = themes[colorTheme];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Preview header with save/publish */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-white/10">
        <span className="text-xs text-white/60">{result ? 'Aperçu de la structure' : 'Canvas Preview'}</span>
        {url && <span className="text-[10px] text-white/30 font-mono truncate flex-1 text-right">{url}</span>}
        <div className="flex items-center gap-1.5 ml-auto shrink-0">
          {onSaveDraft && (
            <Button onClick={onSaveDraft} disabled={savingDraft} size="sm" variant="ghost"
              className="h-7 px-2.5 text-[10px] text-white/50 hover:text-white/80 hover:bg-white/5 gap-1.5">
              {savingDraft ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3 stroke-[1.5]" />}
              Enregistrer
            </Button>
          )}
          {onPublish && result && (
            <Button onClick={onPublish} disabled={publishing} size="sm"
              className={hasCmsConnection
                ? 'h-7 px-3 text-[10px] bg-emerald-500 hover:bg-emerald-600 text-white font-semibold gap-1.5'
                : 'h-7 px-3 text-[10px] bg-white/10 hover:bg-white/15 text-white/60 border border-white/10 gap-1.5'}>
              {publishing ? <Loader2 className="w-3 h-3 animate-spin" /> : hasCmsConnection ? <Upload className="w-3 h-3 stroke-[1.5]" /> : <Plug className="w-3 h-3 stroke-[1.5]" />}
              {hasCmsConnection ? (isExistingPage ? 'Mettre à jour' : `Publier${creditsCost ? ` · ${creditsCost} ₵` : ''}`) : 'Connecter CMS'}
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        {!result && !loading && (
          <div className="relative w-full min-h-[400px] rounded-lg overflow-hidden border border-white/10">
            {url ? (
              <>
                <iframe src={url} className="w-full h-full absolute inset-0 opacity-30 pointer-events-none min-h-[400px]" sandbox="allow-scripts" title="Aperçu du site cible" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
                  <div className="text-center space-y-2">
                    <FileText className="w-8 h-8 text-white/15 mx-auto" />
                    <p className="text-sm text-white/30">{t3(language, 'Remplissez les champs et lancez la génération', 'Fill in fields and generate', 'Rellene los campos y genere')}</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full min-h-[400px] text-white/20 text-sm">
                {t3(language, 'Remplissez les champs et lancez la génération', 'Fill in the fields and launch generation', 'Rellene los campos y lance la generación')}
              </div>
            )}
          </div>
        )}
        {loading && (
          <div className="flex items-center justify-center h-full min-h-[400px]">
            <div className="text-center space-y-3">
              <Loader2 className={`w-6 h-6 animate-spin ${t.accentClass} mx-auto`} />
              <p className="text-xs text-white/40">Génération en cours…</p>
            </div>
          </div>
        )}
        {result && (
          <div className="space-y-4 text-white/80">
            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-6 space-y-5">
              {/* Meta title */}
              {result.metadata_enrichment?.meta_title && (
                <div className={`text-[11px] font-mono truncate ${t.accentLabel}`}>{result.metadata_enrichment.meta_title}</div>
              )}
              {/* Meta description */}
              {result.metadata_enrichment?.meta_description && (
                <p className={`text-sm text-white/50 italic border-l-2 ${t.accentBorderL} pl-3 outline-none ${t.accentFocusRing} rounded`}
                  contentEditable suppressContentEditableWarning
                  onBlur={e => { const u = { ...result }; u.metadata_enrichment.meta_description = e.currentTarget.textContent || ''; setResult(u); }}
                >{result.metadata_enrichment.meta_description}</p>
              )}
              {/* TL;DR */}
              {result.content_structure?.tldr_summary && (
                <div className={`p-3 rounded-lg ${t.accentBg} border ${t.accentBorder}`}>
                  <p className={`text-xs uppercase tracking-wider mb-1 ${t.accentLabel}`}>TL;DR</p>
                  <p className={`text-sm text-white/70 outline-none ${t.accentFocusRing} rounded`}
                    contentEditable suppressContentEditableWarning
                    onBlur={e => { const u = { ...result }; u.content_structure.tldr_summary = e.currentTarget.textContent || ''; setResult(u); }}
                  >{result.content_structure.tldr_summary}</p>
                </div>
              )}
              {/* Introduction */}
              {result.content_structure?.introduction && (
                <p className={`text-sm text-white/60 leading-relaxed outline-none ${t.accentFocusRing} rounded border-l-2 border-emerald-500/30 pl-3`}
                  contentEditable suppressContentEditableWarning
                  onBlur={e => { const u = { ...result }; u.content_structure.introduction = e.currentTarget.textContent || ''; setResult(u); }}
                >{result.content_structure.introduction}</p>
              )}
              {/* Confidence */}
              {result.confidence_score != null && (
                <div className="flex items-center gap-3">
                  <div className={`text-xs font-bold px-2 py-0.5 rounded ${result.confidence_score >= 70 ? 'bg-emerald-500/20 text-emerald-300' : result.confidence_score >= 40 ? 'bg-amber-500/20 text-amber-300' : 'bg-red-500/20 text-red-300'}`}>
                    Confiance : {result.confidence_score}%
                  </div>
                  {result.rationale && <span className="text-[10px] text-white/40 italic truncate flex-1">{result.rationale}</span>}
                </div>
              )}
              {/* Warnings */}
              {result.coherence_check?.warnings?.length > 0 && (
                <div className="space-y-1">
                  {result.coherence_check.warnings.map((w: string, i: number) => (
                    <div key={i} className="text-[11px] text-amber-400/80 bg-amber-500/10 rounded px-2 py-1">{w}</div>
                  ))}
                </div>
              )}
              {/* Sections */}
              {(result.content_structure?.sections || []).map((s: any, i: number) => (
                <div key={i} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h2 className={`text-lg font-semibold text-white/90 outline-none ${t.accentFocusRing} rounded px-1 -mx-1`}
                      contentEditable suppressContentEditableWarning
                      onBlur={e => { const u = { ...result }; u.content_structure.sections[i].title = e.currentTarget.textContent || ''; setResult(u); }}
                    >{s.title}</h2>
                    <div className="flex items-center gap-2">
                      {s.priority && <span className={`text-[9px] px-1.5 py-0.5 rounded ${s.priority === 'high' ? 'bg-red-500/20 text-red-300' : s.priority === 'medium' ? 'bg-amber-500/20 text-amber-300' : 'bg-white/10 text-white/40'}`}>{s.priority}</span>}
                      <span className="text-[10px] text-white/30">{s.word_count} mots</span>
                    </div>
                  </div>
                  {s.body_text ? (
                    <div className={`text-sm text-white/60 leading-relaxed whitespace-pre-wrap outline-none ${t.accentFocusRing} rounded pl-2 border-l border-white/5`}
                      contentEditable suppressContentEditableWarning
                      onBlur={e => { const u = { ...result }; u.content_structure.sections[i].body_text = e.currentTarget.textContent || ''; setResult(u); }}
                    >{s.body_text}</div>
                  ) : s.purpose ? (
                    <p className="text-xs text-white/40 italic pl-2 border-l border-white/5">{s.purpose}</p>
                  ) : null}
                  {(result.content_structure?.media_recommendations || [])
                    .filter((m: any) => m.placement === `after_h2_${i + 1}` || (i === 0 && m.placement === 'hero'))
                    .map((m: any, mi: number) => (
                      <div key={mi} className="flex items-center gap-2 text-[10px] text-white/30 bg-white/[0.03] rounded px-2 py-1">
                        <Image className="w-3 h-3" /><span>{m.type}: {m.description}</span>
                        {m.alt_text && <span className="text-white/20">alt="{m.alt_text}"</span>}
                      </div>
                    ))}
                </div>
              ))}
              {/* H3 */}
              {(result.content_structure?.hn_hierarchy || []).filter((h: any) => h.level === 'h3').length > 0 && !(result.content_structure?.sections || []).some((s: any) => s.body_text) && (
                <div className="space-y-2 mt-4">
                  <p className="text-[10px] text-white/30 uppercase tracking-wider">Sous-sections H3</p>
                  {(result.content_structure.hn_hierarchy || []).filter((h: any) => h.level === 'h3').map((hn: any, i: number) => (
                    <h3 key={i} className={`text-base font-medium text-white/70 ml-4 outline-none ${t.accentFocusRing} rounded px-1 -mx-1`}
                      contentEditable suppressContentEditableWarning
                      onBlur={e => { const u = { ...result }; const idx = u.content_structure.hn_hierarchy.indexOf(hn); if (idx >= 0) u.content_structure.hn_hierarchy[idx].text = e.currentTarget.textContent || ''; setResult(u); }}
                    >{hn.text}</h3>
                  ))}
                </div>
              )}
              {/* Keyword strategy */}
              {result.keyword_strategy?.primary_keyword && (
                <div className={`p-3 rounded-lg ${t.accentBg} border ${t.accentBorder} space-y-2`}>
                  <div>
                    <span className={`text-xs ${t.accentMuted}`}>Mot-clé principal : </span>
                    <span className={`text-sm font-semibold ${t.accentStrong}`}>{result.keyword_strategy.primary_keyword.keyword}</span>
                    <span className="text-xs text-white/40 ml-2">densité : {result.keyword_strategy.primary_keyword.target_density_percent}%</span>
                  </div>
                  {result.keyword_strategy.secondary_keywords?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-[10px] text-white/40">Secondaires :</span>
                      {result.keyword_strategy.secondary_keywords.map((kw: any, i: number) => (
                        <span key={i} className="text-[10px] bg-white/5 text-white/50 px-1.5 py-0.5 rounded">{kw.keyword} ({kw.target_density_percent}%)</span>
                      ))}
                    </div>
                  )}
                  {result.keyword_strategy.lsi_terms?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-[10px] text-white/40">LSI :</span>
                      {result.keyword_strategy.lsi_terms.map((lsi: any, i: number) => (
                        <span key={i} className="text-[10px] bg-purple-500/10 text-purple-300/60 px-1.5 py-0.5 rounded">{lsi.term}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {/* Internal links */}
              {result.internal_linking?.anchor_strategy?.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-white/40 uppercase tracking-wider">Liens internes ({result.internal_linking.anchor_strategy.length})</p>
                  {result.internal_linking.anchor_strategy.map((a: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <Link2 className="w-3 h-3 text-emerald-400/60" />
                      <span className="text-emerald-300 font-mono">{a.anchor_text}</span>
                      <span className="text-white/30">→ {a.target_intent}</span>
                    </div>
                  ))}
                </div>
              )}
              {/* GEO criteria */}
              {result.geo_criteria_applied?.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-white/40 uppercase tracking-wider">Critères GEO</p>
                  <div className="grid grid-cols-1 gap-1">
                    {result.geo_criteria_applied.map((gc: any, i: number) => (
                      <div key={i} className={`flex items-center gap-2 text-[11px] px-2 py-1 rounded ${gc.activated ? 'bg-emerald-500/10 text-emerald-300/80' : 'bg-white/[0.02] text-white/30'}`}>
                        <span>{gc.activated ? '✓' : '○'}</span>
                        <span className="font-medium">{gc.name}</span>
                        {gc.weight === 'reinforced' && <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1 rounded">renforcé</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* JSON-LD */}
              {result.metadata_enrichment?.json_ld_schemas?.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-white/40 uppercase tracking-wider">Schemas JSON-LD</p>
                  {result.metadata_enrichment.json_ld_schemas.map((s: any, i: number) => (
                    <div key={i} className="text-[11px] text-white/40 bg-white/[0.03] rounded px-2 py-1 flex items-center gap-2">
                      <Code2 className="w-3 h-3" /><span className="font-mono">{s.type}</span>
                    </div>
                  ))}
                </div>
              )}
              {/* Word count range */}
              {result.content_structure?.word_count_range && (
                <div className="text-[10px] text-white/30 flex items-center gap-3 pt-2 border-t border-white/5">
                  <span>📏 Objectif : {result.content_structure.word_count_range.min}–{result.content_structure.word_count_range.max} mots</span>
                  <span className="text-white/50 font-medium">(idéal : {result.content_structure.word_count_range.ideal})</span>
                </div>
              )}
            </div>
          </div>
        )}
      </ScrollArea>

      {/* Bottom bar */}
      {result && (
        <div className="border-t border-white/10 px-4 py-2.5 flex items-center justify-between">
          {isEdited ? (
            <button onClick={onResetEdits} className="flex items-center gap-1.5 text-[10px] text-white/40 hover:text-white/60 transition-colors">
              <RotateCcw className="w-3 h-3" />Restaurer l'original
            </button>
          ) : <div />}
          <div className="relative">
            <button onClick={() => setShowGuide(!showGuide)} className="flex items-center gap-1.5 text-[10px] text-white/30 hover:text-white/50 transition-colors">
              <span className={`transition-transform duration-200 ${showGuide ? 'rotate-180' : ''}`}><ChevronUp className="w-3 h-3" /></span>
              Mode d'emploi
            </button>
            {showGuide && (
              <div className={`absolute bottom-full right-0 mb-1 w-80 p-3 rounded-lg ${t.guideBg} border border-white/10 shadow-xl text-xs text-white/60 space-y-2 z-10`}>
                <p className="font-medium text-white/80">Comment ça marche ?</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Ouvrez le panneau Prompt pour vos instructions</li>
                  <li>Ouvrez Structure pour configurer la page</li>
                  <li>Cliquez Générer — la preview s'affiche ici</li>
                  <li>Éditez le contenu directement dans la preview</li>
                  <li>Ouvrez Images pour générer des visuels</li>
                  <li>Publiez via le bouton en haut à droite</li>
                </ol>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
