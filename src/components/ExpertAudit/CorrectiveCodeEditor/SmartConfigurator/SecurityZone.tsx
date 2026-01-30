import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, ChevronDown, BookOpen, Lock } from 'lucide-react';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { PaymentButton } from './PaymentButton';

interface SecurityZoneProps {
  siteUrl?: string;
  fixesCount?: number;
  sector?: string;
  showPayment?: boolean;
}

export function SecurityZone({ 
  siteUrl = '', 
  fixesCount = 0, 
  sector = 'default',
  showPayment = false 
}: SecurityZoneProps) {
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  return (
    <div className="relative border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4 space-y-4">
      {/* Lock icon in top-right corner */}
      <Lock className="absolute top-3 right-3 w-4 h-4 text-muted-foreground/40" />
      {/* Payment Section - Conditional */}
      {showPayment && siteUrl && (
        <>
          <PaymentButton 
            siteUrl={siteUrl}
            fixesCount={fixesCount}
            sector={sector}
          />
          <Separator className="my-4" />
        </>
      )}

      {/* Security Alert */}
      <Alert className="border-amber-500/50 bg-amber-500/5">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <AlertTitle className="text-amber-600 dark:text-amber-400 text-sm font-semibold">
          Note de sécurité
        </AlertTitle>
        <AlertDescription className="text-xs text-muted-foreground">
          Ce script s'exécute côté client et ne modifie pas votre serveur. 
          Testez toujours en environnement de staging avant la production.
        </AlertDescription>
      </Alert>

      {/* Implementation Guide */}
      <Collapsible open={isGuideOpen} onOpenChange={setIsGuideOpen}>
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Guide d'implémentation</span>
            </div>
            <motion.div
              animate={{ rotate: isGuideOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </motion.div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="pl-8 pr-2 pb-2 space-y-3 text-xs text-muted-foreground">
            <div className="space-y-2">
              <p className="font-medium text-foreground">1. Copiez le code ci-dessus</p>
              <p>Utilisez le bouton "Copier" pour copier le script dans votre presse-papiers.</p>
            </div>

            <div className="space-y-2">
              <p className="font-medium text-foreground">2. Ouvrez votre CMS</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><strong>WordPress :</strong> Apparence → Éditeur de thème → footer.php</li>
                <li><strong>Shopify :</strong> Thème → Modifier le code → theme.liquid</li>
                <li><strong>Wix :</strong> Paramètres → Code personnalisé</li>
                <li><strong>GTM :</strong> Créez une balise "HTML personnalisé"</li>
              </ul>
            </div>

            <div className="space-y-2">
              <p className="font-medium text-foreground">3. Collez le script</p>
              <p>Insérez le code juste avant la balise fermante <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">&lt;/body&gt;</code></p>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2 mt-2">
              <p className="text-blue-700 dark:text-blue-300">
                💡 <strong>Conseil :</strong> Utilisez Google Tag Manager pour une intégration sans toucher au code source.
              </p>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
