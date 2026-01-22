import { useState } from 'react';
import { Check, X, HelpCircle, ChevronDown, ChevronUp, Copy, CheckCheck } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BotResult } from '@/types/crawler';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface BotCardProps {
  bot: BotResult;
}

export function BotCard({ bot }: BotCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const { t } = useLanguage();

  const getStatusIcon = () => {
    switch (bot.status) {
      case 'allowed':
        return <Check className="h-5 w-5" />;
      case 'blocked':
        return <X className="h-5 w-5" />;
      default:
        return <HelpCircle className="h-5 w-5" />;
    }
  };

  const getStatusStyles = () => {
    switch (bot.status) {
      case 'allowed':
        return 'bg-success/10 text-success border-success/20';
      case 'blocked':
        return 'bg-destructive/10 text-destructive border-destructive/20';
      default:
        return 'bg-warning/10 text-warning border-warning/20';
    }
  };

  const getStatusLabel = () => {
    switch (bot.status) {
      case 'allowed':
        return t.results.allowed;
      case 'blocked':
        return t.results.blocked;
      default:
        return t.results.unknown;
    }
  };

  const getAllowSnippet = () => {
    return `User-agent: ${bot.userAgent}\nAllow: /`;
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(getAllowSnippet());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className={cn(
      "card-shadow overflow-hidden transition-all duration-300 hover:card-shadow-lg",
      "animate-fade-in"
    )}>
      <div className="p-5">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">{bot.name}</h3>
            <p className="text-sm text-muted-foreground">{bot.company}</p>
          </div>
          <div className={cn(
            "flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium",
            getStatusStyles()
          )}>
            {getStatusIcon()}
            {getStatusLabel()}
          </div>
        </div>

        {/* Reason */}
        {bot.reason && (
          <div className="mb-4 rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{t.results.reason} :</span> {bot.reason}
            {bot.lineNumber && (
              <span className="ml-1 text-xs opacity-75">({t.results.line} {bot.lineNumber})</span>
            )}
          </div>
        )}

        {/* Fix section for blocked bots */}
        {bot.status === 'blocked' && (
          <div className="border-t border-border pt-4">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex w-full items-center justify-between text-sm font-medium text-primary hover:text-primary/80"
            >
              <span>{t.results.howToFix}</span>
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
            
            {isExpanded && (
              <div className="mt-3 animate-fade-in">
                <p className="mb-2 text-sm text-muted-foreground">
                  {t.results.addToRobots} <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">robots.txt</code> :
                </p>
                <div className="relative rounded-lg bg-foreground/5 p-3">
                  <pre className="text-sm font-mono text-foreground overflow-x-auto">
                    {getAllowSnippet()}
                  </pre>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopy}
                    className="absolute right-2 top-2 h-8 w-8 p-0"
                  >
                    {copied ? (
                      <CheckCheck className="h-4 w-4 text-success" />
                    ) : (
                      <Copy className="h-4 w-4" />
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