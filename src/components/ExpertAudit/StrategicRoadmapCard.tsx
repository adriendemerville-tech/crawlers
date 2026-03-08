import { motion } from 'framer-motion';
import { MethodologyPopover } from './MethodologyPopover';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Target, FileText, Award, 
  AlertTriangle, Star, Lightbulb,
  ChevronRight
} from 'lucide-react';
import { StrategicRoadmapItem } from '@/types/expertAudit';

interface StrategicRoadmapCardProps {
  roadmap: StrategicRoadmapItem[];
}

export function StrategicRoadmapCard({ roadmap }: StrategicRoadmapCardProps) {
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Identité': return <Target className="h-4 w-4" />;
      case 'Contenu': return <FileText className="h-4 w-4" />;
      case 'Autorité': return <Award className="h-4 w-4" />;
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

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Identité': return 'bg-primary/10 text-primary';
      case 'Contenu': return 'bg-blue-500/10 text-blue-600 dark:text-blue-400';
      case 'Autorité': return 'bg-purple-500/10 text-purple-600 dark:text-purple-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  // Group by priority
  const priorityOrder = ['Prioritaire', 'Important', 'Opportunité'];
  const sortedRoadmap = [...roadmap].sort((a, b) => {
    return priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority);
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      <Card className="border-2">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Target className="h-5 w-5 text-primary" />
            Feuille de Route Stratégique
            <Badge variant="secondary" className="ml-auto text-xs">
              {roadmap.length} actions
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {sortedRoadmap.map((item, index) => {
            const priorityConfig = getPriorityConfig(item.priority);
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className="relative"
              >
                {/* Priority indicator bar */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l ${priorityConfig.barColor}`} />
                
                <div className="pl-4 py-3 pr-3 bg-muted/30 rounded-r-lg border-l-0 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start gap-3">
                    {/* Category icon */}
                    <div className={`p-1.5 rounded ${getCategoryColor(item.category)}`}>
                      {getCategoryIcon(item.category)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      {/* Header with badges */}
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${priorityConfig.color} gap-1`}
                        >
                          {priorityConfig.icon}
                          {priorityConfig.label}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {item.category}
                        </Badge>
                      </div>
                      
                      {/* Action */}
                      <div className="flex items-start gap-2 mb-2">
                        <ChevronRight className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        <p className="text-sm font-medium text-foreground leading-relaxed">
                          {item.action_concrete}
                        </p>
                      </div>
                      
                      {/* Strategic goal */}
                      <p className="text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-3">
                        💡 {item.strategic_goal}
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
