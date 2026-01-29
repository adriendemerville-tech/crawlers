import { useState, useEffect } from 'react';
import { FolderPlus, FileText, Trash2, FolderOpen, ChevronRight, MoreVertical, Loader2, Download } from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { SortableReportItem } from './SortableReportItem';
import { SortableFolderItem } from './SortableFolderItem';

interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
  position: number;
}

interface Report {
  id: string;
  title: string;
  url: string;
  report_type: string;
  folder_id: string | null;
  position: number;
  created_at: string;
  pdf_url: string | null;
}

const translations = {
  fr: {
    title: 'Mes Rapports',
    description: 'Gérez et organisez vos rapports sauvegardés',
    createFolder: 'Créer un dossier',
    newFolder: 'Nouveau dossier',
    folderName: 'Nom du dossier',
    create: 'Créer',
    cancel: 'Annuler',
    delete: 'Supprimer',
    rename: 'Renommer',
    download: 'Télécharger',
    noReports: 'Aucun rapport sauvegardé',
    noReportsDesc: 'Lancez une analyse et sauvegardez le rapport pour le retrouver ici',
    rootFolder: 'Racine',
    deleteConfirm: 'Êtes-vous sûr de vouloir supprimer ce rapport ?',
    deleteFolderConfirm: 'Êtes-vous sûr de vouloir supprimer ce dossier et son contenu ?',
    reportTypes: {
      seo_technical: 'Audit SEO Technique',
      seo_strategic: 'Audit Stratégique IA',
      llm: 'Analyse LLM',
      geo: 'Analyse GEO',
      pagespeed: 'PageSpeed',
      crawlers: 'Crawlers',
    },
  },
  en: {
    title: 'My Reports',
    description: 'Manage and organize your saved reports',
    createFolder: 'Create folder',
    newFolder: 'New folder',
    folderName: 'Folder name',
    create: 'Create',
    cancel: 'Cancel',
    delete: 'Delete',
    rename: 'Rename',
    download: 'Download',
    noReports: 'No saved reports',
    noReportsDesc: 'Run an analysis and save the report to find it here',
    rootFolder: 'Root',
    deleteConfirm: 'Are you sure you want to delete this report?',
    deleteFolderConfirm: 'Are you sure you want to delete this folder and its contents?',
    reportTypes: {
      seo_technical: 'Technical SEO Audit',
      seo_strategic: 'Strategic AI Audit',
      llm: 'LLM Analysis',
      geo: 'GEO Analysis',
      pagespeed: 'PageSpeed',
      crawlers: 'Crawlers',
    },
  },
  es: {
    title: 'Mis Informes',
    description: 'Administra y organiza tus informes guardados',
    createFolder: 'Crear carpeta',
    newFolder: 'Nueva carpeta',
    folderName: 'Nombre de la carpeta',
    create: 'Crear',
    cancel: 'Cancelar',
    delete: 'Eliminar',
    rename: 'Renombrar',
    download: 'Descargar',
    noReports: 'No hay informes guardados',
    noReportsDesc: 'Ejecuta un análisis y guarda el informe para encontrarlo aquí',
    rootFolder: 'Raíz',
    deleteConfirm: '¿Estás seguro de que quieres eliminar este informe?',
    deleteFolderConfirm: '¿Estás seguro de que quieres eliminar esta carpeta y su contenido?',
    reportTypes: {
      seo_technical: 'Auditoría SEO Técnica',
      seo_strategic: 'Auditoría Estratégica IA',
      llm: 'Análisis LLM',
      geo: 'Análisis GEO',
      pagespeed: 'PageSpeed',
      crawlers: 'Crawlers',
    },
  },
};

