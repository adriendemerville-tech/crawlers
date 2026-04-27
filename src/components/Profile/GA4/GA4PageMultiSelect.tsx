import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Check, ChevronsUpDown, X, Save, Trash2, Folder } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { GA4PageRow, GA4PageGroup } from './types';

interface Props {
  trackedSiteId: string;
  userId: string;
  pages: GA4PageRow[];
  selected: string[];
  onChange: (paths: string[]) => void;
  groups: GA4PageGroup[];
  onGroupsChange: (groups: GA4PageGroup[]) => void;
}

export function GA4PageMultiSelect({ trackedSiteId, userId, pages, selected, onChange, groups, onGroupsChange }: Props) {
  const [open, setOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [savingGroup, setSavingGroup] = useState(false);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const toggle = (path: string) => {
    if (selectedSet.has(path)) onChange(selected.filter((p) => p !== path));
    else onChange([...selected, path]);
  };

  const clearAll = () => onChange([]);

  const applyGroup = (g: GA4PageGroup) => {
    onChange(g.page_paths);
    setOpen(false);
  };

  const saveCurrentAsGroup = async () => {
    if (!groupName.trim() || selected.length === 0) {
      toast.error('Saisis un nom et sélectionne au moins une page');
      return;
    }
    setSavingGroup(true);
    const { data, error } = await supabase
      .from('ga4_page_groups')
      .insert({
        user_id: userId,
        tracked_site_id: trackedSiteId,
        name: groupName.trim(),
        page_paths: selected,
      })
      .select()
      .single();
    setSavingGroup(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Groupe sauvegardé');
    onGroupsChange([...groups, data as GA4PageGroup]);
    setGroupName('');
  };

  const deleteGroup = async (id: string) => {
    const { error } = await supabase.from('ga4_page_groups').delete().eq('id', id);
    if (error) {
      toast.error(error.message);
      return;
    }
    onGroupsChange(groups.filter((g) => g.id !== id));
    toast.success('Groupe supprimé');
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 justify-between text-xs" role="combobox">
            <span className="truncate">
              {selected.length === 0
                ? 'Toutes les pages (agrégé site)'
                : `${selected.length} page${selected.length > 1 ? 's' : ''} sélectionnée${selected.length > 1 ? 's' : ''}`}
            </span>
            <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[420px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Rechercher une page..." className="h-9 text-xs" />
            <CommandList className="max-h-[320px]">
              <CommandEmpty>Aucune page trouvée.</CommandEmpty>

              {groups.length > 0 && (
                <>
                  <CommandGroup heading="Groupes sauvegardés">
                    {groups.map((g) => (
                      <CommandItem key={g.id} className="text-xs" onSelect={() => applyGroup(g)}>
                        <Folder className="mr-2 h-3 w-3" />
                        <span className="flex-1">{g.name}</span>
                        <Badge variant="outline" className="mr-2 text-[10px]">
                          {g.page_paths.length}
                        </Badge>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteGroup(g.id);
                          }}
                          className="opacity-50 hover:opacity-100"
                          aria-label="Supprimer le groupe"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  <CommandSeparator />
                </>
              )}

              <CommandGroup heading="Pages">
                {pages.map((p) => (
                  <CommandItem key={p.path} className="text-xs" onSelect={() => toggle(p.path)}>
                    <Check className={cn('mr-2 h-3 w-3', selectedSet.has(p.path) ? 'opacity-100' : 'opacity-0')} />
                    <span className="flex-1 truncate" title={p.path}>
                      {p.path}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {p.pageviews.toLocaleString('fr-FR')}
                    </Badge>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>

            {selected.length > 0 && (
              <div className="border-t border-border p-2">
                <div className="mb-2 flex items-center gap-1.5">
                  <Input
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="Nom du groupe"
                    className="h-7 text-xs"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={saveCurrentAsGroup}
                    disabled={savingGroup || !groupName.trim()}
                  >
                    <Save className="mr-1 h-3 w-3" />
                    Enregistrer
                  </Button>
                </div>
                <Button variant="outline" size="sm" className="h-7 w-full text-xs" onClick={clearAll}>
                  <X className="mr-1 h-3 w-3" />
                  Tout désélectionner
                </Button>
              </div>
            )}
          </Command>
        </PopoverContent>
      </Popover>

      {selected.length > 0 && selected.length <= 5 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((p) => (
            <Badge key={p} variant="outline" className="gap-1 text-[10px]">
              <span className="max-w-[180px] truncate">{p}</span>
              <button onClick={() => toggle(p)} className="opacity-60 hover:opacity-100" aria-label="Retirer">
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
