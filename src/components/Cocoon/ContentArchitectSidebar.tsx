import { useState, useEffect, useCallback } from 'react';
import { Plus, Globe, Trash2, Check, ChevronRight, FileText, ShoppingBag, Newspaper } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAdmin } from '@/hooks/useAdmin';
import { toast } from 'sonner';

interface TrackedSite {
  id: string;
  domain: string;
}

interface PromptPreset {
  id: string;
  name: string;
  prompt_text: string;
  is_default: boolean;
  display_order: number;
  page_type: string;
  tracked_site_id: string;
}

const PAGE_TYPE_TABS = [
  { value: 'landing' as const, label: 'Landing Page', icon: FileText },
  { value: 'product' as const, label: 'Produit', icon: ShoppingBag },
  { value: 'article' as const, label: 'Article Blog', icon: Newspaper },
];

interface ContentArchitectSidebarProps {
  onSelectPreset: (preset: PromptPreset, site: TrackedSite) => void;
  selectedSiteId?: string;
  selectedPageType?: string;
}

export function ContentArchitectSidebar({ onSelectPreset, selectedSiteId, selectedPageType }: ContentArchitectSidebarProps) {
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const [sites, setSites] = useState<TrackedSite[]>([]);
  const [activeSiteId, setActiveSiteId] = useState<string | null>(selectedSiteId || null);
  const [activePageType, setActivePageType] = useState<'landing' | 'product' | 'article'>((selectedPageType as any) || 'landing');
  const [presets, setPresets] = useState<PromptPreset[]>([]);
  const [loadingPresets, setLoadingPresets] = useState(false);
  const [showNewPreset, setShowNewPreset] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  // Fetch tracked sites
  useEffect(() => {
    if (!user) return;
    supabase
      .from('tracked_sites')
      .select('id, domain')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (data) {
          let allSites = [...data];
          // For creator (non-admin) accounts, ensure iktracker.fr is always visible
          if (!isAdmin && !allSites.some(s => s.domain.includes('iktracker'))) {
            allSites.unshift({ id: 'iktracker-pinned', domain: 'iktracker.fr' });
          }
          setSites(allSites);
          if (!activeSiteId && allSites.length > 0) setActiveSiteId(allSites[0].id);
        }
      });
  }, [user, isAdmin]);

  // Fetch presets for active site + page type
  useEffect(() => {
    if (!user || !activeSiteId) return;
    setLoadingPresets(true);
    supabase
      .from('content_prompt_presets')
      .select('*')
      .eq('user_id', user.id)
      .eq('tracked_site_id', activeSiteId)
      .eq('page_type', activePageType)
      .order('display_order', { ascending: true })
      .then(({ data }) => {
        setPresets((data as PromptPreset[]) || []);
        setLoadingPresets(false);
        setSelectedPresetId(null);
        setEditingPresetId(null);
      });
  }, [user, activeSiteId, activePageType]);

  const handleCreatePreset = useCallback(async () => {
    if (!newPresetName.trim() || !user || !activeSiteId) return;
    const { data, error } = await supabase
      .from('content_prompt_presets')
      .insert({
        user_id: user.id,
        tracked_site_id: activeSiteId,
        page_type: activePageType,
        name: newPresetName.trim(),
        prompt_text: '',
        display_order: presets.length,
        is_default: presets.length === 0,
      })
      .select()
      .single();
    if (error) {
      toast.error('Erreur création preset');
      return;
    }
    setPresets(prev => [...prev, data as PromptPreset]);
    setNewPresetName('');
    setShowNewPreset(false);
    setEditingPresetId((data as PromptPreset).id);
    setEditingText('');
    toast.success('Prompt créé');
  }, [newPresetName, user, activeSiteId, activePageType, presets.length]);

  const handleSaveEdit = useCallback(async (presetId: string) => {
    const { error } = await supabase
      .from('content_prompt_presets')
      .update({ prompt_text: editingText })
      .eq('id', presetId);
    if (error) {
      toast.error('Erreur sauvegarde');
      return;
    }
    setPresets(prev => prev.map(p => p.id === presetId ? { ...p, prompt_text: editingText } : p));
    setEditingPresetId(null);
    toast.success('Prompt sauvegardé');
  }, [editingText]);

  const handleDeletePreset = useCallback(async (presetId: string) => {
    await supabase.from('content_prompt_presets').delete().eq('id', presetId);
    setPresets(prev => prev.filter(p => p.id !== presetId));
    if (selectedPresetId === presetId) setSelectedPresetId(null);
    toast.success('Prompt supprimé');
  }, [selectedPresetId]);

  const handleSetDefault = useCallback(async (presetId: string) => {
    if (!user || !activeSiteId) return;
    // Unset all defaults for this site+type
    await supabase
      .from('content_prompt_presets')
      .update({ is_default: false })
      .eq('user_id', user.id)
      .eq('tracked_site_id', activeSiteId)
      .eq('page_type', activePageType);
    // Set new default
    await supabase
      .from('content_prompt_presets')
      .update({ is_default: true })
      .eq('id', presetId);
    setPresets(prev => prev.map(p => ({ ...p, is_default: p.id === presetId })));
  }, [user, activeSiteId, activePageType]);

  const activeSite = sites.find(s => s.id === activeSiteId);

  return (
    <div className="w-full shrink-0 flex flex-col h-full bg-[#1e293b]">
      {/* Domain selector */}
      <div className="border-b border-slate-700/60 px-2 py-2">
        <p className="text-[10px] text-slate-500 uppercase tracking-wider px-1 pb-1.5">Domaine cible</p>
        {sites.length === 0 ? (
          <p className="text-[10px] text-slate-600 px-1 py-1">Aucun site tracké</p>
        ) : (
          <Select value={activeSiteId || ''} onValueChange={id => setActiveSiteId(id)}>
            <SelectTrigger className="bg-slate-700/50 border-slate-600 text-slate-200 text-xs h-8">
              <Globe className="w-3 h-3 shrink-0 text-teal-400 mr-1.5" />
              <SelectValue placeholder="Sélectionner un domaine" />
            </SelectTrigger>
            <SelectContent>
              {sites.map(site => (
                <SelectItem key={site.id} value={site.id} className="text-xs">
                  {site.domain}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Page type tabs */}
      {activeSiteId && (
        <div className="border-b border-slate-700/60 px-2 py-1.5 flex gap-0.5">
          {PAGE_TYPE_TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.value}
                onClick={() => setActivePageType(tab.value)}
                className={`flex-1 text-[9px] py-1.5 rounded flex flex-col items-center gap-0.5 transition-colors ${
                  activePageType === tab.value
                    ? 'bg-teal-500/15 text-teal-400'
                    : 'text-slate-500 hover:bg-slate-700/30 hover:text-slate-400'
                }`}
              >
                <Icon className="w-3 h-3" />
                <span className="leading-tight text-center">{tab.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Presets list */}
      {activeSiteId && (
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-3 py-1.5">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Prompts</p>
            <button
              onClick={() => setShowNewPreset(true)}
              className="p-0.5 rounded hover:bg-slate-700/40 text-slate-500 hover:text-teal-400 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* New preset input */}
          {showNewPreset && (
            <div className="px-2 pb-2 flex gap-1">
              <Input
                value={newPresetName}
                onChange={e => setNewPresetName(e.target.value)}
                placeholder="Nom du prompt"
                className="bg-slate-700/50 border-slate-600 text-white text-[10px] h-6 px-2"
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCreatePreset();
                  if (e.key === 'Escape') { setShowNewPreset(false); setNewPresetName(''); }
                }}
              />
              <Button size="sm" onClick={handleCreatePreset} className="h-6 px-2 text-[10px] bg-teal-500 hover:bg-teal-600 text-white">
                OK
              </Button>
            </div>
          )}

          {/* Preset selector (when 2+) */}
          {presets.length >= 2 && (
            <div className="px-2 pb-1">
              <Select
                value={selectedPresetId || ''}
                onValueChange={id => {
                  setSelectedPresetId(id);
                  const preset = presets.find(p => p.id === id);
                  if (preset && activeSite) onSelectPreset(preset, activeSite);
                }}
              >
                <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white text-[10px] h-7">
                  <SelectValue placeholder="Sélectionner un prompt" />
                </SelectTrigger>
                <SelectContent>
                  {presets.map(p => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">
                      {p.name} {p.is_default ? '★' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <ScrollArea className="flex-1">
            <div className="px-2 pb-2 space-y-1">
              {presets.map(preset => (
                <div
                  key={preset.id}
                  className={`rounded border transition-colors ${
                    selectedPresetId === preset.id
                      ? 'border-teal-500/30 bg-teal-500/5'
                      : 'border-slate-700/40 bg-slate-800/30 hover:border-slate-600/60'
                  }`}
                >
                  <div className="flex items-center gap-1 px-2 py-1">
                    <button
                      onClick={() => {
                        setSelectedPresetId(preset.id);
                        if (activeSite) onSelectPreset(preset, activeSite);
                      }}
                      className="flex-1 text-left text-[10px] text-slate-300 truncate"
                    >
                      {preset.name}
                    </button>
                    {preset.is_default && (
                      <Badge className="text-[8px] px-1 py-0 bg-teal-500/20 text-teal-400 border-0">défaut</Badge>
                    )}
                    {!preset.is_default && (
                      <button onClick={() => handleSetDefault(preset.id)} className="text-slate-600 hover:text-teal-400 transition-colors" title="Définir par défaut">
                        <Check className="w-2.5 h-2.5" />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setEditingPresetId(editingPresetId === preset.id ? null : preset.id);
                        setEditingText(preset.prompt_text);
                      }}
                      className="text-slate-600 hover:text-slate-400 transition-colors"
                      title="Éditer"
                    >
                      <ChevronRight className={`w-2.5 h-2.5 transition-transform ${editingPresetId === preset.id ? 'rotate-90' : ''}`} />
                    </button>
                    <button onClick={() => handleDeletePreset(preset.id)} className="text-slate-600 hover:text-red-400 transition-colors" title="Supprimer">
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  </div>

                  {/* Inline editor */}
                  {editingPresetId === preset.id && (
                    <div className="px-2 pb-2 space-y-1">
                      <textarea
                        value={editingText}
                        onChange={e => setEditingText(e.target.value)}
                        rows={4}
                        className="w-full bg-slate-700/50 border border-slate-600 rounded text-[10px] text-slate-300 p-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-teal-500/40"
                        placeholder="Instructions spécifiques pour ce prompt..."
                      />
                      <Button
                        size="sm"
                        onClick={() => handleSaveEdit(preset.id)}
                        className="w-full h-5 text-[9px] bg-teal-500 hover:bg-teal-600 text-white"
                      >
                        Sauvegarder
                      </Button>
                    </div>
                  )}
                </div>
              ))}

              {presets.length === 0 && !showNewPreset && (
                <p className="text-[10px] text-slate-600 px-1 py-3 text-center">
                  Aucun prompt.<br />Cliquez + pour en créer un.
                </p>
              )}

              {/* Single preset: click to apply */}
              {presets.length === 1 && (
                <div className="sticky bottom-0 pt-2 pb-1 bg-[#1e293b]/90 backdrop-blur-sm border-t border-slate-700/40">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setSelectedPresetId(presets[0].id);
                      if (activeSite) onSelectPreset(presets[0], activeSite);
                    }}
                    className="w-full h-7 text-[10px] text-teal-400 hover:text-teal-400 hover:bg-teal-500/10 font-semibold"
                  >
                    Appliquer
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
