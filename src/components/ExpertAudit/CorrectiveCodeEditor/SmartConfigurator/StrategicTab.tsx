import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Sparkles, FileText, Newspaper, Globe, Navigation, MapPin } from 'lucide-react';
import { FixConfig } from './types';

interface StrategicTabProps {
  fixes: FixConfig[];
  onToggle: (fixId: string) => void;
  onUpdateData: (fixId: string, data: Record<string, any>) => void;
  disabled?: boolean;
}

const strategicIcons: Record<string, React.ElementType> = {
  inject_faq: FileText,
  inject_blog_section: Newspaper,
  enhance_semantic_meta: Globe,
  inject_breadcrumbs: Navigation,
  inject_local_business: MapPin,
};

export function StrategicTab({ fixes, onToggle, onUpdateData, disabled }: StrategicTabProps) {
  const [openCards, setOpenCards] = useState<string[]>([]);

  // Filter only strategic fixes
  const strategicFixes = fixes.filter(f => f.category === 'strategic');

  const toggleCard = (fixId: string) => {
    setOpenCards(prev => 
      prev.includes(fixId) 
        ? prev.filter(id => id !== fixId)
        : [...prev, fixId]
    );
  };

  const handleCheckboxChange = (fix: FixConfig) => {
    onToggle(fix.id);
    // Auto-open card when enabled
    if (!fix.enabled && !openCards.includes(fix.id)) {
      setOpenCards(prev => [...prev, fix.id]);
    }
  };

  const renderConfigFields = (fix: FixConfig) => {
    switch (fix.id) {
      case 'inject_blog_section':
        return (
          <div className="space-y-3 pt-3">
            <div>
              <Label htmlFor={`${fix.id}-title`} className="text-xs text-muted-foreground">
                Titre de la section
              </Label>
              <Input
                id={`${fix.id}-title`}
                placeholder="« Nos Actualités »"
                value={fix.data?.sectionTitle || ''}
                onChange={(e) => onUpdateData(fix.id, { ...fix.data, sectionTitle: e.target.value })}
                className="mt-1 h-9 text-sm caret-auto"
              />
            </div>
          </div>
        );

      case 'enhance_semantic_meta':
        return (
          <div className="space-y-3 pt-3">
            <div>
              <Label htmlFor={`${fix.id}-keyword`} className="text-xs text-muted-foreground">
                Mot-clé cible
              </Label>
              <Input
                id={`${fix.id}-keyword`}
                placeholder="« consultant SEO Paris »"
                value={fix.data?.targetKeyword || ''}
                onChange={(e) => onUpdateData(fix.id, { ...fix.data, targetKeyword: e.target.value })}
                className="mt-1 h-9 text-sm caret-auto"
              />
            </div>
            <div>
              <Label htmlFor={`${fix.id}-paragraph`} className="text-xs text-muted-foreground">
                Paragraphe à injecter
              </Label>
              <Textarea
                id={`${fix.id}-paragraph`}
                placeholder="« Décrivez votre expertise ou votre proposition de valeur... »"
                value={fix.data?.injectedParagraph || ''}
                onChange={(e) => onUpdateData(fix.id, { ...fix.data, injectedParagraph: e.target.value })}
                className="mt-1 min-h-[80px] text-sm caret-auto"
              />
            </div>
          </div>
        );

      case 'inject_local_business':
        return (
          <div className="space-y-3 pt-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor={`${fix.id}-name`} className="text-xs text-muted-foreground">
                  Nom de l'entreprise
                </Label>
                <Input
                  id={`${fix.id}-name`}
                  placeholder="« Ma Société »"
                  value={fix.data?.name || ''}
                  onChange={(e) => onUpdateData(fix.id, { ...fix.data, name: e.target.value })}
                  className="mt-1 h-9 text-sm caret-auto"
                />
              </div>
              <div>
                <Label htmlFor={`${fix.id}-phone`} className="text-xs text-muted-foreground">
                  Téléphone
                </Label>
                <Input
                  id={`${fix.id}-phone`}
                  placeholder="« +33 1 23 45 67 89 »"
                  value={fix.data?.phone || ''}
                  onChange={(e) => onUpdateData(fix.id, { ...fix.data, phone: e.target.value })}
                  className="mt-1 h-9 text-sm caret-auto"
                />
              </div>
            </div>
            <div>
              <Label htmlFor={`${fix.id}-address`} className="text-xs text-muted-foreground">
                Adresse
              </Label>
              <Input
                id={`${fix.id}-address`}
                placeholder="« 123 Rue de Paris »"
                value={fix.data?.address || ''}
                onChange={(e) => onUpdateData(fix.id, { ...fix.data, address: e.target.value })}
                className="mt-1 h-9 text-sm caret-auto"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label htmlFor={`${fix.id}-city`} className="text-xs text-muted-foreground">
                  Ville
                </Label>
                <Input
                  id={`${fix.id}-city`}
                  placeholder="« Paris »"
                  value={fix.data?.city || ''}
                  onChange={(e) => onUpdateData(fix.id, { ...fix.data, city: e.target.value })}
                  className="mt-1 h-9 text-sm caret-auto"
                />
              </div>
              <div>
                <Label htmlFor={`${fix.id}-postal`} className="text-xs text-muted-foreground">
                  Code postal
                </Label>
                <Input
                  id={`${fix.id}-postal`}
                  placeholder="« 75001 »"
                  value={fix.data?.postalCode || ''}
                  onChange={(e) => onUpdateData(fix.id, { ...fix.data, postalCode: e.target.value })}
                  className="mt-1 h-9 text-sm caret-auto"
                />
              </div>
              <div>
                <Label htmlFor={`${fix.id}-country`} className="text-xs text-muted-foreground">
                  Pays
                </Label>
                <Input
                  id={`${fix.id}-country`}
                  placeholder="« France »"
                  value={fix.data?.country || ''}
                  onChange={(e) => onUpdateData(fix.id, { ...fix.data, country: e.target.value })}
                  className="mt-1 h-9 text-sm caret-auto"
                />
              </div>
            </div>
          </div>
        );

      case 'inject_faq':
        return (
          <div className="pt-3">
            <p className="text-xs text-muted-foreground italic">
              Les questions FAQ seront générées automatiquement par l'IA en fonction de votre site.
            </p>
          </div>
        );

      case 'inject_breadcrumbs':
        return (
          <div className="pt-3">
            <p className="text-xs text-muted-foreground italic">
              Le fil d'Ariane sera généré automatiquement en fonction de la structure de votre URL.
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-1.5">
      {strategicFixes.map((fix, index) => {
        const Icon = strategicIcons[fix.id] || Sparkles;
        const isOpen = fix.enabled;

        return (
          <motion.div
            key={fix.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
            className={`rounded-md border transition-all ${
              fix.enabled 
                ? 'p-2 border-blue-500/40 bg-blue-500/5' 
                : 'p-1.5 px-2 border-border hover:border-blue-500/30'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-1">
                {fix.enabled && (
                  <div className="p-1 rounded bg-blue-500/20 text-blue-600">
                    <Icon className="w-3 h-3" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs ${fix.enabled ? 'font-medium' : 'text-muted-foreground'}`}>
                      {fix.label}
                    </span>
                    {fix.isRecommended && fix.enabled && (
                      <Badge className="bg-gradient-to-r from-blue-500 to-violet-500 text-white text-[9px] px-1 py-0 h-4 border-0">
                        Recommandé
                      </Badge>
                    )}
                  </div>
                  {fix.enabled && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{fix.description}</p>
                  )}
                </div>
              </div>
              <Checkbox
                checked={fix.enabled}
                onCheckedChange={() => handleCheckboxChange(fix)}
                disabled={disabled}
                className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 scale-90"
              />
            </div>
            
            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pt-2 ml-7">
                    {renderConfigFields(fix)}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}
