import { motion } from 'framer-motion';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Rocket, FileText, Brain, Zap, Crown } from 'lucide-react';
import { FixConfig } from './types';

interface GenerativeTabProps {
  fixes: FixConfig[];
  onToggle: (fixId: string) => void;
  onUpdateData: (fixId: string, data: Record<string, any>) => void;
}

const GENERATIVE_ICONS: Record<string, React.ReactNode> = {
  fix_missing_blog: <FileText className="w-4 h-4" />,
  fix_semantic_injection: <Brain className="w-4 h-4" />,
  fix_robot_context: <Brain className="w-4 h-4" />,
  fix_pagespeed_suite: <Zap className="w-4 h-4" />,
};

export function GenerativeTab({ fixes, onToggle }: GenerativeTabProps) {
  const generativeFixes = fixes.filter(f => f.category === 'generative');

  if (generativeFixes.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Rocket className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p>Aucune super-capacité disponible</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <Rocket className="w-5 h-5 text-emerald-500" />
        <h3 className="font-semibold text-sm">Super-Capacités Génératives</h3>
        <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
          <Crown className="w-3 h-3 mr-1" />
          Premium
        </Badge>
      </div>

      {generativeFixes.map((fix, index) => (
        <motion.div
          key={fix.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          layout
          transition={{ delay: index * 0.05 }}
          className={`rounded-lg border transition-all ${
            fix.enabled 
              ? 'p-4 border-emerald-500/50 bg-emerald-500/5 shadow-sm' 
              : 'p-2 px-3 border-border hover:border-emerald-500/30'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1">
              {fix.enabled && (
                <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-600">
                  {GENERATIVE_ICONS[fix.id] || <Rocket className="w-4 h-4" />}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm ${fix.enabled ? 'font-medium' : 'text-muted-foreground'}`}>{fix.label}</span>
                  {fix.isPremium && fix.enabled && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-600 border-amber-500/30">
                      💎
                    </Badge>
                  )}
                </div>
                {fix.enabled && (
                  <p className="text-xs text-muted-foreground mt-0.5">{fix.description}</p>
                )}
              </div>
            </div>
            <Switch
              checked={fix.enabled}
              onCheckedChange={() => onToggle(fix.id)}
              className="data-[state=checked]:bg-emerald-500"
            />
          </div>
        </motion.div>
      ))}

      <div className="mt-4 p-3 rounded-lg bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20">
        <p className="text-xs text-emerald-700 dark:text-emerald-300">
          🚀 <strong>Super-Capacités</strong> : Ces fonctionnalités avancées injectent des sections complètes et optimisées pour le SEO et les LLMs.
        </p>
      </div>
    </div>
  );
}
