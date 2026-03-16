import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Users, MessageCircle, Linkedin, Twitter, 
  Youtube, AlertTriangle, CheckCircle2, 
  XCircle, Brain, Shield, TrendingUp, ExternalLink, Instagram
} from 'lucide-react';
import { SocialSignals, SocialProofSource } from '@/types/expertAudit';
import { MethodologyPopover } from './MethodologyPopover';

interface SocialSignalsCardProps {
  signals: SocialSignals;
}

function PlatformIcon({ platform }: { platform: string }) {
  switch (platform) {
    case 'reddit': return <MessageCircle className="h-4 w-4 text-orange-500" />;
    case 'x': return <Twitter className="h-4 w-4 text-sky-500" />;
    case 'linkedin': return <Linkedin className="h-4 w-4 text-blue-600" />;
    case 'youtube': return <Youtube className="h-4 w-4 text-red-500" />;
    case 'instagram': return <Instagram className="h-4 w-4 text-pink-500" />;
    default: return <Users className="h-4 w-4 text-muted-foreground" />;
  }
}

function PresenceBadge({ level }: { level: string }) {
  const config = {
    strong: { color: 'bg-success/10 text-success border-success/30', label: 'Fort' },
    moderate: { color: 'bg-warning/10 text-warning border-warning/30', label: 'Modéré' },
    weak: { color: 'bg-orange-500/10 text-orange-500 border-orange-500/30', label: 'Faible' },
    absent: { color: 'bg-destructive/10 text-destructive border-destructive/30', label: 'Absent' },
  };
  const c = config[level as keyof typeof config] || config.absent;
  return <Badge variant="outline" className={`text-xs ${c.color}`}>{c.label}</Badge>;
}

function PlatformLabel({ platform }: { platform: string }) {
  const labels: Record<string, string> = {
    reddit: 'Reddit',
    x: 'X (Twitter)',
    linkedin: 'LinkedIn',
    youtube: 'YouTube',
    instagram: 'Instagram',
  };
  return <>{labels[platform] || platform}</>;
}

export function SocialSignalsCard({ signals }: SocialSignalsCardProps) {
  const getPolarityConfig = (polarity: string) => {
    switch (polarity) {
      case 'positive': return { color: 'text-success', icon: CheckCircle2, label: 'Positive' };
      case 'mostly_positive': return { color: 'text-emerald-500', icon: CheckCircle2, label: 'Majoritairement Positive' };
      case 'neutral': return { color: 'text-muted-foreground', icon: AlertTriangle, label: 'Neutre' };
      case 'mixed': return { color: 'text-warning', icon: AlertTriangle, label: 'Mixte' };
      case 'negative': return { color: 'text-destructive', icon: XCircle, label: 'Négative' };
      default: return { color: 'text-muted-foreground', icon: AlertTriangle, label: polarity };
    }
  };

  const getHallucinationRisk = (risk: string) => {
    switch (risk) {
      case 'low': return { color: 'bg-success/10 text-success', label: 'Faible' };
      case 'medium': return { color: 'bg-warning/10 text-warning', label: 'Moyen' };
      case 'high': return { color: 'bg-destructive/10 text-destructive', label: 'Élevé' };
      default: return { color: 'bg-muted text-muted-foreground', label: risk };
    }
  };

  const polarityConfig = getPolarityConfig(signals.sentiment?.overall_polarity || 'neutral');
  const hallucinationConfig = getHallucinationRisk(signals.sentiment?.hallucination_risk || 'medium');
  const PolarityIcon = polarityConfig.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.25 }}
    >
      <Card className="border border-violet-500/20 bg-gradient-to-br from-violet-500/5 to-transparent">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2.5 text-base font-semibold">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10">
              <Users className="h-4.5 w-4.5 text-violet-500" />
            </div>
            Autorité Sociale & Humaine
            <Badge variant="outline" className="ml-auto text-xs text-violet-600 border-violet-500/50">
              Signaux Off-Site
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Social Proof Sources — filter out LinkedIn if geo mismatch */}
          {signals.proof_sources && signals.proof_sources.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1">
                <MessageCircle className="h-3 w-3" />
                Preuve Sociale par Plateforme
              </p>
              {signals.founder_geo_mismatch && (
                <div className="mb-3 p-2.5 rounded-lg bg-warning/10 border border-warning/30 text-xs text-warning flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>Un dirigeant homonyme a été détecté dans un autre pays — les données LinkedIn ont été exclues pour éviter toute confusion.</span>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {signals.proof_sources
                  .filter(source => !(signals.founder_geo_mismatch && source.platform === 'linkedin' && source.presence_level !== 'absent'))
                  .map((source, index) => (
                  <div 
                    key={index}
                    className="p-4 rounded-lg bg-muted/50 border border-border"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <PlatformIcon platform={source.platform} />
                      <span className="text-sm font-medium">
                        <PlatformLabel platform={source.platform} />
                      </span>
                      <div className="ml-auto">
                        <PresenceBadge level={source.presence_level} />
                      </div>
                    </div>
                    
                    {/* Profile link */}
                    {source.profile_url && (
                      <a 
                        href={source.profile_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="mt-1 flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 hover:underline transition-colors"
                      >
                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">
                          {source.profile_name || 'Voir le profil'}
                        </span>
                      </a>
                    )}
                    
                    {source.analysis && (
                      <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                        {source.analysis}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Thought Leadership */}
          {signals.thought_leadership && (
            <div className="pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1">
                <Brain className="h-3 w-3" />
                Thought Leadership (E-E-A-T)
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Score E-E-A-T</span>
                    <span className="text-lg font-bold text-foreground">
                      {signals.thought_leadership.eeat_score}<span className="text-sm text-muted-foreground">/10</span>
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Reconnaissance Entité</p>
                  <p className="text-sm text-foreground bg-muted/50 p-2 rounded">
                    {signals.thought_leadership.entity_recognition}
                  </p>
                </div>
              </div>
              {signals.thought_leadership.analysis && (
                <p className="text-sm text-muted-foreground mt-3 italic border-l-2 border-violet-500/30 pl-3">
                  {signals.thought_leadership.analysis}
                </p>
              )}
            </div>
          )}

          {/* Sentiment Analysis */}
          {signals.sentiment && (
            <div className="pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1">
                <Shield className="h-3 w-3" />
                Sentiment & Polarité
              </p>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">Polarité Globale</p>
                  <div className={`flex items-center gap-2 ${polarityConfig.color}`}>
                    <PolarityIcon className="h-4 w-4" />
                    <span className="font-medium">{polarityConfig.label}</span>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">Risque d'Hallucination</p>
                  <Badge variant="outline" className={hallucinationConfig.color}>
                    {hallucinationConfig.label}
                  </Badge>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 md:col-span-1">
                  <p className="text-xs text-muted-foreground mb-1">Vibration Réputation</p>
                  <p className="text-sm text-foreground line-clamp-2">
                    {signals.sentiment.reputation_vibration}
                  </p>
                </div>
              </div>
            </div>
          )}
          <MethodologyPopover variant="social_signals" />
        </CardContent>
      </Card>
    </motion.div>
  );
}
