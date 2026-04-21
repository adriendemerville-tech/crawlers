/**
 * Social Post Editor — Rich text editor with emoji, @mentions, hashtags,
 * character counter, smart link, translation, and image management.
 */
import { memo, useState, useCallback, useRef } from 'react';
import { GoogleDriveFolderPicker } from './GoogleDriveFolderPicker';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import {
  Smile, AtSign, Hash, Link2, Globe, Sparkles, Send, Download, Save, Loader2, Languages, Wand2, HardDrive, ImageIcon
} from 'lucide-react';
import { toast } from 'sonner';
import { generateContent, resolveSmartLink, shortenLink, translatePost } from '@/lib/api/socialHub';
import { type LibraryImage } from './SocialImageLibrary';

const EMOJI_LIST = ['🚀', '✅', '💡', '🔥', '📈', '💪', '🎯', '⚡', '🏆', '✨', '👉', '📊', '🔑', '💰', '🌟', '❤️', '👏', '🙌', '📢', '🤝', '🧠', '🎉', '💎', '📌', '🔔'];

const CHAR_LIMITS: Record<string, number> = { linkedin: 3000, facebook: 63206, instagram: 2200 };

interface SocialPostEditorProps {
  trackedSiteId?: string;
  domain?: string;
  initialContent?: { linkedin?: string; facebook?: string; instagram?: string };
  initialTitle?: string;
  initialHashtags?: string[];
  /** Currently selected image URL for the post */
  selectedImageUrl?: string;
  /** Reference images selected from library for AI prompt */
  referenceImages?: LibraryImage[];
  onSave: (data: {
    title: string;
    content_linkedin: string;
    content_facebook: string;
    content_instagram: string;
    hashtags: string[];
    smart_link_url?: string;
    smart_link_short?: string;
    image_url?: string;
  }) => void;
  onPublish?: () => void;
  onExport?: () => void;
  saving?: boolean;
  onContentChange?: (platform: string, content: string, hashtags: string[]) => void;
  onPlatformChange?: (platform: string) => void;
  onToggleLibrary?: () => void;
}

