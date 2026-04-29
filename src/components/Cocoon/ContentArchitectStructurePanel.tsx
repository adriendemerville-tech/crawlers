import { Loader2, Send, X, Layers, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { t3 } from '@/utils/i18n';

interface ContentArchitectStructurePanelProps {
  domain: string;
  directory: string;
  setDirectory: (v: string) => void;
  directories: { path: string; label: string; category: string | null }[];
  slug: string;
  setSlug: (v: string) => void;
  keyword: string;
  setKeyword: (v: string) => void;
  pageType: string;
  setPageType: (v: string) => void;
  length: string;
  setLength: (v: string) => void;
  h1Field: string;
  setH1Field: (v: string) => void;
  h2Fields: string[];
  setH2Fields: (v: string[] | ((prev: string[]) => string[])) => void;
  keywordTags: string[];
  setKeywordTags: (v: string[] | ((prev: string[]) => string[])) => void;
  keywordCloudSuggestions: { keyword: string; position: number; search_volume: number }[];
  autoFilled: Set<string>;
  isExistingPage: boolean;
  detectPageTypeFromDirectory: (dir: string, cat: string | null) => string | null;
  result: any;
  setResult: (v: any) => void;
  loading: boolean;
  onGenerate: (force?: boolean) => void;
  strategistLoading: boolean;
  strategistDone: boolean;
  language: string;
  pageTypes: { value: string; label: string }[];
  lengths: { value: string; label: string }[];
  cacheInfo?: { cached: boolean; ageDays?: number } | null;
  crawlersReco?: { markdown: string; created_at: string } | null;
  onApplyRecommendation?: () => void;
}

export function ContentArchitectStructurePanel({
  domain, directory, setDirectory, directories, slug, setSlug, keyword, setKeyword,
  pageType, setPageType, length, setLength, h1Field, setH1Field, h2Fields, setH2Fields,
  keywordTags, setKeywordTags, keywordCloudSuggestions, autoFilled, isExistingPage,
  detectPageTypeFromDirectory, result, setResult, loading, onGenerate,
  strategistLoading, strategistDone, language, pageTypes, lengths,
}: ContentArchitectStructurePanelProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-white/10 flex items-center gap-2">
        <Layers className="w-3.5 h-3.5 text-white/50 stroke-[1.5]" />
        <h3 className="text-xs font-semibold text-white/70">Structure de la page</h3>
      </div>

      {strategistLoading && !strategistDone && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[#fbbf24]/20 bg-[#fbbf24]/5">
          <Loader2 className="w-3 h-3 animate-spin text-[#fbbf24]" />
          <span className="text-[10px] text-[#fbbf24]/70">Analyse stratégique…</span>
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {/* Répertoire */}
          <div className="space-y-1">
            <label className="text-[10px] text-white/40 uppercase tracking-wider">Répertoire</label>
            <Select value={directory} onValueChange={setDirectory}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white text-xs h-8"><SelectValue placeholder="Choisir" /></SelectTrigger>
              <SelectContent>
                {directories.map(d => <SelectItem key={d.path} value={d.path}>{d.label} <span className="text-white/30 ml-1">({d.path || '/'})</span></SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Slug */}
          <div className="space-y-1">
            <label className="text-[10px] text-white/40 uppercase tracking-wider flex items-center gap-1">
              Slug
              {!isExistingPage && keyword && <span className="text-[9px] text-[#fbbf24]/60 normal-case">auto</span>}
            </label>
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-white/25 shrink-0 truncate max-w-[100px]">{domain}{directory}/</span>
              <Input value={slug} onChange={e => setSlug(e.target.value)} placeholder="mon-article" className="bg-white/5 border-white/10 text-white text-xs h-8 flex-1" />
            </div>
          </div>

          {/* Mot-clé */}
          <div className="space-y-1">
            <label className="text-[10px] text-white/40 uppercase tracking-wider flex items-center gap-1">
              Mot-clé principal
              {autoFilled.has('keyword') && <span className="text-[9px] text-[#fbbf24]/60 normal-case">auto</span>}
            </label>
            <Input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="mot-clé principal" className="bg-white/5 border-white/10 text-white text-xs h-8" />
          </div>

          {/* Type + Longueur */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] text-white/40 uppercase tracking-wider">Type</label>
              <Select value={pageType} onValueChange={setPageType}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white text-[10px] h-8"><SelectValue /></SelectTrigger>
                <SelectContent>{pageTypes.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-white/40 uppercase tracking-wider">Longueur</label>
              <Select value={length} onValueChange={setLength}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white text-[10px] h-8"><SelectValue /></SelectTrigger>
                <SelectContent>{lengths.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {/* H1 */}
          <div className="space-y-1">
            <label className="text-[10px] text-white/40 uppercase tracking-wider">H1</label>
            <Input
              value={h1Field}
              onChange={e => {
                setH1Field(e.target.value);
                if (result?.content_structure) {
                  const updated = { ...result };
                  updated.content_structure.recommended_h1 = e.target.value;
                  setResult(updated);
                }
              }}
              placeholder="Titre principal (H1)"
              className="bg-white/5 border-white/10 text-white text-sm h-9 font-semibold"
            />
          </div>

          {/* H2 */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-white/40 uppercase tracking-wider flex items-center justify-between">
              H2
              <button onClick={() => setH2Fields((prev: string[]) => [...prev, ''])} className="text-[10px] text-[#fbbf24]/60 hover:text-[#fbbf24] normal-case">+ Ajouter</button>
            </label>
            {h2Fields.map((h2, i) => (
              <div key={i} className="flex items-center gap-1">
                <span className="text-[9px] text-white/20 shrink-0 w-4">#{i + 1}</span>
                <Input
                  value={h2}
                  onChange={e => {
                    const updated = [...h2Fields]; updated[i] = e.target.value;
                    setH2Fields(updated);
                    if (result?.content_structure?.sections?.[i]) { const u = { ...result }; u.content_structure.sections[i].title = e.target.value; setResult(u); }
                  }}
                  placeholder={`H2 #${i + 1}`}
                  className="bg-white/5 border-white/10 text-white text-xs h-7 flex-1"
                />
                {h2Fields.length > 1 && <button onClick={() => setH2Fields((prev: string[]) => prev.filter((_, j) => j !== i))} className="text-white/20 hover:text-white/40 text-xs p-1">×</button>}
              </div>
            ))}
          </div>

          {/* Keywords */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-white/40 uppercase tracking-wider flex items-center justify-between">
              Mots-clés cibles
              {keywordCloudSuggestions.length > 0 && <span className="text-[9px] text-[#fbbf24]/60 normal-case">{keywordCloudSuggestions.length} sugg.</span>}
            </label>
            <div className="flex flex-wrap gap-1 min-h-[24px]">
              {keywordTags.map((tag, i) => (
                <span key={`${tag}-${i}`} className="group inline-flex items-center gap-0.5 bg-[#fbbf24]/10 text-[#fbbf24] border border-[#fbbf24]/20 rounded-full px-2 py-0.5 text-[10px] font-medium">
                  {tag}
                  <button onClick={() => setKeywordTags((prev: string[]) => prev.filter((_, j) => j !== i))} className="opacity-0 group-hover:opacity-100 transition-opacity text-[#fbbf24]/60 hover:text-[#fbbf24] ml-0.5">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
            </div>
            {keywordCloudSuggestions.filter(s => !keywordTags.includes(s.keyword)).length > 0 && (
              <div className="flex flex-wrap gap-1 max-h-[60px] overflow-y-auto">
                {keywordCloudSuggestions.filter(s => !keywordTags.includes(s.keyword)).slice(0, 12).map((s, i) => (
                  <button key={`sug-${i}`} onClick={() => setKeywordTags((prev: string[]) => [...prev, s.keyword])}
                    className="text-[9px] bg-white/5 text-white/40 hover:text-white/70 hover:bg-white/10 border border-white/10 rounded-full px-1.5 py-0.5 transition-colors"
                    title={`Pos: #${s.position} — Vol: ${s.search_volume}/m`}>
                    + {s.keyword}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      {/* Sticky generate button */}
      <div className="shrink-0 p-3 border-t border-white/10">
        <Button onClick={onGenerate} disabled={loading || !keyword || (!directory && !slug)} className="w-full bg-[#fbbf24] hover:bg-[#f59e0b] text-[#0f0a1e] font-semibold h-9 text-xs">
          {loading ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />{t3(language, 'Génération…', 'Generating…', 'Generando…')}</> : <><Send className="w-3.5 h-3.5 mr-2" />{t3(language, 'Générer la page', 'Generate page', 'Generar página')}</>}
        </Button>
      </div>
    </div>
  );
}
