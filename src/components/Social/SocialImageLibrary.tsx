/**
 * SocialImageLibrary — Shared image library for Social Hub & Content Architect.
 * Upload, browse, delete images from the image-references bucket.
 * Supports: insert image into post, use as AI prompt reference.
 */
import { memo, useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Upload, Trash2, Loader2, ImageIcon, Wand2, Check, X
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export interface LibraryImage {
  name: string;
  url: string;
  path: string;
  created_at: string;
}

interface SocialImageLibraryProps {
  trackedSiteId?: string;
  /** Called when user clicks an image to insert it directly */
  onInsertImage?: (url: string) => void;
  /** Called when user selects an image as AI prompt reference */
  onUseAsReference?: (image: LibraryImage) => void;
  /** Compact mode for sidebar panels */
  compact?: boolean;
}

const BUCKET = 'image-references';
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export const SocialImageLibrary = memo(function SocialImageLibrary({
  trackedSiteId, onInsertImage, onUseAsReference, compact = false
}: SocialImageLibraryProps) {
  const [images, setImages] = useState<LibraryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getFolder = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !trackedSiteId) return null;
    return `${user.id}/${trackedSiteId}/library`;
  }, [trackedSiteId]);

  const loadImages = useCallback(async () => {
    setLoading(true);
    const folder = await getFolder();
    if (!folder) { setLoading(false); return; }

    // Also load generated images from the "generated" folder
    const generatedFolder = folder.replace('/library', '/generated');

    const [libRes, genRes] = await Promise.all([
      supabase.storage.from(BUCKET).list(folder, { limit: 50, sortBy: { column: 'created_at', order: 'desc' } }),
      supabase.storage.from(BUCKET).list(generatedFolder, { limit: 50, sortBy: { column: 'created_at', order: 'desc' } }),
    ]);

    const mapFiles = (files: any[], folderPath: string): LibraryImage[] =>
      (files || []).filter(f => f.name && !f.name.startsWith('.')).map(f => {
        const path = `${folderPath}/${f.name}`;
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
        return { name: f.name, url: data.publicUrl, path, created_at: f.created_at || '' };
      });

    const allImages = [
      ...mapFiles(libRes.data || [], folder),
      ...mapFiles(genRes.data || [], generatedFolder),
    ].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

    setImages(allImages);
    setLoading(false);
  }, [getFolder]);

  useEffect(() => { loadImages(); }, [loadImages]);

  const handleUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const folder = await getFolder();
    if (!folder) { toast.error('Sélectionnez un site'); return; }

    setUploading(true);
    let uploaded = 0;

    for (const file of Array.from(files)) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast.error(`Format non supporté: ${file.name}`);
        continue;
      }
      if (file.size > MAX_SIZE) {
        toast.error(`Fichier trop volumineux: ${file.name} (max 10 Mo)`);
        continue;
      }

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${folder}/${Date.now()}_${safeName}`;

      const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: '31536000',
        upsert: false,
      });

      if (error) {
        toast.error(`Erreur upload: ${error.message}`);
      } else {
        uploaded++;
      }
    }

    if (uploaded > 0) {
      toast.success(`${uploaded} image${uploaded > 1 ? 's' : ''} importée${uploaded > 1 ? 's' : ''}`);
      await loadImages();
    }
    setUploading(false);
  }, [getFolder, loadImages]);

  const handleDelete = useCallback(async (img: LibraryImage) => {
    const { error } = await supabase.storage.from(BUCKET).remove([img.path]);
    if (error) { toast.error(error.message); return; }
    setImages(prev => prev.filter(i => i.path !== img.path));
    setSelectedIdx(null);
    toast.success('Image supprimée');
  }, []);

  const selected = selectedIdx !== null ? images[selectedIdx] : null;

  return (
    <div className={`flex flex-col ${compact ? 'h-full' : 'border border-border rounded-lg'}`}>
      {/* Header */}
      <div className={`flex items-center justify-between gap-2 ${compact ? 'px-3 py-2 border-b border-white/10' : 'px-4 py-3 border-b border-border'}`}>
        <div className="flex items-center gap-2">
          <ImageIcon className={`${compact ? 'w-3.5 h-3.5 text-white/50' : 'w-4 h-4 text-muted-foreground'} stroke-[1.5]`} />
          <h3 className={`font-semibold ${compact ? 'text-xs text-white/70' : 'text-sm text-foreground'}`}>
            Bibliothèque d'images
          </h3>
          <Badge variant="outline" className="text-[9px] px-1">{images.length}</Badge>
        </div>
        <div className="flex items-center gap-1">
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            multiple
            className="hidden"
            onChange={e => handleUpload(e.target.files)}
          />
          <Button
            variant={compact ? 'ghost' : 'outline'}
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className={compact ? 'h-6 w-6 p-0 text-white/40 hover:text-white/70' : 'h-7 gap-1.5 text-xs'}
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {!compact && 'Importer'}
          </Button>
        </div>
      </div>

      {/* Selected image actions bar */}
      {selected && (
        <div className={`flex items-center gap-1.5 px-3 py-1.5 ${compact ? 'bg-white/[0.03] border-b border-white/10' : 'bg-muted/50 border-b border-border'}`}>
          <span className={`text-[10px] truncate flex-1 ${compact ? 'text-white/50' : 'text-muted-foreground'}`}>
            {selected.name}
          </span>
          {onInsertImage && (
            <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1.5 gap-1" onClick={() => { onInsertImage(selected.url); setSelectedIdx(null); }}>
              <Check className="h-3 w-3" /> Insérer
            </Button>
          )}
          {onUseAsReference && (
            <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1.5 gap-1" onClick={() => { onUseAsReference(selected); setSelectedIdx(null); }}>
              <Wand2 className="h-3 w-3" /> Référence IA
            </Button>
          )}
          <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-destructive/60 hover:text-destructive" onClick={() => handleDelete(selected)}>
            <Trash2 className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => setSelectedIdx(null)}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Grid */}
      <ScrollArea className="flex-1">
        <div className={`${compact ? 'p-2' : 'p-3'}`}>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className={`w-4 h-4 animate-spin ${compact ? 'text-white/20' : 'text-muted-foreground'}`} />
            </div>
          ) : images.length === 0 ? (
            <div className="text-center py-8">
              <ImageIcon className={`w-8 h-8 mx-auto mb-2 ${compact ? 'text-white/10' : 'text-muted-foreground/30'}`} />
              <p className={`text-xs ${compact ? 'text-white/20' : 'text-muted-foreground'}`}>Aucune image</p>
              <p className={`text-[10px] mt-1 ${compact ? 'text-white/15' : 'text-muted-foreground/60'}`}>Importez vos photos ou générez des images</p>
            </div>
          ) : (
            <div className={`grid ${compact ? 'grid-cols-2 gap-1.5' : 'grid-cols-3 sm:grid-cols-4 gap-2'}`}>
              {images.map((img, i) => (
                <button
                  key={img.path}
                  onClick={() => setSelectedIdx(selectedIdx === i ? null : i)}
                  className={`rounded-lg overflow-hidden border transition-all group relative aspect-square
                    ${selectedIdx === i
                      ? compact ? 'border-[#fbbf24] ring-1 ring-[#fbbf24]/40' : 'border-primary ring-2 ring-primary/30'
                      : compact ? 'border-white/5 hover:border-white/20' : 'border-border hover:border-primary/40'
                    }`}
                >
                  <img src={img.url} alt={img.name} className="w-full h-full object-cover" loading="lazy" />
                  {selectedIdx === i && (
                    <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-2.5 w-2.5 text-primary-foreground" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Drop zone hint */}
          {!loading && (
            <div
              className={`mt-3 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors
                ${compact ? 'border-white/10 hover:border-white/20 py-3' : 'border-border hover:border-primary/40 py-4'}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={e => { e.preventDefault(); e.stopPropagation(); handleUpload(e.dataTransfer.files); }}
            >
              <Upload className={`h-4 w-4 mx-auto mb-1 ${compact ? 'text-white/15' : 'text-muted-foreground/40'}`} />
              <p className={`text-[10px] ${compact ? 'text-white/20' : 'text-muted-foreground/50'}`}>
                Glisser-déposer ou cliquer
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
});