export const SocialPostEditor = memo(function SocialPostEditor({
  trackedSiteId, domain, initialContent, initialTitle, initialHashtags, selectedImageUrl, referenceImages, onSave, onPublish, onExport, saving, onContentChange, onPlatformChange, onToggleLibrary
}: SocialPostEditorProps) {
  const [title, setTitle] = useState(initialTitle || '');
  const [linkedin, setLinkedin] = useState(initialContent?.linkedin || '');
  const [facebook, setFacebook] = useState(initialContent?.facebook || '');
  const [instagram, setInstagram] = useState(initialContent?.instagram || '');
  const [hashtags, setHashtags] = useState<string[]>(initialHashtags || []);
  const [newHashtag, setNewHashtag] = useState('');
  const [smartLink, setSmartLink] = useState<{ url: string; short: string } | null>(null);
  const [activePlatform, setActivePlatform] = useState('linkedin');

  const handlePlatformChange = useCallback((p: string) => {
    setActivePlatform(p);
    onPlatformChange?.(p);
  }, [onPlatformChange]);
  const [generating, setGenerating] = useState(false);
  const [translating, setTranslating] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [drivePickerOpen, setDrivePickerOpen] = useState(false);

  const currentContent = activePlatform === 'linkedin' ? linkedin : activePlatform === 'facebook' ? facebook : instagram;
  const setCurrentContent = activePlatform === 'linkedin' ? setLinkedin : activePlatform === 'facebook' ? setFacebook : setInstagram;
  const charLimit = CHAR_LIMITS[activePlatform] || 3000;

  const insertAtCursor = useCallback((text: string) => {
    const el = textareaRef.current;
    if (!el) { setCurrentContent(prev => prev + text); return; }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const newValue = currentContent.slice(0, start) + text + currentContent.slice(end);
    setCurrentContent(newValue);
    setTimeout(() => { el.selectionStart = el.selectionEnd = start + text.length; el.focus(); }, 0);
  }, [currentContent, setCurrentContent]);

  const handleGenerate = async () => {
    if (!title.trim()) { toast.error('Entrez un sujet / titre'); return; }
    setGenerating(true);
    try {
      // Include reference image names in custom instructions if any
      const refInstructions = referenceImages?.length
        ? `L'utilisateur a sélectionné ces images comme références visuelles : ${referenceImages.map((r, i) => `${i + 1}. "${r.name}"`).join(', ')}. Adapte le contenu pour accompagner ces visuels.`
        : undefined;
      const result = await generateContent({
        topic: title,
        tracked_site_id: trackedSiteId,
        platforms: ['linkedin', 'facebook', 'instagram'],
        custom_instructions: refInstructions,
      });
      if (result.content_linkedin) setLinkedin(result.content_linkedin);
      if (result.content_facebook) setFacebook(result.content_facebook);
      if (result.content_instagram) setInstagram(result.content_instagram);
      if (result.hashtags?.length) setHashtags(result.hashtags);
      toast.success('Contenu généré !');
    } catch (e: any) { toast.error(e.message || 'Erreur de génération'); }
    finally { setGenerating(false); }
  };

  const handleSmartLink = async () => {
    if (!trackedSiteId && !domain) { toast.error('Sélectionnez un site'); return; }
    try {
      const result = await resolveSmartLink({ topic: title, keyword: title, tracked_site_id: trackedSiteId, domain });
      if (result.best) {
        const shortened = await shortenLink({ url: result.best.url, platform: activePlatform });
        setSmartLink({ url: result.best.url, short: shortened.short_url });
        insertAtCursor(`\n\n👉 ${shortened.short_url}`);
        toast.success(`Lien intelligent: ${result.best.reason}`);
      } else { toast.info('Aucune page pertinente trouvée'); }
    } catch (e: any) { toast.error(e.message); }
  };

  const handleTranslate = async (lang: string) => {
    setTranslating(true);
    try {
      const result = await translatePost({ content: currentContent, target_language: lang, platform: activePlatform, hashtags });
      if (result.translated_content) {
        setCurrentContent(result.translated_content);
        if (result.translated_hashtags?.length) setHashtags(result.translated_hashtags);
        toast.success(`Traduit en ${lang === 'en' ? 'anglais' : 'espagnol'}`);
      }
    } catch (e: any) { toast.error(e.message); }
    finally { setTranslating(false); }
  };

  const addHashtag = () => {
    const tag = newHashtag.replace(/^#/, '').trim();
    if (tag && !hashtags.includes(tag)) { setHashtags([...hashtags, tag]); setNewHashtag(''); }
  };

  const handleSave = () => {
    onSave({ title, content_linkedin: linkedin, content_facebook: facebook, content_instagram: instagram, hashtags, smart_link_url: smartLink?.url, smart_link_short: smartLink?.short, image_url: selectedImageUrl });
  };

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Éditeur de post</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleGenerate} disabled={generating}>
              {generating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
              Générer IA
            </Button>
          </div>
        </div>
        <Input placeholder="Sujet / Titre du post..." value={title} onChange={e => setTitle(e.target.value)} className="mt-2" />
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Platform tabs */}
        <Tabs value={activePlatform} onValueChange={handlePlatformChange}>
          <TabsList className="grid grid-cols-3">
            <TabsTrigger value="linkedin">LinkedIn</TabsTrigger>
            <TabsTrigger value="facebook">Facebook</TabsTrigger>
            <TabsTrigger value="instagram">Instagram</TabsTrigger>
          </TabsList>

          {['linkedin', 'facebook', 'instagram'].map(platform => (
            <TabsContent key={platform} value={platform} className="mt-3">
              {/* Toolbar */}
              <div className="flex items-center gap-1 mb-2 flex-wrap">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Smile className="h-4 w-4" /></Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-2" align="start">
                    <div className="grid grid-cols-5 gap-1">
                      {EMOJI_LIST.map(e => (
                        <button key={e} onClick={() => insertAtCursor(e)} className="text-lg hover:bg-muted rounded p-1 transition-colors">{e}</button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>

                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => insertAtCursor('@')}>
                  <AtSign className="h-4 w-4" />
                </Button>

                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => insertAtCursor('#')}>
                  <Hash className="h-4 w-4" />
                </Button>

                <Button variant="ghost" size="sm" className="h-8 px-2 gap-1" onClick={handleSmartLink}>
                  <Link2 className="h-4 w-4" />
                  <span className="text-xs hidden sm:inline">Lien intelligent</span>
                </Button>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 px-2 gap-1" disabled={translating}>
                      {translating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4" />}
                      <span className="text-xs hidden sm:inline">Traduire</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-40 p-2" align="start">
                    <button onClick={() => handleTranslate('en')} className="w-full text-left px-3 py-2 text-sm hover:bg-muted rounded">🇬🇧 English</button>
                    <button onClick={() => handleTranslate('es')} className="w-full text-left px-3 py-2 text-sm hover:bg-muted rounded">🇪🇸 Español</button>
                  </PopoverContent>
                </Popover>

                {/* Image library toggle */}
                {onToggleLibrary && (
                  <Button variant="ghost" size="sm" className="h-8 px-2 gap-1" onClick={onToggleLibrary}>
                    <ImageIcon className="h-4 w-4" />
                    <span className="text-xs hidden sm:inline">Images</span>
                    {referenceImages && referenceImages.length > 0 && (
                      <Badge variant="secondary" className="h-4 px-1 text-[9px] ml-0.5">{referenceImages.length} ref</Badge>
                    )}
                  </Button>
                )}
              </div>

              {/* Selected image preview */}
              {selectedImageUrl && (
                <div className="mb-2 rounded-lg overflow-hidden border border-border relative">
                  <img src={selectedImageUrl} alt="Image du post" className="w-full h-32 object-cover" />
                  <Badge variant="secondary" className="absolute top-2 left-2 text-[9px]">Image du post</Badge>
                </div>
              )}

              {/* Reference images indicator */}
              {referenceImages && referenceImages.length > 0 && (
                <div className="mb-2 flex items-center gap-1.5 p-2 bg-muted/50 rounded-md">
                  <Wand2 className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="text-[10px] text-muted-foreground">
                    Références IA : {referenceImages.map(r => r.name).join(', ')}
                  </span>
                </div>
              )}

              {/* Textarea */}
              <Textarea
                ref={textareaRef}
                value={platform === 'linkedin' ? linkedin : platform === 'facebook' ? facebook : instagram}
                onChange={e => {
                  const setter = platform === 'linkedin' ? setLinkedin : platform === 'facebook' ? setFacebook : setInstagram;
                  setter(e.target.value);
                  onContentChange?.(platform, e.target.value, hashtags);
                }}
                placeholder={`Rédigez votre post ${platform}...`}
                className="min-h-[200px] resize-y"
              />

              {/* Character counter */}
              <div className="flex items-center justify-between mt-1">
                <span className={`text-xs ${currentContent.length > charLimit ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                  {currentContent.length} / {charLimit.toLocaleString()} caractères
                </span>
                {platform === 'instagram' && <span className="text-xs text-muted-foreground">{hashtags.length}/30 hashtags</span>}
              </div>
            </TabsContent>
          ))}
        </Tabs>

        {/* Hashtags */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Input placeholder="Ajouter un hashtag..." value={newHashtag} onChange={e => setNewHashtag(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addHashtag())} className="flex-1" />
            <Button variant="outline" size="sm" onClick={addHashtag}>+</Button>
          </div>
          <div className="flex flex-wrap gap-1">
            {hashtags.map((tag, i) => (
              <Badge key={i} variant="secondary" className="cursor-pointer hover:bg-destructive/20" onClick={() => setHashtags(hashtags.filter((_, j) => j !== i))}>
                #{tag} ×
              </Badge>
            ))}
          </div>
        </div>

        {/* Smart link display */}
        {smartLink && (
          <div className="flex items-center gap-2 p-2 bg-muted rounded-md text-xs">
            <Link2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-muted-foreground truncate">{smartLink.url}</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">→ {smartLink.short}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-border flex-wrap">
          <Button onClick={handleSave} disabled={saving} className="gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white border-0">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Sauvegarder
          </Button>
          {onPublish && (
            <Button variant="outline" onClick={onPublish} className="gap-1.5 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10">
              <Send className="h-4 w-4" /> Publier
            </Button>
          )}
          {onExport && (
            <Button variant="outline" onClick={onExport} className="gap-1.5">
              <Download className="h-4 w-4" /> Export .zip
            </Button>
          )}
          {onExport && (
            <Button variant="outline" onClick={() => setDrivePickerOpen(true)} className="gap-1.5">
              <HardDrive className="h-4 w-4" /> Google Drive
            </Button>
          )}
          <GoogleDriveFolderPicker
            open={drivePickerOpen}
            onOpenChange={setDrivePickerOpen}
            onSelect={(folderId, folderPath) => {
              toast.success(`Export vers ${folderPath}`, { icon: '📁' });
              // TODO: call edge function to upload to selected Google Drive folder
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
});
