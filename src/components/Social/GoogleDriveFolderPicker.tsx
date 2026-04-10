/**
 * Google Drive Folder Picker — Navigable tree modal.
 * Displays folder hierarchy with breadcrumb navigation, folder creation,
 * and selection confirmation.
 */
import { useState, useCallback, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Folder, FolderOpen, ChevronRight, HardDrive, Plus, Loader2, ArrowLeft, Home, Check
} from 'lucide-react';
import { toast } from 'sonner';

interface DriveFolder {
  id: string;
  name: string;
  hasChildren: boolean;
}

interface BreadcrumbItem {
  id: string;
  name: string;
}

interface GoogleDriveFolderPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (folderId: string, folderPath: string) => void;
  currentFolderPath?: string;
}

// Simulated folder tree for UI — will be replaced by real Drive API calls
const MOCK_FOLDERS: Record<string, DriveFolder[]> = {
  root: [
    { id: 'f1', name: 'Crawlers', hasChildren: true },
    { id: 'f2', name: 'Marketing', hasChildren: true },
    { id: 'f3', name: 'Projets clients', hasChildren: true },
    { id: 'f4', name: 'Archives', hasChildren: false },
    { id: 'f5', name: 'Templates', hasChildren: false },
  ],
  f1: [
    { id: 'f1a', name: 'Social Hub', hasChildren: true },
    { id: 'f1b', name: 'Audits', hasChildren: false },
    { id: 'f1c', name: 'Rapports SEO', hasChildren: false },
  ],
  f1a: [
    { id: 'f1a1', name: 'Exports', hasChildren: false },
    { id: 'f1a2', name: 'Images générées', hasChildren: false },
    { id: 'f1a3', name: 'Planification', hasChildren: false },
  ],
  f2: [
    { id: 'f2a', name: 'Campagnes 2026', hasChildren: true },
    { id: 'f2b', name: 'Visuels', hasChildren: false },
  ],
  f2a: [
    { id: 'f2a1', name: 'Q1', hasChildren: false },
    { id: 'f2a2', name: 'Q2', hasChildren: false },
  ],
  f3: [
    { id: 'f3a', name: 'Client Alpha', hasChildren: false },
    { id: 'f3b', name: 'Client Beta', hasChildren: false },
  ],
};

export function GoogleDriveFolderPicker({
  open,
  onOpenChange,
  onSelect,
  currentFolderPath,
}: GoogleDriveFolderPickerProps) {
  const [currentFolderId, setCurrentFolderId] = useState('root');
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([{ id: 'root', name: 'Mon Drive' }]);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const loadFolders = useCallback(async (folderId: string) => {
    setLoading(true);
    // Simulate API delay
    await new Promise((r) => setTimeout(r, 350));
    const data = MOCK_FOLDERS[folderId] || [];
    setFolders(data);
    setSelectedId(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) {
      setCurrentFolderId('root');
      setBreadcrumb([{ id: 'root', name: 'Mon Drive' }]);
      loadFolders('root');
    }
  }, [open, loadFolders]);

  const navigateToFolder = (folder: DriveFolder) => {
    setCurrentFolderId(folder.id);
    setBreadcrumb((prev) => [...prev, { id: folder.id, name: folder.name }]);
    loadFolders(folder.id);
  };

  const navigateToBreadcrumb = (index: number) => {
    const target = breadcrumb[index];
    setCurrentFolderId(target.id);
    setBreadcrumb((prev) => prev.slice(0, index + 1));
    loadFolders(target.id);
  };

  const goBack = () => {
    if (breadcrumb.length > 1) {
      navigateToBreadcrumb(breadcrumb.length - 2);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);
    await new Promise((r) => setTimeout(r, 400));
    const newFolder: DriveFolder = {
      id: `new-${Date.now()}`,
      name: newFolderName.trim(),
      hasChildren: false,
    };
    setFolders((prev) => [...prev, newFolder]);
    setSelectedId(newFolder.id);
    setNewFolderName('');
    setCreatingFolder(false);
    toast.success(`Dossier "${newFolder.name}" créé`);
  };

  const handleConfirm = () => {
    if (!selectedId) {
      // Use current folder
      const path = breadcrumb.map((b) => b.name).join('/');
      onSelect(currentFolderId, '/' + path.replace('Mon Drive/', ''));
    } else {
      const selected = folders.find((f) => f.id === selectedId);
      const path = [...breadcrumb.map((b) => b.name), selected?.name || ''].join('/');
      onSelect(selectedId, '/' + path.replace('Mon Drive/', ''));
    }
    onOpenChange(false);
  };

  const currentPath = breadcrumb.map((b) => b.name).join(' / ');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-primary" />
            Sélectionner un dossier Google Drive
          </DialogTitle>
          <DialogDescription>
            Naviguez dans votre arborescence et sélectionnez le dossier de destination.
          </DialogDescription>
        </DialogHeader>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground overflow-x-auto pb-1">
          {breadcrumb.map((item, i) => (
            <span key={item.id} className="flex items-center gap-1 shrink-0">
              {i > 0 && <ChevronRight className="h-3 w-3" />}
              <button
                onClick={() => navigateToBreadcrumb(i)}
                className={`hover:text-foreground transition-colors ${i === breadcrumb.length - 1 ? 'text-foreground font-medium' : ''}`}
              >
                {i === 0 ? <Home className="h-3.5 w-3.5 inline" /> : null}
                {' '}{item.name}
              </button>
            </span>
          ))}
        </div>

        <Separator />

        {/* Folder list */}
        <ScrollArea className="h-[280px] pr-2">
          {loading ? (
            <div className="flex items-center justify-center h-full py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : folders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12 text-muted-foreground text-sm">
              <FolderOpen className="h-10 w-10 mb-2 opacity-40" />
              Aucun sous-dossier
            </div>
          ) : (
            <div className="space-y-1">
              {breadcrumb.length > 1 && (
                <button
                  onClick={goBack}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Retour</span>
                </button>
              )}
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => setSelectedId(folder.id === selectedId ? null : folder.id)}
                  onDoubleClick={() => folder.hasChildren && navigateToFolder(folder)}
                  className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-md text-sm transition-colors group ${
                    selectedId === folder.id
                      ? 'bg-primary/10 text-primary border border-primary/30'
                      : 'hover:bg-muted/50 text-foreground border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {selectedId === folder.id ? (
                      <FolderOpen className="h-4.5 w-4.5 text-primary" />
                    ) : (
                      <Folder className="h-4.5 w-4.5 text-muted-foreground group-hover:text-foreground" />
                    )}
                    <span className="truncate">{folder.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {selectedId === folder.id && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                    {folder.hasChildren && (
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-50" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        <Separator />

        {/* Create new folder */}
        <div className="flex items-center gap-2">
          <Input
            placeholder="Nouveau dossier…"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
            className="text-sm h-8"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={!newFolderName.trim() || creatingFolder}
            onClick={handleCreateFolder}
            className="shrink-0 gap-1 h-8 text-xs"
          >
            {creatingFolder ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            Créer
          </Button>
        </div>

        {/* Selected summary */}
        {selectedId && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <FolderOpen className="h-3.5 w-3.5" />
            <span>Destination : <span className="text-foreground font-medium">
              {currentPath} / {folders.find((f) => f.id === selectedId)?.name}
            </span></span>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-sm">
            Annuler
          </Button>
          <Button onClick={handleConfirm} className="gap-1.5 text-sm">
            <Check className="h-4 w-4" />
            {selectedId ? 'Sélectionner ce dossier' : 'Utiliser ce dossier'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
