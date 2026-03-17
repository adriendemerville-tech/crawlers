import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { Smile, ChevronDown, BookOpen } from 'lucide-react';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { PaymentButton } from './PaymentButton';
import type { FixConfig } from './types';

interface SecurityZoneProps {
  siteUrl?: string;
  showPayment?: boolean;
  calculatedPrice?: number;
  fixConfigs?: FixConfig[];
  generatedCode?: string;
  onUnlockWithCredit?: () => void;
}

export function SecurityZone({ 
  siteUrl = '', 
  showPayment = false,
  calculatedPrice = 3,
  fixConfigs = [],
  generatedCode = '',
  onUnlockWithCredit
}: SecurityZoneProps) {
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  return (
    <div className="relative border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4 space-y-4">
      {/* Payment Section - Conditional - Fully centered */}
      {showPayment && siteUrl && (
        <div className="w-full flex items-center justify-center">
          <PaymentButton 
            siteUrl={siteUrl}
            calculatedPrice={calculatedPrice}
            fixConfigs={fixConfigs}
            generatedCode={generatedCode}
            onUnlockWithCredit={onUnlockWithCredit}
          />
        </div>
      )}

      {showPayment && siteUrl && (
        <>
          <Separator className="my-4" />
        </>
      )}

      {/* Security Note - Simple inline */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Smile className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
        <span>Pas de panique : Ce script s'exécutera uniquement côté client et ne modifiera pas votre serveur.</span>
      </div>

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
            {/* WordPress Plugin — top priority */}
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-2.5 space-y-1.5">
              <p className="font-medium text-foreground flex items-center gap-1.5">⚡ WordPress — Installation zéro code</p>
              <ol className="list-decimal list-inside space-y-1 ml-1">
                <li>Allez dans <strong>Mon Profil → Mes Sites</strong> et ajoutez votre domaine.</li>
                <li>Téléchargez le plugin, installez-le sur votre WordPress (<strong>Extensions → Ajouter</strong>).</li>
                <li>Utilisez le <strong>Lien Magique</strong> pour connecter automatiquement le plugin — aucune clé à copier.</li>
                <li>Revenez ici et cliquez sur <strong>Injecter ⚡</strong> : les correctifs sont synchronisés instantanément.</li>
              </ol>
            </div>

            <div className="space-y-2">
              <p className="font-medium text-foreground">1. Copiez le code ci-dessus</p>
              <p>Utilisez le bouton "Copier" pour copier le script dans votre presse-papiers.</p>
            </div>

            <div className="space-y-2">
              <p className="font-medium text-foreground">2. Ouvrez votre CMS</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><strong>Shopify :</strong> Thème → Modifier le code → theme.liquid</li>
                <li><strong>Wix :</strong> Paramètres → Code personnalisé</li>
                <li><strong>GTM :</strong> Créez une balise "HTML personnalisé"</li>
              </ul>
            </div>

            <div className="space-y-2">
              <p className="font-medium text-foreground">3. Collez le script</p>
              <p>Insérez le code juste avant la balise fermante <code className="bg-muted px-1 rounded">&lt;/body&gt;</code></p>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2 mt-2">
              <p className="text-blue-700 dark:text-blue-300">
                <strong>Conseil :</strong> Utilisez Google Tag Manager pour une intégration sans toucher au code source.
              </p>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 mt-2">
              <p className="text-amber-700 dark:text-amber-300">
                <strong>🔄 Rollback :</strong> Vous pouvez annuler la dernière injection à tout moment depuis <strong>Console → Mes Codes</strong> en cliquant sur le bouton « Rollback ». La configuration précédente sera restaurée instantanément. Vous pouvez aussi <strong>tester l'injection</strong> en un clic pour vérifier que le script est bien déployé sur vos pages.
              </p>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
