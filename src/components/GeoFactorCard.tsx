import { Check, X, AlertTriangle, ChevronDown, ChevronUp, Copy, CheckCheck } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { GeoFactor } from '@/types/geo';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface GeoFactorCardProps {
  factor: GeoFactor;
}

export function GeoFactorCard({ factor }: GeoFactorCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const getStatusIcon = () => {
    switch (factor.status) {
      case 'good':
        return <Check className="h-5 w-5" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5" />;
      case 'error':
        return <X className="h-5 w-5" />;
    }
  };

  const getStatusStyles = () => {
    switch (factor.status) {
      case 'good':
        return 'bg-success/10 text-success border-success/20';
      case 'warning':
        return 'bg-warning/10 text-warning border-warning/20';
      case 'error':
        return 'bg-destructive/10 text-destructive border-destructive/20';
    }
  };

  const getProgressColor = () => {
    const percentage = (factor.score / factor.maxScore) * 100;
    if (percentage >= 80) return 'bg-success';
    if (percentage >= 50) return 'bg-warning';
    return 'bg-destructive';
  };

  const handleCopy = async () => {
    if (factor.recommendation) {
      await navigator.clipboard.writeText(factor.recommendation);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Card className="overflow-hidden card-shadow animate-fade-in">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground">{factor.name}</h3>
              <div className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full border",
                getStatusStyles()
              )}>
                {getStatusIcon()}
              </div>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{factor.description}</p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold text-foreground">{factor.score}</span>
            <span className="text-sm text-muted-foreground">/{factor.maxScore}</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div 
            className={cn("h-full rounded-full transition-all duration-500", getProgressColor())}
            style={{ width: `${(factor.score / factor.maxScore) * 100}%` }}
          />
        </div>

        {/* Details */}
        {factor.details && (
          <p className="mt-3 text-xs text-muted-foreground font-mono bg-muted/50 px-2 py-1 rounded">
            {factor.details}
          </p>
        )}

        {/* Recommendation */}
        {factor.recommendation && (
          <div className="mt-3 border-t border-border pt-3">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex w-full items-center justify-between text-sm font-medium text-primary hover:text-primary/80"
            >
              <span>How to improve</span>
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
            
            {isExpanded && (
              <div className="mt-3 animate-fade-in">
                <div className="relative rounded-lg bg-primary/5 border border-primary/10 p-3">
                  <p className="text-sm text-foreground pr-8">
                    {factor.recommendation}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopy}
                    className="absolute right-2 top-2 h-7 w-7 p-0"
                  >
                    {copied ? (
                      <CheckCheck className="h-3.5 w-3.5 text-success" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
