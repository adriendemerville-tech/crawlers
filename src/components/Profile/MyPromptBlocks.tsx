import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Copy, Check, X, Loader2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface PromptBlock {
  id: string;
  name: string;
  content: string;
  block_type: string;
  score: number | null;
  created_at: string;
  updated_at: string;
}

const translations = {
  fr: {
    noPrompts: 'Aucun prompt',
    noPromptsDesc: 'Créez votre premier bloc prompt pour l\'utiliser dans Content Architect.',
    add: 'Nouveau prompt',
    rename: 'Renommer',
    delete: 'Supprimer',
    duplicate: 'Dupliquer',
    deleted: 'Prompt supprimé',
    duplicated: 'Prompt dupliqué',
    created: 'Prompt créé',
    saved: 'Prompt enregistré',
    defaultName: 'Nouveau prompt',
    placeholder: 'Écrivez votre prompt ici... (ex: Génère une FAQ de 5 questions/réponses en lien avec le sujet principal)',
  },
  en: {
    noPrompts: 'No prompts',
    noPromptsDesc: 'Create your first prompt block to use in Content Architect.',
    add: 'New prompt',
    rename: 'Rename',
    delete: 'Delete',
    duplicate: 'Duplicate',
    deleted: 'Prompt deleted',
    duplicated: 'Prompt duplicated',
    created: 'Prompt created',
    saved: 'Prompt saved',
    defaultName: 'New prompt',
    placeholder: 'Write your prompt here... (e.g. Generate a FAQ with 5 questions related to the main topic)',
  },
  es: {
    noPrompts: 'Sin prompts',
    noPromptsDesc: 'Cree su primer bloque de prompt para usarlo en Content Architect.',
    add: 'Nuevo prompt',
    rename: 'Renombrar',
    delete: 'Eliminar',
    duplicate: 'Duplicar',
    deleted: 'Prompt eliminado',
    duplicated: 'Prompt duplicado',
    created: 'Prompt creado',
    saved: 'Prompt guardado',
    defaultName: 'Nuevo prompt',
    placeholder: 'Escribe tu prompt aquí...',
  },
};

export function MyPromptBlocks() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const t = translations[language as keyof typeof translations] || translations.fr;

  const [blocks, setBlocks] = useState<PromptBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchBlocks = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('content_prompt_blocks')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });
    if (data) setBlocks(data as unknown as PromptBlock[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchBlocks(); }, [fetchBlocks]);

  const createBlock = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('content_prompt_blocks')
      .insert({ user_id: user.id, name: t.defaultName, content: '', block_type: 'custom' })
      .select()
      .single();
    if (!error && data) {
      const block = data as unknown as PromptBlock;
      setBlocks(prev => [block, ...prev]);
      setSelectedId(block.id);
      setEditContent(block.content);
      toast.success(t.created);
    }
  };

  const deleteBlock = async (id: string) => {
    setBlocks(prev => prev.filter(b => b.id !== id));
    if (selectedId === id) { setSelectedId(null); setEditContent(''); }
    const { error } = await supabase.from('content_prompt_blocks').delete().eq('id', id);
    if (error) fetchBlocks(); else toast.success(t.deleted);
  };

  const duplicateBlock = async (block: PromptBlock) => {
    if (!user) return;
    const { data, error } = await supabase
      .from('content_prompt_blocks')
      .insert({ user_id: user.id, name: block.name + ' (copie)', content: block.content, block_type: block.block_type })
      .select()
      .single();
    if (!error && data) {
      setBlocks(prev => [data as unknown as PromptBlock, ...prev]);
      toast.success(t.duplicated);
    }
  };

  const saveName = async (id: string) => {
    if (!editingName.trim()) { setEditingNameId(null); return; }
    await supabase.from('content_prompt_blocks').update({ name: editingName.trim() }).eq('id', id);
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, name: editingName.trim() } : b));
    setEditingNameId(null);
  };

  const saveContent = async () => {
    if (!selectedId) return;
    setSaving(true);
    await supabase.from('content_prompt_blocks').update({ content: editContent }).eq('id', selectedId);
    setBlocks(prev => prev.map(b => b.id === selectedId ? { ...b, content: editContent } : b));
    setSaving(false);
    toast.success(t.saved);
  };

  const selected = blocks.find(b => b.id === selectedId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex gap-4 min-h-[350px]">
      {/* Left: list */}
      <div className="w-64 shrink-0 border-r pr-3 space-y-1 max-h-[70vh] overflow-y-auto">
        <button
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground border border-border rounded bg-transparent hover:text-foreground hover:border-foreground/40 transition-colors mb-3"
          onClick={createBlock}
        >
          <Plus className="h-3 w-3" />
          {t.add}
        </button>

        {blocks.length === 0 && (
          <div className="text-center py-8">
            <FileText className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">{t.noPrompts}</p>
            <p className="text-xs text-muted-foreground mt-1">{t.noPromptsDesc}</p>
          </div>
        )}

        {blocks.map(block => (
          <div
            key={block.id}
            className={cn(
              'group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors',
              selectedId === block.id ? 'bg-muted font-medium' : 'hover:bg-muted/50'
            )}
            onClick={() => { setSelectedId(block.id); setEditContent(block.content); }}
          >
            {editingNameId === block.id ? (
              <div className="flex items-center gap-1 flex-1 min-w-0" onClick={e => e.stopPropagation()}>
                <Input
                  value={editingName}
                  onChange={e => setEditingName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveName(block.id); if (e.key === 'Escape') setEditingNameId(null); }}
                  className="h-6 text-xs px-1"
                  autoFocus
                />
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => saveName(block.id)}>
                  <Check className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setEditingNameId(null)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <>
                <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate flex-1">{block.name}</span>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={e => { e.stopPropagation(); setEditingNameId(block.id); setEditingName(block.name); }}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={e => { e.stopPropagation(); duplicateBlock(block); }}>
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-5 w-5 hover:text-destructive" onClick={e => { e.stopPropagation(); deleteBlock(block.id); }}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Right: editor */}
      <div className="flex-1 min-w-0 flex flex-col">
        {selected ? (
          <>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold truncate">{selected.name}</h3>
              <Button size="sm" onClick={saveContent} disabled={saving} className="gap-1.5">
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                {t.saved.split(' ')[0]}
              </Button>
            </div>
            <textarea
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              placeholder={t.placeholder}
              className="flex-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none min-h-[200px]"
            />
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            {blocks.length > 0 ? 'Sélectionnez un prompt' : ''}
          </div>
        )}
      </div>
    </div>
  );
}
