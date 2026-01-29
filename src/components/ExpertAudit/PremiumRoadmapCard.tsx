import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Target, FileText, Award, Users, Settings,
  AlertTriangle, Star, Lightbulb, TrendingUp,
  ChevronRight, DollarSign
} from 'lucide-react';
import { PremiumRoadmapItem } from '@/types/expertAudit';

interface PremiumRoadmapCardProps {
  roadmap: PremiumRoadmapItem[];
}

export function PremiumRoadmapCard({ roadmap }: PremiumRoadmapCardProps) {
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Identité': return <Target className="h-4 w-4" />;
      case 'Contenu': return <FileText className="h-4 w-4" />;
      case 'Autorité': return <Award className="h-4 w-4" />;
      case 'Social': return <Users className="h-4 w-4" />;
      case 'Technique': return <Settings className="h-4 w-4" />;
      default: return <Lightbulb className="h-4 w-4" />;
    }
  };

  const getPriorityConfig = (priority: string) => {
    switch (priority) {
      case 'Prioritaire':
        return {
          icon: <AlertTriangle className="h-3.5 w-3.5" />,
          color: 'bg-destructive/10 text-destructive border-destructive/30',
          barColor: 'bg-destructive',
          label: 'Prioritaire'
        };
      case 'Important':
        return {
          icon: <Star className="h-3.5 w-3.5" />,
          color: 'bg-warning/10 text-warning border-warning/30',
          barColor: 'bg-warning',
          label: 'Important'
        };
      case 'Opportunité':
        return {
          icon: <Lightbulb className="h-3.5 w-3.5" />,
          color: 'bg-success/10 text-success border-success/30',
          barColor: 'bg-success',
          label: 'Opportunité'
        };
      default:
        return {
          icon: <Lightbulb className="h-3.5 w-3.5" />,
          color: 'bg-muted text-muted-foreground border-border',
          barColor: 'bg-muted-foreground',
          label: priority
        };
    }
  };

  const getROIConfig = (roi: string) => {
    switch (roi) {
      case 'High':
        return { color: 'bg-success/10 text-success border-success/30', label: 'ROI Élevé', icon: '🚀' };
      case 'Medium':
        return { color: 'bg-warning/10 text-warning border-warning/30', label: 'ROI Moyen', icon: '📈' };
      case 'Low':
        return { color: 'bg-muted text-muted-foreground border-border', label: 'ROI Faible', icon: '📊' };
      default:
        return { color: 'bg-muted text-muted-foreground border-border', label: roi, icon: '📊' };
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Identité': return 'bg-primary/10 text-primary';
      case 'Contenu': return 'bg-blue-500/10 text-blue-600 dark:text-blue-400';
      case 'Autorité': return 'bg-purple-500/10 text-purple-600 dark:text-purple-400';
      case 'Social': return 'bg-pink-500/10 text-pink-600 dark:text-pink-400';
      case 'Technique': return 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  // Sort by priority
  const priorityOrder = ['Prioritaire', 'Important', 'Opportunité'];
  const sortedRoadmap = [...roadmap].sort((a, b) => {
    return priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority);
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
    >
      <Card className="border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-transparent">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Target className="h-5 w-5 text-emerald-500" />
            Feuille de Route Exécutive 2026
            <Badge variant="outline" className="ml-auto text-xs text-emerald-600 border-emerald-500/50">
              {roadmap.length} Initiatives Stratégiques
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {sortedRoadmap.map((item, index) => {
            const priorityConfig = getPriorityConfig(item.priority);
            const roiConfig = getROIConfig(item.expected_roi);
            
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.08 }}
                className="relative"
              >
                {/* Priority indicator bar */}
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l ${priorityConfig.barColor}`} />
                
                <div className="pl-5 py-4 pr-4 bg-muted/30 rounded-r-lg border-l-0 hover:bg-muted/50 transition-colors">
                  {/* Header */}
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <div className={`p-1.5 rounded ${getCategoryColor(item.category)}`}>
                      {getCategoryIcon(item.category)}
                    </div>
                    <h4 className="font-semibold text-foreground flex-1">
                      {item.title}
                    </h4>
                    <div className="flex gap-2">
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${priorityConfig.color} gap-1`}
                      >
                        {priorityConfig.icon}
                        {priorityConfig.label}
                      </Badge>
                      <Badge variant="outline" className={`text-xs ${roiConfig.color}`}>
                        {roiConfig.icon} {roiConfig.label}
                      </Badge>
                    </div>
                  </div>
                  
                  {/* Prescriptive Action - NARRATIVE PARAGRAPH */}
                  <div className="mb-3">
                    <p className="text-sm text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
                      <ChevronRight className="h-3 w-3 text-emerald-500" />
                      Action Prescriptive
                    </p>
                    <p className="text-sm text-foreground leading-relaxed bg-background/50 p-3 rounded-lg border border-border">
                      {item.prescriptive_action}
                    </p>
                  </div>
                  
                  {/* Strategic Rationale */}
                  <div className="flex items-start gap-2">
                    <TrendingUp className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Impact Stratégique</p>
                      <p className="text-sm text-muted-foreground italic">
                        {item.strategic_rationale}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </CardContent>
      </Card>
    </motion.div>
  );
}
