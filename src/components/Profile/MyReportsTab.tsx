import { useState, useEffect, useCallback } from 'react';
import { FolderPlus, FileText, Trash2, FolderOpen, ChevronRight, Loader2, Download, ArrowLeft, Pencil, Archive, ChevronDown, Undo2, Folder, AlertTriangle, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TrackedSite {
  id: string;
  domain: string;
}

interface ReportFolder {
  id: string;
  name: string;
  parent_id: string | null;
  position: number;
  is_archived: boolean;
}

interface SavedReport {
  id: string;
  title: string;
  url: string;
  report_type: string;
  folder_id: string | null;
  position: number;
  created_at: string;
  pdf_url: string | null;
  is_archived: boolean;
}

const t = {
  fr: {
    noSites: 'Aucun site suivi.',
    createFolder: 'Créer un dossier',
    newFolder: 'Nouveau dossier',
    folderName: 'Nom du dossier',
    create: 'Créer',
    cancel: 'Annuler',
    delete: 'Supprimer',
    rename: 'Renommer',
    download: 'Télécharger',
    noReports: 'Aucun rapport pour ce site',
    archives: 'Archives',
    restore: 'Restaurer',
    deleteConfirmFolder: (count: number) => `Supprimer ce dossier ? Il contient ${count} rapport(s).`,
    deleteConfirmReport: 'Archiver ce rapport ?',
    save: 'Enregistrer',
    reportTypes: {
      seo_technical: 'Audit Technique SEO',
      seo_strategic: 'Audit Stratégique GEO',
      llm: 'Analyse LLM',
      geo: 'Analyse GEO',
      pagespeed: 'PageSpeed',
      crawlers: 'Crawlers',
      cocoon: 'Rapport Cocoon',
    } as Record<string, string>,
  },
  en: {
    noSites: 'No tracked sites.',
    createFolder: 'Create folder',
    newFolder: 'New folder',
    folderName: 'Folder name',
    create: 'Create',
    cancel: 'Cancel',
    delete: 'Delete',
    rename: 'Rename',
    download: 'Download',
    noReports: 'No reports for this site',
    archives: 'Archives',
    restore: 'Restore',
    deleteConfirmFolder: (count: number) => `Delete this folder? It contains ${count} report(s).`,
    deleteConfirmReport: 'Archive this report?',
    save: 'Save',
    reportTypes: {
      seo_technical: 'Technical SEO Audit',
      seo_strategic: 'Strategic GEO Audit',
      llm: 'LLM Analysis',
      geo: 'GEO Analysis',
      pagespeed: 'PageSpeed',
      crawlers: 'Crawlers',
      cocoon: 'Cocoon Report',
    } as Record<string, string>,
  },
  es: {
    noSites: 'No hay sitios seguidos.',
    createFolder: 'Crear carpeta',
    newFolder: 'Nueva carpeta',
    folderName: 'Nombre de la carpeta',
    create: 'Crear',
    cancel: 'Cancelar',
    delete: 'Eliminar',
    rename: 'Renombrar',
    download: 'Descargar',
    noReports: 'No hay informes para este sitio',
    archives: 'Archivos',
    restore: 'Restaurar',
    deleteConfirmFolder: (count: number) => `¿Eliminar esta carpeta? Contiene ${count} informe(s).`,
    deleteConfirmReport: '¿Archivar este informe?',
    save: 'Guardar',
    reportTypes: {
      seo_technical: 'Auditoría Técnica SEO',
      seo_strategic: 'Auditoría Estratégica GEO',
      llm: 'Análisis LLM',
      geo: 'Análisis GEO',
      pagespeed: 'PageSpeed',
      crawlers: 'Crawlers',
      cocoon: 'Informe Cocoon',
    } as Record<string, string>,
  },
};

export function MyReportsTab() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const tr = t[language];

  const [sites, setSites] = useState<TrackedSite[]>([]);
  const [orderedSites, setOrderedSites] = useState<TrackedSite[]>([]);
  const [draggedSiteIdx, setDraggedSiteIdx] = useState<number | null>(null);
  const [selectedSite, setSelectedSite] = useState<string>('__all__');
  const [folders, setFolders] = useState<ReportFolder[]>([]);
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [archivedFolders, setArchivedFolders] = useState<ReportFolder[]>([]);
  const [archivedReports, setArchivedReports] = useState<SavedReport[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<ReportFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renameTarget, setRenameTarget] = useState<{ type: 'folder' | 'report'; id: string; name: string } | null>(null);
  const [archivesOpen, setArchivesOpen] = useState(false);

  // Fetch tracked sites
  useEffect(() => {
    if (!user) return;
    supabase
      .from('tracked_sites')
      .select('id, domain')
      .eq('user_id', user.id)
      .order('position')
      .then(({ data }) => {
        setSites(data || []);
        setOrderedSites(data || []);
      });
  }, [user]);

  // Get domain for selected site
  const selectedDomain = selectedSite === '__all__' || selectedSite === '__other__'
    ? null
    : sites.find(s => s.id === selectedSite)?.domain || '';

  // Helper: extract domain from URL
  const getDomain = (url: string) => {
    try {
      const u = new URL(url.startsWith('http') ? url : `https://${url}`);
      return u.hostname.replace('www.', '');
    } catch { return ''; }
  };

  // Fetch folders & reports for selected site + current folder
  const fetchData = useCallback(async () => {
    if (!user) return;
    // Need at least a selection
    if (!selectedSite) return;
    setLoading(true);

    // Folders query
    let foldersQ = supabase
      .from('report_folders')
      .select('*')
      .eq('user_id', user.id);

    if (currentFolderId === null) {
      foldersQ = foldersQ.is('parent_id', null);
    } else {
      foldersQ = foldersQ.eq('parent_id', currentFolderId);
    }

    // Reports query — fetch ALL for this user, filter client-side
    let reportsQ = supabase
      .from('saved_reports')
      .select('*')
      .eq('user_id', user.id);

    if (currentFolderId === null) {
      reportsQ = reportsQ.is('folder_id', null);
    } else {
      reportsQ = reportsQ.eq('folder_id', currentFolderId);
    }

    const [fRes, rRes] = await Promise.all([
      foldersQ.order('position'),
      reportsQ.order('position'),
    ]);

    const allFolders = (fRes.data || []) as ReportFolder[];
    let allReports = (rRes.data || []) as SavedReport[];

    // Filter by site selection
    if (selectedSite === '__all__') {
      // Show all reports — no domain filter
    } else if (selectedSite === '__other__') {
      // Show reports not matching any tracked site domain
      const trackedDomains = sites.map(s => s.domain.replace('www.', ''));
      allReports = allReports.filter(r => {
        const rd = getDomain(r.url);
        return !trackedDomains.some(td => rd === td.replace('www.', ''));
      });
    } else if (selectedDomain) {
      allReports = allReports.filter(r => {
        const rd = getDomain(r.url);
        return rd === selectedDomain.replace('www.', '');
      });
    }

    setFolders(allFolders.filter(f => !f.is_archived));
    setReports(allReports.filter(r => !r.is_archived));
    setArchivedFolders(allFolders.filter(f => f.is_archived));
    setArchivedReports(allReports.filter(r => r.is_archived));
    setLoading(false);
  }, [user, selectedSite, selectedDomain, currentFolderId, sites]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Build folder path breadcrumb
  useEffect(() => {
    if (!currentFolderId) { setFolderPath([]); return; }
    const buildPath = async () => {
      const path: ReportFolder[] = [];
      let id: string | null = currentFolderId;
      while (id) {
        const { data } = await supabase.from('report_folders').select('*').eq('id', id).single();
        if (data) { path.unshift(data as ReportFolder); id = data.parent_id; } else break;
      }
      setFolderPath(path);
    };
    buildPath();
  }, [currentFolderId]);

  const handleCreateFolder = async () => {
    if (!user || !newFolderName.trim()) return;
    await supabase.from('report_folders').insert({
      user_id: user.id,
      name: newFolderName.trim(),
      parent_id: currentFolderId,
      position: folders.length,
    });
    setNewFolderName('');
    setShowNewFolderDialog(false);
    fetchData();
    toast.success(language === 'fr' ? 'Dossier créé' : 'Folder created');
  };

  const handleArchiveFolder = async (folderId: string) => {
    // Count reports inside
    const { count } = await supabase
      .from('saved_reports')
      .select('id', { count: 'exact', head: true })
      .eq('folder_id', folderId)
      .eq('user_id', user!.id);
    const c = count || 0;
    if (!window.confirm(tr.deleteConfirmFolder(c))) return;

    // Archive folder + its reports
    await supabase.from('report_folders').update({ is_archived: true }).eq('id', folderId);
    await supabase.from('saved_reports').update({ is_archived: true }).eq('folder_id', folderId);
    fetchData();
    toast.success(language === 'fr' ? 'Dossier archivé' : 'Folder archived');
  };

  const handleArchiveReport = async (reportId: string) => {
    await supabase.from('saved_reports').update({ is_archived: true }).eq('id', reportId);
    fetchData();
    toast.success(language === 'fr' ? 'Rapport archivé' : 'Report archived');
  };

  const handleRestore = async (type: 'folder' | 'report', id: string) => {
    if (type === 'folder') {
      await supabase.from('report_folders').update({ is_archived: false }).eq('id', id);
      // Restore reports inside
      await supabase.from('saved_reports').update({ is_archived: false }).eq('folder_id', id);
    } else {
      await supabase.from('saved_reports').update({ is_archived: false }).eq('id', id);
    }
    fetchData();
    toast.success(language === 'fr' ? 'Restauré' : 'Restored');
  };

  const handleRename = async () => {
    if (!renameTarget || !renameTarget.name.trim()) return;
    if (renameTarget.type === 'folder') {
      await supabase.from('report_folders').update({ name: renameTarget.name.trim() }).eq('id', renameTarget.id);
    } else {
      await supabase.from('saved_reports').update({ title: renameTarget.name.trim() }).eq('id', renameTarget.id);
    }
    setRenameTarget(null);
    fetchData();
  };

  const handleDownload = (report: SavedReport) => {
    if (report.pdf_url) {
      window.open(report.pdf_url, '_blank');
    } else {
      toast.error(language === 'fr' ? 'Pas de PDF disponible' : 'No PDF available');
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2 pt-3 px-4" />
      <CardContent>
        <div className="flex gap-4">
            {/* Site sidebar */}
            <div className="flex flex-col gap-1 shrink-0 w-36">
              {/* All reports */}
              <button
                onClick={() => { setSelectedSite('__all__'); setCurrentFolderId(null); }}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs font-medium transition-colors ${
                  selectedSite === '__all__'
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent'
                }`}
              >
                {language === 'fr' ? 'Tous' : language === 'es' ? 'Todos' : 'All'}
              </button>

              {/* Tracked sites — drag to reorder */}
              {orderedSites.map((site, idx) => (
                <button
                  key={site.id}
                  draggable
                  onDragStart={() => setDraggedSiteIdx(idx)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (draggedSiteIdx === null || draggedSiteIdx === idx) return;
                    const next = [...orderedSites];
                    const [dragged] = next.splice(draggedSiteIdx, 1);
                    next.splice(idx, 0, dragged);
                    setOrderedSites(next);
                    setDraggedSiteIdx(idx);
                  }}
                  onDragEnd={() => setDraggedSiteIdx(null)}
                  onClick={() => { setSelectedSite(site.id); setCurrentFolderId(null); }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-left text-xs font-medium transition-colors truncate group ${
                    selectedSite === site.id
                      ? 'bg-primary/10 text-primary border border-primary/20'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent'
                  }`}
                >
                  <GripVertical className="h-3 w-3 opacity-0 group-hover:opacity-40 transition-opacity shrink-0 cursor-grab" />
                  <span className="truncate">{site.domain.replace(/^www\./, '')}</span>
                </button>
              ))}

              {/* Other reports (unmatched domains) */}
              <button
                onClick={() => { setSelectedSite('__other__'); setCurrentFolderId(null); }}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs font-medium transition-colors ${
                  selectedSite === '__other__'
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent'
                }`}
              >
                {language === 'fr' ? 'Autres' : language === 'es' ? 'Otros' : 'Others'}
              </button>
            </div>

            {/* Main content */}
            <div className="flex-1 min-w-0">
              {/* Header: breadcrumb + create folder */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-sm">
                  {folderPath.length > 0 && (
                    <button
                      onClick={() => {
                        const parentId = folderPath.length > 1 ? folderPath[folderPath.length - 2].id : null;
                        setCurrentFolderId(parentId);
                      }}
                      className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                  )}
                  {folderPath.map((folder, i) => (
                    <div key={folder.id} className="flex items-center gap-1">
                      {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                      <button
                        onClick={() => setCurrentFolderId(folder.id)}
                        className={i === folderPath.length - 1 ? 'font-medium text-sm' : 'text-muted-foreground hover:text-foreground text-sm'}
                      >
                        {folder.name}
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setShowNewFolderDialog(true)}
                  className="p-2 rounded-lg text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/60 transition-colors"
                  title={tr.createFolder}
                >
                  <FolderPlus className="h-5 w-5" />
                </button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : folders.length === 0 && reports.length === 0 && archivedFolders.length === 0 && archivedReports.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-sm text-muted-foreground">{tr.noReports}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Folders grid */}
                  {folders.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {folders.map(folder => (
                        <ContextMenu key={folder.id}>
                          <ContextMenuTrigger asChild>
                            <button
                              onDoubleClick={() => setCurrentFolderId(folder.id)}
                              onClick={() => setCurrentFolderId(folder.id)}
                              className="flex flex-col items-center gap-1.5 w-20 p-2 rounded-lg hover:bg-muted/60 transition-colors cursor-pointer select-none group"
                              title={folder.name}
                            >
                              <Folder className="h-10 w-10 text-muted-foreground/70 group-hover:text-muted-foreground transition-colors fill-muted-foreground/10" />
                              <span className="text-xs text-muted-foreground truncate w-full text-center leading-tight">{folder.name}</span>
                            </button>
                          </ContextMenuTrigger>
                          <ContextMenuContent>
                            <ContextMenuItem onClick={() => setRenameTarget({ type: 'folder', id: folder.id, name: folder.name })} className="gap-2">
                              <Pencil className="h-4 w-4" /> {tr.rename}
                            </ContextMenuItem>
                            <ContextMenuItem onClick={() => handleArchiveFolder(folder.id)} className="gap-2 text-destructive focus:text-destructive">
                              <Trash2 className="h-4 w-4" /> {tr.delete}
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      ))}
                    </div>
                  )}

                  {/* Reports list */}
                  {reports.map(report => (
                    <ContextMenu key={report.id}>
                      <ContextMenuTrigger asChild>
                        <div
                          onClick={() => window.open(`/rapport/${report.id}`, '_blank')}
                          className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors group cursor-pointer"
                        >
                          <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{report.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {tr.reportTypes[report.report_type] || report.report_type}
                              {' · '}
                              {new Date(report.created_at).toLocaleDateString(language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US')}
                            </p>
                          </div>
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        <ContextMenuItem onClick={() => setRenameTarget({ type: 'report', id: report.id, name: report.title })} className="gap-2">
                          <Pencil className="h-4 w-4" /> {tr.rename}
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => handleDownload(report)} className="gap-2">
                          <Download className="h-4 w-4" /> {tr.download}
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => handleArchiveReport(report.id)} className="gap-2 text-destructive focus:text-destructive">
                          <Trash2 className="h-4 w-4" /> {tr.delete}
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  ))}

                  {/* Archives collapsible */}
                  {(archivedFolders.length > 0 || archivedReports.length > 0) && (
                    <Collapsible open={archivesOpen} onOpenChange={setArchivesOpen} className="mt-6">
                      <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full py-2 border-t border-border/40">
                        <Archive className="h-3.5 w-3.5" />
                        <span>{tr.archives} ({archivedFolders.length + archivedReports.length})</span>
                        <ChevronDown className={`h-3.5 w-3.5 ml-auto transition-transform ${archivesOpen ? 'rotate-180' : ''}`} />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-2 pt-2">
                        {archivedFolders.map(f => (
                          <div key={f.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 text-muted-foreground text-sm">
                            <FolderOpen className="h-4 w-4 shrink-0" />
                            <span className="flex-1 truncate">{f.name}</span>
                            <button onClick={() => handleRestore('folder', f.id)} className="p-1 rounded hover:bg-muted transition-colors" title={tr.restore}>
                              <Undo2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                        {archivedReports.map(r => (
                          <div key={r.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 text-muted-foreground text-sm">
                            <FileText className="h-4 w-4 shrink-0" />
                            <span className="flex-1 truncate">{r.title}</span>
                            <button onClick={() => handleRestore('report', r.id)} className="p-1 rounded hover:bg-muted transition-colors" title={tr.restore}>
                              <Undo2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </div>
              )}
          </div>
        </div>
      </CardContent>

      {/* New Folder Dialog */}
      <Dialog open={showNewFolderDialog} onOpenChange={setShowNewFolderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr.newFolder}</DialogTitle>
            <DialogDescription>
              {language === 'fr' ? 'Créez un dossier pour organiser vos rapports' :
               language === 'es' ? 'Crea una carpeta para organizar tus informes' :
               'Create a folder to organize your reports'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder={tr.folderName}
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewFolderDialog(false)}>{tr.cancel}</Button>
            <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>{tr.create}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={!!renameTarget} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr.rename}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={renameTarget?.name || ''}
              onChange={(e) => renameTarget && setRenameTarget({ ...renameTarget, name: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>{tr.cancel}</Button>
            <Button onClick={handleRename} disabled={!renameTarget?.name.trim()}>{tr.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
