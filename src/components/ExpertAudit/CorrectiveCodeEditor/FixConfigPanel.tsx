import { motion } from 'framer-motion';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Zap, FileText, Eye, Tag, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { useState } from 'react';
import { FixConfig } from './scriptGenerator';

interface FixConfigPanelProps {
  fixes: FixConfig[];
  onToggle: (fixId: string) => void;
  categories: {
    seo: string;
    performance: string;
    accessibility: string;
    tracking: string;
  };
}

const categoryIcons = {
  seo: FileText,
  performance: Zap,
  accessibility: Eye,
  tracking: Tag,
};

const categoryColors = {
  seo: 'text-blue-500',
  performance: 'text-amber-500',
  accessibility: 'text-purple-500',
  tracking: 'text-emerald-500',
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

export function FixConfigPanel({ fixes, onToggle, categories }: FixConfigPanelProps) {
  const [openCategories, setOpenCategories] = useState<string[]>(['seo', 'performance']);

  // Group fixes by category
  const groupedFixes = fixes.reduce((acc, fix) => {
    if (!acc[fix.category]) acc[fix.category] = [];
    acc[fix.category].push(fix);
    return acc;
  }, {} as Record<string, FixConfig[]>);

  const toggleCategory = (category: string) => {
    setOpenCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  return (
    <div className="space-y-3">
      {Object.entries(groupedFixes).map(([category, categoryFixes]) => {
        const Icon = categoryIcons[category as keyof typeof categoryIcons] || FileText;
        const colorClass = categoryColors[category as keyof typeof categoryColors] || 'text-muted-foreground';
        const categoryLabel = categories[category as keyof typeof categories] || category;
        const enabledCount = categoryFixes.filter(f => f.enabled).length;
        const isOpen = openCategories.includes(category);

        return (
          <Collapsible 
            key={category} 
            open={isOpen}
            onOpenChange={() => toggleCategory(category)}
          >
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${colorClass}`} />
                  <span className="text-sm font-medium">{categoryLabel}</span>
                  <Badge variant="secondary" className="text-xs px-1.5 py-0">
                    {enabledCount}/{categoryFixes.length}
                  </Badge>
                </div>
                <motion.div
                  animate={{ rotate: isOpen ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </motion.div>
              </div>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <div className="ml-6 space-y-2 pt-2">
                {categoryFixes.map((fix) => {
                  const PriorityIcon = priorityConfig[fix.priority].icon;
                  
                  return (
                    <motion.div
                      key={fix.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`
                        flex items-start gap-3 p-2 rounded-lg border transition-all
                        ${fix.enabled 
                          ? 'bg-primary/5 border-primary/30' 
                          : 'bg-muted/30 border-transparent hover:border-muted-foreground/20'
                        }
                      `}
                    >
                      <Switch
                        checked={fix.enabled}
                        onCheckedChange={() => onToggle(fix.id)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-sm font-medium ${fix.enabled ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {fix.label}
                          </span>
                          <Badge 
                            variant="outline" 
                            className={`text-xs px-1.5 py-0 ${priorityConfig[fix.priority].color}`}
                          >
                            <PriorityIcon className="w-2.5 h-2.5 mr-1" />
                            {priorityConfig[fix.priority].label}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {fix.description}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}