export function MyReports() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const t = translations[language];

  const [folders, setFolders] = useState<Folder[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<'folder' | 'report' | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, currentFolderId]);

  const fetchData = async () => {
    if (!user) return;

    setLoading(true);

    // Build folders query - handle null parent_id correctly
    let foldersQuery = supabase
      .from('report_folders')
      .select('*')
      .eq('user_id', user.id);
    
    if (currentFolderId === null) {
      foldersQuery = foldersQuery.is('parent_id', null);
    } else {
      foldersQuery = foldersQuery.eq('parent_id', currentFolderId);
    }
    
    const { data: foldersData } = await foldersQuery.order('position');

    // Build reports query - handle null folder_id correctly
    let reportsQuery = supabase
      .from('saved_reports')
      .select('*')
      .eq('user_id', user.id);
    
    if (currentFolderId === null) {
      reportsQuery = reportsQuery.is('folder_id', null);
    } else {
      reportsQuery = reportsQuery.eq('folder_id', currentFolderId);
    }
    
    const { data: reportsData } = await reportsQuery.order('position');

    setFolders((foldersData as Folder[]) || []);
    setReports((reportsData as Report[]) || []);
    setLoading(false);
  };

  const buildFolderPath = async (folderId: string | null) => {
    if (!folderId) {
      setFolderPath([]);
      return;
    }

    const path: Folder[] = [];
    let currentId: string | null = folderId;

    while (currentId) {
      const { data } = await supabase
        .from('report_folders')
        .select('*')
        .eq('id', currentId)
        .single();

      if (data) {
        path.unshift(data as Folder);
        currentId = data.parent_id;
      } else {
        break;
      }
    }

    setFolderPath(path);
  };

  useEffect(() => {
    buildFolderPath(currentFolderId);
  }, [currentFolderId]);

  const handleCreateFolder = async () => {
    if (!user || !newFolderName.trim()) return;

    const { error } = await supabase.from('report_folders').insert({
      user_id: user.id,
      name: newFolderName.trim(),
      parent_id: currentFolderId,
      position: folders.length,
    });

    if (error) {
      toast.error('Erreur lors de la création du dossier');
    } else {
      toast.success('Dossier créé');
      setNewFolderName('');
      setShowNewFolderDialog(false);
      fetchData();
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    const { error } = await supabase
      .from('report_folders')
      .delete()
      .eq('id', folderId);

    if (error) {
      toast.error('Erreur lors de la suppression');
    } else {
      toast.success('Dossier supprimé');
      fetchData();
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    const { error } = await supabase
      .from('saved_reports')
      .delete()
      .eq('id', reportId);

    if (error) {
      toast.error('Erreur lors de la suppression');
    } else {
      toast.success('Rapport supprimé');
      fetchData();
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const id = active.id as string;
    
    if (id.startsWith('folder-')) {
      setActiveId(id.replace('folder-', ''));
      setActiveType('folder');
    } else if (id.startsWith('report-')) {
      setActiveId(id.replace('report-', ''));
      setActiveType('report');
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) {
      setActiveId(null);
      setActiveType(null);
      return;
    }

    const activeIdStr = active.id as string;
    const overIdStr = over.id as string;

    // Check if dropping on a folder
    if (overIdStr.startsWith('folder-') && activeIdStr.startsWith('report-')) {
      const reportId = activeIdStr.replace('report-', '');
      const targetFolderId = overIdStr.replace('folder-', '');

      await supabase
        .from('saved_reports')
        .update({ folder_id: targetFolderId })
        .eq('id', reportId);

      fetchData();
    }
    // Reordering within same type
    else if (activeIdStr !== overIdStr) {
      if (activeIdStr.startsWith('folder-') && overIdStr.startsWith('folder-')) {
        const oldIndex = folders.findIndex(f => `folder-${f.id}` === activeIdStr);
        const newIndex = folders.findIndex(f => `folder-${f.id}` === overIdStr);

        const newFolders = arrayMove(folders, oldIndex, newIndex);
        setFolders(newFolders);

        // Update positions in database
        for (let i = 0; i < newFolders.length; i++) {
          await supabase
            .from('report_folders')
            .update({ position: i })
            .eq('id', newFolders[i].id);
        }
      } else if (activeIdStr.startsWith('report-') && overIdStr.startsWith('report-')) {
        const oldIndex = reports.findIndex(r => `report-${r.id}` === activeIdStr);
        const newIndex = reports.findIndex(r => `report-${r.id}` === overIdStr);

        const newReports = arrayMove(reports, oldIndex, newIndex);
        setReports(newReports);

        // Update positions in database
        for (let i = 0; i < newReports.length; i++) {
          await supabase
            .from('saved_reports')
            .update({ position: i })
            .eq('id', newReports[i].id);
        }
      }
    }

    setActiveId(null);
    setActiveType(null);
  };

  const navigateToFolder = (folderId: string | null) => {
    setCurrentFolderId(folderId);
  };

  const activeFolder = activeType === 'folder' ? folders.find(f => f.id === activeId) : null;
  const activeReport = activeType === 'report' ? reports.find(r => r.id === activeId) : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{t.title}</CardTitle>
            <CardDescription>{t.description}</CardDescription>
          </div>
          <Button onClick={() => setShowNewFolderDialog(true)} size="sm" className="gap-2">
            <FolderPlus className="h-4 w-4" />
            {t.createFolder}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Breadcrumb navigation */}
        <div className="flex items-center gap-1 mb-4 text-sm">
          <button
            onClick={() => navigateToFolder(null)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {t.rootFolder}
          </button>
          {folderPath.map((folder, index) => (
            <div key={folder.id} className="flex items-center gap-1">
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <button
                onClick={() => navigateToFolder(folder.id)}
                className={index === folderPath.length - 1 ? 'font-medium' : 'text-muted-foreground hover:text-foreground transition-colors'}
              >
                {folder.name}
              </button>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : folders.length === 0 && reports.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="font-medium">{t.noReports}</p>
            <p className="text-sm text-muted-foreground">{t.noReportsDesc}</p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="space-y-2">
              {/* Folders */}
              <SortableContext
                items={folders.map(f => `folder-${f.id}`)}
                strategy={verticalListSortingStrategy}
              >
                {folders.map((folder) => (
                  <SortableFolderItem
                    key={folder.id}
                    folder={folder}
                    onOpen={() => navigateToFolder(folder.id)}
                    onDelete={() => handleDeleteFolder(folder.id)}
                    translations={t}
                  />
                ))}
              </SortableContext>

              {/* Reports */}
              <SortableContext
                items={reports.map(r => `report-${r.id}`)}
                strategy={verticalListSortingStrategy}
              >
                {reports.map((report) => (
                  <SortableReportItem
                    key={report.id}
                    report={report}
                    onDelete={() => handleDeleteReport(report.id)}
                    translations={t}
                  />
                ))}
              </SortableContext>
            </div>

            <DragOverlay>
              {activeFolder && (
                <div className="flex items-center gap-3 p-3 rounded-lg border bg-card shadow-lg">
                  <FolderOpen className="h-5 w-5 text-primary" />
                  <span className="font-medium">{activeFolder.name}</span>
                </div>
              )}
              {activeReport && (
                <div className="flex items-center gap-3 p-3 rounded-lg border bg-card shadow-lg">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">{activeReport.title}</span>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}
      </CardContent>

      {/* New Folder Dialog */}
      <Dialog open={showNewFolderDialog} onOpenChange={setShowNewFolderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.newFolder}</DialogTitle>
            <DialogDescription>
              {language === 'fr' ? 'Créez un nouveau dossier pour organiser vos rapports' :
               language === 'es' ? 'Crea una nueva carpeta para organizar tus informes' :
               'Create a new folder to organize your reports'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder={t.folderName}
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewFolderDialog(false)}>
              {t.cancel}
            </Button>
            <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
              {t.create}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
