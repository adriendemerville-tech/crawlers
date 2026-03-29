import { useState, useEffect } from 'react';
import { Braces, FileText, Hash, Code2, AlignLeft, Plus, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface StructuredDataPanelProps {
  result: any;
  setResult: (v: any) => void;
}

export function ContentArchitectStructuredDataPanel({ result, setResult }: StructuredDataPanelProps) {
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [robotsTxt, setRobotsTxt] = useState('');
  const [schemas, setSchemas] = useState<{ type: string; priority: string }[]>([]);
  const [newSchemaType, setNewSchemaType] = useState('');

  // Sync from result
  useEffect(() => {
    if (!result) return;
    setMetaTitle(result.metadata_enrichment?.meta_title || '');
    setMetaDescription(result.metadata_enrichment?.meta_description || '');
    setSchemas(result.metadata_enrichment?.json_ld_schemas || []);
  }, [result]);

  const updateResult = (path: string, value: any) => {
    if (!result) return;
    const updated = JSON.parse(JSON.stringify(result));
    const parts = path.split('.');
    let obj = updated;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!obj[parts[i]]) obj[parts[i]] = {};
      obj = obj[parts[i]];
    }
    obj[parts[parts.length - 1]] = value;
    setResult(updated);
  };

  const addSchema = () => {
    if (!newSchemaType.trim()) return;
    const updated = [...schemas, { type: newSchemaType.trim(), priority: 'medium' }];
    setSchemas(updated);
    updateResult('metadata_enrichment.json_ld_schemas', updated);
    setNewSchemaType('');
  };

  const removeSchema = (index: number) => {
    const updated = schemas.filter((_, i) => i !== index);
    setSchemas(updated);
    updateResult('metadata_enrichment.json_ld_schemas', updated);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-white/10 flex items-center gap-2">
        <Braces className="w-3.5 h-3.5 text-white/50 stroke-[1.5]" />
        <h3 className="text-xs font-semibold text-white/70">Données structurées</h3>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {/* Meta title */}
          <div className="space-y-1">
            <label className="text-[10px] text-white/40 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3 h-3 stroke-[1.5]" /> Meta Title
            </label>
            <Input
              value={metaTitle}
              onChange={e => { setMetaTitle(e.target.value); updateResult('metadata_enrichment.meta_title', e.target.value); }}
              placeholder="Titre SEO de la page"
              className="bg-white/5 border-white/10 text-white text-xs h-8"
            />
            <div className="flex justify-end">
              <span className={`text-[9px] ${metaTitle.length > 60 ? 'text-red-400' : 'text-white/30'}`}>{metaTitle.length}/60</span>
            </div>
          </div>

          {/* Meta description */}
          <div className="space-y-1">
            <label className="text-[10px] text-white/40 uppercase tracking-wider flex items-center gap-1.5">
              <AlignLeft className="w-3 h-3 stroke-[1.5]" /> Meta Description
            </label>
            <Textarea
              value={metaDescription}
              onChange={e => { setMetaDescription(e.target.value); updateResult('metadata_enrichment.meta_description', e.target.value); }}
              placeholder="Description SEO"
              rows={3}
              className="bg-white/5 border-white/10 text-white text-xs resize-none"
            />
            <div className="flex justify-end">
              <span className={`text-[9px] ${metaDescription.length > 160 ? 'text-red-400' : 'text-white/30'}`}>{metaDescription.length}/160</span>
            </div>
          </div>

          {/* JSON-LD Schemas */}
          <div className="space-y-2">
            <label className="text-[10px] text-white/40 uppercase tracking-wider flex items-center gap-1.5">
              <Code2 className="w-3 h-3 stroke-[1.5]" /> Schemas JSON-LD
            </label>
            <div className="space-y-1">
              {schemas.map((s, i) => (
                <div key={i} className="flex items-center gap-2 bg-white/[0.03] border border-white/5 rounded px-2 py-1.5">
                  <Code2 className="w-3 h-3 text-white/30 stroke-[1.5]" />
                  <span className="text-[11px] text-white/60 font-mono flex-1">{s.type}</span>
                  <Badge className="text-[8px] px-1 py-0 bg-white/5 text-white/40 border-0">{s.priority}</Badge>
                  <button onClick={() => removeSchema(i)} className="text-white/20 hover:text-red-400 transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-1">
              <Input
                value={newSchemaType}
                onChange={e => setNewSchemaType(e.target.value)}
                placeholder="Article, FAQ, HowTo…"
                className="bg-white/5 border-white/10 text-white text-[10px] h-7 flex-1"
                onKeyDown={e => { if (e.key === 'Enter') addSchema(); }}
              />
              <Button size="sm" onClick={addSchema} className="h-7 px-2 bg-white/5 hover:bg-white/10 text-white/50 border border-white/10">
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          </div>

          {/* robots.txt directives */}
          <div className="space-y-1">
            <label className="text-[10px] text-white/40 uppercase tracking-wider flex items-center gap-1.5">
              <Hash className="w-3 h-3 stroke-[1.5]" /> Directives robots / canonical
            </label>
            <Textarea
              value={robotsTxt}
              onChange={e => setRobotsTxt(e.target.value)}
              placeholder={"canonical: https://...\nnoindex: false\nnofollow: false"}
              rows={3}
              className="bg-white/5 border-white/10 text-white text-[10px] resize-none font-mono"
            />
          </div>

          {!result && (
            <div className="text-center py-6">
              <Braces className="w-6 h-6 text-white/10 mx-auto mb-2 stroke-[1.5]" />
              <p className="text-[10px] text-white/20">Générez du contenu pour éditer les données structurées</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
