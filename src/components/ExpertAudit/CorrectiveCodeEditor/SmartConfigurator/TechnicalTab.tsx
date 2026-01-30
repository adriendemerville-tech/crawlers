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
  // Filter only technical fixes (non-strategic)
  const technicalFixes = fixes.filter(f => f.category !== 'strategic');
  
  // Group by category
  const groupedFixes = technicalFixes.reduce((acc, fix) => {
    if (!acc[fix.category]) acc[fix.category] = [];
    acc[fix.category].push(fix);
    return acc;
  }, {} as Record<string, FixConfig[]>);

  return (
    <div className="space-y-4">
      {Object.entries(groupedFixes).map(([category, categoryFixes]) => {
        const Icon = categoryIcons[category as keyof typeof categoryIcons] || FileText;
        const colorClass = categoryColors[category as keyof typeof categoryColors] || 'text-muted-foreground';
        const categoryLabel = categoryLabels[category] || category;
        const enabledCount = categoryFixes.filter(f => f.enabled).length;

        return (
          <div key={category} className="space-y-2">
            <div className="flex items-center gap-2 pb-1 border-b border-muted">
              <Icon className={`w-4 h-4 ${colorClass}`} />
              <span className="text-sm font-semibold">{categoryLabel}</span>
              <Badge variant="secondary" className="text-xs px-1.5 py-0 ml-auto">
                {enabledCount}/{categoryFixes.length}
              </Badge>
            </div>

            <div className="space-y-2">
              {categoryFixes.map((fix, index) => {
                const PriorityIcon = priorityConfig[fix.priority].icon;
                
                return (
                  <motion.div
                    key={fix.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    layout
                    transition={{ delay: index * 0.05 }}
                    className={`rounded-lg border transition-all ${
                      fix.enabled 
                        ? 'p-3 border-primary/30 bg-primary/5 shadow-sm' 
                        : 'p-2 px-3 border-border hover:border-primary/30'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1">
                        {fix.enabled && (
                          <div className={`p-2 rounded-lg bg-primary/10 ${colorClass}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm ${fix.enabled ? 'font-medium' : 'text-muted-foreground'}`}>
                              {fix.label}
                            </span>
                            {fix.enabled && (
                              <Badge 
                                variant="outline" 
                                className={`text-xs px-1.5 py-0 ${priorityConfig[fix.priority].color}`}
                              >
                                <PriorityIcon className="w-2.5 h-2.5 mr-1" />
                                {priorityConfig[fix.priority].label}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <Switch
                        checked={fix.enabled}
                        onCheckedChange={() => onToggle(fix.id)}
                        className="data-[state=checked]:bg-violet-600"
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
