import { motion } from 'framer-motion';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Zap, FileText, Eye, Tag, BrainCircuit, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { FixConfig } from './types';

interface TechnicalTabProps {
  fixes: FixConfig[];
  onToggle: (fixId: string) => void;
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
};

export function TechnicalTab({ fixes, onToggle }: TechnicalTabProps) {
  // Filter only technical fixes (non-strategic, non-generative)
  const technicalFixes = fixes.filter(f => f.category !== 'strategic' && f.category !== 'generative');
  
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
                const PriorityIcon = priorityConfig[fix.priority].icon;
                
                return (
                  <motion.div
                    key={fix.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className={`rounded-md border transition-all ${
                      fix.enabled 
                        ? 'p-2 border-primary/30 bg-primary/5' 
                        : 'p-1.5 px-2 border-border hover:border-primary/30'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1">
                        {fix.enabled && (
                          <div className={`p-1 rounded bg-primary/10 ${colorClass}`}>
                            <Icon className="w-3 h-3" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-xs ${fix.enabled ? 'font-medium' : 'text-muted-foreground'}`}>
                              {fix.label}
                            </span>
                             {fix.isRecommended ? (
                               <Badge 
                                 variant="outline" 
                                 className="text-[9px] px-1 py-0 h-4 bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30"
                               >
                                 Recommandé
                               </Badge>
                             ) : fix.enabled && (
                               <Badge 
                                 variant="outline" 
                                 className={`text-[9px] px-1 py-0 h-4 ${priorityConfig[fix.priority].color}`}
                               >
                                 <PriorityIcon className="w-2 h-2 mr-0.5" />
                                 {priorityConfig[fix.priority].label}
                               </Badge>
                             )}
                          </div>
                        </div>
                      </div>
                      <Switch
                        checked={fix.enabled}
                        onCheckedChange={() => onToggle(fix.id)}
                        className="data-[state=checked]:bg-violet-600 scale-75"
                      />
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
