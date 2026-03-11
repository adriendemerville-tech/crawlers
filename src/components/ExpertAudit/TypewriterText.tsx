import { useState, useEffect, useRef } from 'react';

interface TypewriterTextProps {
  text: string;
  speed?: number;
  chunkSize?: number;
  onComplete?: () => void;
  className?: string;
  active?: boolean;
}

export function TypewriterText({
  text,
  speed = 10,
  chunkSize = 2,
  onComplete,
  className,
  active = true,
}: TypewriterTextProps) {
  const [displayedLength, setDisplayedLength] = useState(active ? 0 : text.length);
  const completedRef = useRef(false);

  useEffect(() => {
    if (!active) {
      setDisplayedLength(text.length);
      return;
    }
    if (displayedLength >= text.length) {
      if (!completedRef.current) {
        completedRef.current = true;
        onComplete?.();
      }
      return;
    }
    const timer = setTimeout(() => {
      setDisplayedLength((prev) => Math.min(prev + chunkSize, text.length));
    }, speed);
    return () => clearTimeout(timer);
  }, [displayedLength, text.length, speed, chunkSize, onComplete, active]);

  const isComplete = displayedLength >= text.length;

  return (
    <span className={className}>
      {text.slice(0, displayedLength)}
      {!isComplete && active && (
        <span className="inline-block w-0.5 h-[1em] bg-primary/60 animate-pulse ml-0.5 align-text-bottom" />
      )}
    </span>
  );
}
