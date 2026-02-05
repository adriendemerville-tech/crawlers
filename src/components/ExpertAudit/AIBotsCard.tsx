 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
 import { Badge } from '@/components/ui/badge';
 import { Check, X, HelpCircle, Bot } from 'lucide-react';
 import { cn } from '@/lib/utils';
 import { AIBotResult, CrawlersData } from '@/types/expertAudit';
 import { useLanguage } from '@/contexts/LanguageContext';
 
 interface AIBotsCardProps {
   data: CrawlersData;
 }
 
 const translations = {
   fr: {
     title: 'Bots IA',
     subtitle: 'Accessibilité aux crawlers IA',
     allowed: 'Autorisé',
     blocked: 'Bloqué',
     unknown: 'Inconnu',
     botsAllowed: 'bots autorisés',
     botsBlocked: 'bots bloqués',
   },
   en: {
     title: 'AI Bots',
     subtitle: 'AI crawler accessibility',
     allowed: 'Allowed',
     blocked: 'Blocked',
     unknown: 'Unknown',
     botsAllowed: 'bots allowed',
     botsBlocked: 'bots blocked',
   },
   es: {
     title: 'Bots IA',
     subtitle: 'Accesibilidad de crawlers IA',
     allowed: 'Permitido',
     blocked: 'Bloqueado',
     unknown: 'Desconocido',
     botsAllowed: 'bots permitidos',
     botsBlocked: 'bots bloqueados',
   },
 };
 
 function BotStatusBadge({ bot }: { bot: AIBotResult }) {
   const { language } = useLanguage();
   const t = translations[language] || translations.fr;
 
   const getStatusConfig = () => {
     switch (bot.status) {
       case 'allowed':
         return {
           icon: <Check className="h-3.5 w-3.5" />,
           label: t.allowed,
           className: 'bg-success/10 text-success border-success/20',
         };
       case 'blocked':
         return {
           icon: <X className="h-3.5 w-3.5" />,
           label: t.blocked,
           className: 'bg-destructive/10 text-destructive border-destructive/20',
         };
       default:
         return {
           icon: <HelpCircle className="h-3.5 w-3.5" />,
           label: t.unknown,
           className: 'bg-warning/10 text-warning border-warning/20',
         };
     }
   };
 
   const config = getStatusConfig();
 
   return (
     <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
       <div className="flex flex-col">
         <span className="text-sm font-medium text-foreground">{bot.name}</span>
         <span className="text-xs text-muted-foreground">{bot.company}</span>
       </div>
       <div
         className={cn(
           'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
           config.className
         )}
       >
         {config.icon}
         {config.label}
       </div>
     </div>
   );
 }
 
 export function AIBotsCard({ data }: AIBotsCardProps) {
   const { language } = useLanguage();
   const t = translations[language] || translations.fr;
 
   const percentage = data.bots.length > 0 
     ? Math.round((data.allowedCount / data.bots.length) * 100) 
     : 0;
 
   const getScoreColor = () => {
     if (percentage >= 80) return 'text-success';
     if (percentage >= 50) return 'text-warning';
     return 'text-destructive';
   };
 
   const getProgressColor = () => {
     if (percentage >= 80) return 'bg-success';
     if (percentage >= 50) return 'bg-warning';
     return 'bg-destructive';
   };
 
   return (
     <Card className="overflow-hidden">
       <CardHeader className="pb-3">
         <div className="flex items-center justify-between">
           <CardTitle className="text-base flex items-center gap-2">
             <span className="text-primary">
               <Bot className="h-5 w-5" />
             </span>
             {t.title}
           </CardTitle>
           <Badge variant="outline" className={cn('text-sm font-bold', getScoreColor())}>
             {data.allowedCount}/{data.bots.length}
           </Badge>
         </div>
         <p className="text-xs text-muted-foreground mt-1">{t.subtitle}</p>
         <div className="relative h-2 mt-2 bg-muted rounded-full overflow-hidden">
           <div
             className={cn('h-full transition-all duration-500 rounded-full', getProgressColor())}
             style={{ width: `${percentage}%` }}
           />
         </div>
       </CardHeader>
       <CardContent className="space-y-0 pt-0">
         {/* Summary badges */}
         <div className="flex gap-3 mb-3 pb-3 border-b border-border/50">
           <div className="flex items-center gap-1.5 text-xs">
             <div className="h-2 w-2 rounded-full bg-success" />
             <span className="text-success font-medium">{data.allowedCount}</span>
             <span className="text-muted-foreground">{t.botsAllowed}</span>
           </div>
           <div className="flex items-center gap-1.5 text-xs">
             <div className="h-2 w-2 rounded-full bg-destructive" />
             <span className="text-destructive font-medium">{data.blockedCount}</span>
             <span className="text-muted-foreground">{t.botsBlocked}</span>
           </div>
         </div>
 
         {/* Bot list */}
         <div className="space-y-0">
           {data.bots.map((bot) => (
             <BotStatusBadge key={bot.name} bot={bot} />
           ))}
         </div>
       </CardContent>
     </Card>
   );
 }