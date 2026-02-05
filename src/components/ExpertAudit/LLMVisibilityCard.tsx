 import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
 import { Badge } from '@/components/ui/badge';
 import { Progress } from '@/components/ui/progress';
 import { 
   Brain, Eye, EyeOff, ThumbsUp, ThumbsDown, 
   Sparkles, AlertTriangle, CheckCircle2, XCircle, MessageSquare
 } from 'lucide-react';
 import { LLMVisibilityRaw } from '@/types/expertAudit';
 
 interface LLMVisibilityCardProps {
   data: LLMVisibilityRaw;
 }
 
 export function LLMVisibilityCard({ data }: LLMVisibilityCardProps) {
   const getSentimentConfig = (sentiment: string) => {
     switch (sentiment) {
       case 'positive':
         return { label: 'Positif', color: 'text-success', bgColor: 'bg-success/10', icon: ThumbsUp };
       case 'mostly_positive':
         return { label: 'Plutôt positif', color: 'text-success/80', bgColor: 'bg-success/5', icon: ThumbsUp };
       case 'neutral':
         return { label: 'Neutre', color: 'text-muted-foreground', bgColor: 'bg-muted', icon: MessageSquare };
       case 'mixed':
         return { label: 'Mitigé', color: 'text-warning', bgColor: 'bg-warning/10', icon: AlertTriangle };
       case 'negative':
         return { label: 'Négatif', color: 'text-destructive', bgColor: 'bg-destructive/10', icon: ThumbsDown };
       default:
         return { label: 'Inconnu', color: 'text-muted-foreground', bgColor: 'bg-muted', icon: MessageSquare };
     }
   };
 
   const sentimentConfig = getSentimentConfig(data.overallSentiment);
   const SentimentIcon = sentimentConfig.icon;
   const citationPercent = Math.round((data.citationRate.cited / data.citationRate.total) * 100);
 
   const getScoreColor = (score: number) => {
     if (score >= 70) return 'text-success';
     if (score >= 40) return 'text-warning';
     return 'text-destructive';
   };
 
   return (
     <Card className="border-purple-500/30 bg-gradient-to-br from-purple-500/5 to-transparent">
       <CardHeader className="pb-3">
         <div className="flex items-center justify-between">
           <CardTitle className="flex items-center gap-2 text-lg">
             <Brain className="h-5 w-5 text-purple-500" />
             Visibilité LLMs
           </CardTitle>
           <Badge className={`${getScoreColor(data.overallScore)} bg-transparent border-current`}>
             Score: {data.overallScore}/100
           </Badge>
         </div>
         <CardDescription>
           Présence et perception de votre marque dans les grands modèles de langage
         </CardDescription>
       </CardHeader>
       <CardContent className="space-y-6">
         {/* Citation Rate */}
         <div className="space-y-2">
           <div className="flex items-center justify-between text-sm">
             <span className="font-medium">Taux de citation</span>
             <span className={getScoreColor(citationPercent)}>
               {data.citationRate.cited}/{data.citationRate.total} LLMs ({citationPercent}%)
             </span>
           </div>
           <Progress value={citationPercent} className="h-2" />
         </div>
 
         {/* Overall Sentiment */}
         <div className={`flex items-center gap-3 p-3 rounded-lg ${sentimentConfig.bgColor}`}>
           <SentimentIcon className={`h-5 w-5 ${sentimentConfig.color}`} />
           <div className="flex-1">
             <p className={`font-medium ${sentimentConfig.color}`}>{sentimentConfig.label}</p>
             <p className="text-xs text-muted-foreground">Sentiment général des LLMs</p>
           </div>
           {data.overallRecommendation && (
             <Badge variant="outline" className="text-success border-success/50">
               <ThumbsUp className="h-3 w-3 mr-1" />
               Recommandé
             </Badge>
           )}
         </div>
 
         {/* Core Value Summary */}
         {data.coreValueSummary && (
           <div className="p-3 rounded-lg bg-muted/50 border">
             <p className="text-sm font-medium mb-1 flex items-center gap-2">
               <Sparkles className="h-4 w-4 text-purple-500" />
               Synthèse des perceptions
             </p>
             <p className="text-sm text-muted-foreground">{data.coreValueSummary}</p>
           </div>
         )}
 
         {/* LLM Citations Grid */}
         <div className="space-y-2">
           <p className="text-sm font-medium">Détail par modèle</p>
           <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
             {data.citations.map((citation) => {
               const citeSentiment = getSentimentConfig(citation.sentiment);
               return (
                 <div 
                   key={citation.provider.id}
                   className={`p-2 rounded-lg border text-center ${citation.cited ? 'bg-card' : 'bg-muted/30 opacity-60'}`}
                 >
                   <div className="flex items-center justify-center gap-1 mb-1">
                     {citation.cited ? (
                       <Eye className="h-3 w-3 text-success" />
                     ) : (
                       <EyeOff className="h-3 w-3 text-destructive" />
                     )}
                     <span className="text-xs font-medium truncate">{citation.provider.name}</span>
                   </div>
                   {citation.cited ? (
                     <Badge variant="secondary" className={`text-[10px] ${citeSentiment.color}`}>
                       {citeSentiment.label}
                     </Badge>
                   ) : (
                     <Badge variant="outline" className="text-[10px] text-destructive">
                       Invisible
                     </Badge>
                   )}
                 </div>
               );
             })}
           </div>
         </div>
 
         {/* Invisible LLMs Warning */}
         {data.invisibleList && data.invisibleList.length > 0 && (
           <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
             <p className="text-sm font-medium text-destructive flex items-center gap-2 mb-2">
               <EyeOff className="h-4 w-4" />
               Non détecté sur {data.invisibleList.length} LLM{data.invisibleList.length > 1 ? 's' : ''}
             </p>
             <div className="flex flex-wrap gap-1">
               {data.invisibleList.map((llm) => (
                 <Badge key={llm.id} variant="outline" className="text-xs text-destructive border-destructive/50">
                   {llm.name}
                 </Badge>
               ))}
             </div>
           </div>
         )}
       </CardContent>
     </Card>
   );
 }