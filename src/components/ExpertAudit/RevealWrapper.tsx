import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface RevealWrapperProps {
  delay: number;
  isDataCard?: boolean;
  enabled?: boolean;
  children: React.ReactNode;
}

export function RevealWrapper({
  delay,
  isDataCard = false,
  enabled = true,
  children,
}: RevealWrapperProps) {
  const [visible, setVisible] = useState(!enabled || delay === 0);
  const [dataLoaded, setDataLoaded] = useState(!isDataCard || !enabled);

  useEffect(() => {
    if (!enabled) {
      setVisible(true);
      setDataLoaded(true);
      return;
    }
    if (delay > 0) {
      const timer = setTimeout(() => setVisible(true), delay);
      return () => clearTimeout(timer);
    }
  }, [delay, enabled]);

  useEffect(() => {
    if (visible && isDataCard && enabled && !dataLoaded) {
      const timer = setTimeout(() => setDataLoaded(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [visible, isDataCard, enabled, dataLoaded]);

  if (!visible) return null;

  if (isDataCard && !dataLoaded) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="border border-muted/40">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <Skeleton className="h-5 w-48" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
              <Skeleton className="h-20 rounded-lg" />
              <Skeleton className="h-20 rounded-lg" />
              <Skeleton className="h-20 rounded-lg" />
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={enabled && delay > 0 ? { opacity: 0, y: 20 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {children}
    </motion.div>
  );
}
