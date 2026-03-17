import { motion } from 'framer-motion';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Zap, FileText, Eye, Tag, BrainCircuit, AlertCircle, AlertTriangle, Info, Lock } from 'lucide-react';
import { FixConfig } from './types';
import { useAuth } from '@/contexts/AuthContext';
import { useFreemiumMode } from '@/contexts/FreemiumContext';

const FREEMIUM_MAX_FIXES = 3;

interface TechnicalTabProps {
  fixes: FixConfig[];
  onToggle: (fixId: string) => void;
  onRequestAuth?: () => void;
  disabled?: boolean;
}

const categoryIcons = {
  seo: FileText,
  performance: Zap,
  accessibility: Eye,
  tracking: Tag,
  hallucination: BrainCircuit,
  strategic: Zap,
};

const categoryColors = {
  seo: 'text-violet-500',
  performance: 'text-amber-500',
  accessibility: 'text-purple-500',
  tracking: 'text-emerald-500',
  hallucination: 'text-slate-500',
  strategic: 'text-blue-500',
};

const categoryLabels: Record<string, string> = {
  seo: 'SEO & Contenu',
  performance: 'Performance',
  accessibility: 'Accessibilité',
  tracking: 'Tracking & Analytics',
  hallucination: 'Correction IA',
};

const priorityConfig = {
  critical: { 
    label: 'Critique', 
    color: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30',
    icon: AlertCircle 
  },
  important: { 
    label: 'Important', 
    color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
    icon: AlertTriangle 
  },
  optional: { 
    label: 'Optionnel', 
    color: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30',
    icon: Info 
  },
  installed: {
    label: 'Déjà installé',
    color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    icon: Info
  },
};

export function TechnicalTab({ fixes, onToggle, onRequestAuth, disabled }: TechnicalTabProps) {
  const { user } = useAuth();
  const { openMode } = useFreemiumMode();
  const isAnonymousFreemium = openMode && !user;

  // Filter only technical fixes (non-strategic, non-generative)
  const technicalFixes = fixes.filter(f => f.category !== 'strategic' && f.category !== 'generative');

  // In freemium mode, only the first N minor (non-critical) fixes are allowed
  const minorFixIds = new Set(
    technicalFixes
      .filter(f => f.priority !== 'critical')
      .slice(0, FREEMIUM_MAX_FIXES)
      .map(f => f.id)
  );
  
  // Group by category
  const groupedFixes = technicalFixes.reduce((acc, fix) => {
    if (!acc[fix.category]) acc[fix.category] = [];
    acc[fix.category].push(fix);
    return acc;
  }, {} as Record<string, FixConfig[]>);

  return (
    <div className="space-y-3">
      {Object.entries(groupedFixes).map(([category, categoryFixes]) => {
        const Icon = categoryIcons[category as keyof typeof categoryIcons] || FileText;
        const colorClass = categoryColors[category as keyof typeof categoryColors] || 'text-muted-foreground';
        const categoryLabel = categoryLabels[category] || category;
        const enabledCount = categoryFixes.filter(f => f.enabled).length;

        return (
          <div key={category} className="space-y-1.5">
            <div className="flex items-center gap-1.5 pb-0.5 border-b border-muted">
              <Icon className={`w-3 h-3 ${colorClass}`} />
              <span className="text-xs font-semibold">{categoryLabel}</span>
              <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-auto h-4">
                {enabledCount}/{categoryFixes.length}
              </Badge>
            </div>

            <div className="space-y-1">
              {categoryFixes.map((fix, index) => {
                const pConfig = priorityConfig[fix.priority as keyof typeof priorityConfig] || priorityConfig.optional;
                const PriorityIcon = pConfig.icon;
                const isLocked = !!fix.locked;
                const isFreemiumLocked = isAnonymousFreemium && !minorFixIds.has(fix.id);
                return (
                  <motion.div
                    key={fix.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className={`rounded-md border transition-all ${
                      isLocked || isFreemiumLocked
                        ? 'p-1.5 px-2 border-border opacity-50 cursor-not-allowed'
                        : fix.enabled 
                          ? 'p-2 border-primary/30 bg-primary/5' 
                          : 'p-1.5 px-2 border-border hover:border-primary/30'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1">
                        {fix.enabled && !isLocked && (
                          <div className={`p-1 rounded bg-primary/10 ${colorClass}`}>
                            <Icon className="w-3 h-3" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-xs ${isLocked ? 'text-muted-foreground line-through' : fix.enabled ? 'font-medium' : 'text-muted-foreground'}`}>
                              {fix.label}
                            </span>
                            {isLocked ? (
                              <Badge 
                                variant="outline" 
                                className={`text-[9px] px-1 py-0 h-4 ${pConfig.color}`}
                              >
                                {pConfig.label}
                              </Badge>
                            ) : fix.isRecommended ? (
                               <Badge 
                                 variant="outline" 
                                 className="text-[9px] px-1 py-0 h-4 bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30"
                               >
                                 Recommandé
                               </Badge>
                             ) : fix.enabled && (
                               <Badge 
                                 variant="outline" 
                                 className={`text-[9px] px-1 py-0 h-4 ${pConfig.color}`}
                               >
                                 <PriorityIcon className="w-2 h-2 mr-0.5" />
                                 {pConfig.label}
                               </Badge>
                             )}
                          </div>
                        </div>
                      </div>
                      {isFreemiumLocked ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px] gap-1 px-2"
                          onClick={() => onRequestAuth?.()}
                        >
                          <Lock className="w-2.5 h-2.5" />
                          S'inscrire
                        </Button>
                      ) : (
                        <Switch
                          checked={fix.enabled}
                          onCheckedChange={() => onToggle(fix.id)}
                          disabled={isLocked}
                          className="data-[state=checked]:bg-violet-600 scale-75"
                        />
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
