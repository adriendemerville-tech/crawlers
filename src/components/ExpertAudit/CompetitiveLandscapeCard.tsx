import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Crown, Target, Rocket, Sparkles, 
  ExternalLink, Shield, TrendingUp, Pencil
} from 'lucide-react';
import { CompetitiveLandscape, CompetitorActor } from '@/types/expertAudit';
import { MethodologyPopover } from './MethodologyPopover';
import { CompetitorCorrectionModal, CompetitorCorrections } from './CompetitorCorrectionModal';
import { useIsMobile } from '@/hooks/use-mobile';

interface CompetitiveLandscapeCardProps {
  landscape: CompetitiveLandscape;
  onCorrectionSubmit?: (corrections: CompetitorCorrections) => void;
  isReanalyzing?: boolean;
}

function CompetitorCard({ 
  actor, 
  role, 
  icon: Icon,
  accentColor 
}: { 
  actor: CompetitorActor; 
  role: string;
  icon: React.ElementType;
  accentColor: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-4 rounded-lg border-2 ${accentColor} bg-gradient-to-br from-card to-transparent`}
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg bg-background`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="secondary" className="text-xs">
              {role}
            </Badge>
          </div>
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-semibold text-foreground">
              {actor.name}
            </h4>
            <Badge variant="outline" className="text-[10px] shrink-0 gap-1 border-primary/30 text-primary">
              <Shield className="h-2.5 w-2.5" />
              Autorité : {actor.authority_factor}
            </Badge>
          </div>
          {(() => {
            // Build URL: use actor.url if provided, otherwise try to construct from name
            const domainMatch = actor.name.match(/([a-zA-Z0-9-]+\.[a-z]{2,})/);
            let href = (actor.url || '').trim();
            if (!href && domainMatch) href = domainMatch[0];
            if (!href) return null;
            href = href.replace(/^\/+/, '');
            if (!href.startsWith('http://') && !href.startsWith('https://')) {
              href = `https://${href}`;
            }
            try {
              const urlObj = new URL(href);
              return (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors mt-0.5 underline underline-offset-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  {urlObj.hostname.replace('www.', '')}
                  <ExternalLink className="h-3 w-3 flex-shrink-0" />
                </a>
              );
            } catch {
              return null;
            }
          })()}
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            {actor.analysis}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

export function CompetitiveLandscapeCard({ 
  landscape, 
  onCorrectionSubmit,
  isReanalyzing = false 
}: CompetitiveLandscapeCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const isMobile = useIsMobile();

  const handleCorrectionSubmit = (corrections: CompetitorCorrections) => {
    if (onCorrectionSubmit) {
      onCorrectionSubmit(corrections);
    }
    setIsModalOpen(false);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Card className="border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2.5 text-base font-semibold">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
                <TrendingUp className="h-4.5 w-4.5 text-amber-500" />
              </div>
              Écosystème Concurrentiel
              <div className="ml-auto flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsModalOpen(true)}
                  className="gap-1.5 h-7 px-2.5 text-xs font-medium bg-foreground text-background hover:bg-foreground/90 rounded-md shadow-sm"
                >
                  <Pencil className="h-3 w-3" />
                  Corriger
                </Button>
                {/* Hide badge on mobile */}
                {!isMobile && (
                  <Badge variant="outline" className="text-xs text-amber-600 border-amber-500/50">
                    4 Acteurs Analysés
                  </Badge>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {/* Leader (Goliath) */}
            <CompetitorCard 
              actor={landscape.leader}
              role="Leader (Goliath)"
              icon={Crown}
              accentColor="border-amber-500/40"
            />

            {/* Direct Competitor */}
            <CompetitorCard 
              actor={landscape.direct_competitor}
              role="Concurrent Direct"
              icon={Target}
              accentColor="border-blue-500/40"
            />

            {/* Challenger */}
            <CompetitorCard 
              actor={landscape.challenger}
              role="Challenger"
              icon={Rocket}
              accentColor="border-purple-500/40"
            />

            {/* Inspiration Source */}
            <CompetitorCard 
              actor={landscape.inspiration_source}
              role="Source d'Inspiration"
              icon={Sparkles}
              accentColor="border-emerald-500/40"
            />
          <MethodologyPopover variant="competitive_landscape" />
        </CardContent>
        </Card>
      </motion.div>

      {/* Correction Modal */}
      <CompetitorCorrectionModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        landscape={landscape}
        onSubmit={handleCorrectionSubmit}
        isLoading={isReanalyzing}
      />
    </>
  );
}
