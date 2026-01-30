import { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Lock } from 'lucide-react';
import { useRadixScrollStickToBottom } from './useRadixScrollStickToBottom';

interface CodeBlockProps {
  code: string;
  isTyping: boolean;
  placeholder?: string;
  isLocked?: boolean;
  previewLines?: number;
}

// Syntax highlighting for JavaScript
function highlightSyntax(code: string): string {
  if (!code) return '';
  
  // Escape HTML first
  let highlighted = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Keywords (violet/purple)
  highlighted = highlighted.replace(
    /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|try|catch|finally|throw|new|this|typeof|instanceof|void|delete|in|of|class|extends|super|import|export|default|async|await|null|undefined|true|false)\b/g,
    '<span class="text-violet-500 dark:text-violet-400">$1</span>'
  );

  // Strings (green)
  highlighted = highlighted.replace(
    /(["'`])(?:(?!\1)[^\\]|\\.)*?\1/g,
    '<span class="text-emerald-600 dark:text-emerald-400">$&</span>'
  );

  // Comments (gray)
  highlighted = highlighted.replace(
    /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)/g,
    '<span class="text-muted-foreground italic">$1</span>'
  );

  // Numbers (orange)
  highlighted = highlighted.replace(
    /\b(\d+\.?\d*)\b/g,
    '<span class="text-orange-500 dark:text-orange-400">$1</span>'
  );

  // Function calls (purple)
  highlighted = highlighted.replace(
    /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g,
    '<span class="text-purple-500 dark:text-purple-400">$1</span>('
  );

  // Properties after dot (violet lighter)
  highlighted = highlighted.replace(
    /\.([a-zA-Z_$][a-zA-Z0-9_$]*)/g,
    '.<span class="text-violet-400 dark:text-violet-300">$1</span>'
  );

  // HTML tags in strings (red)
  highlighted = highlighted.replace(
    /(&lt;\/?)([a-zA-Z][a-zA-Z0-9]*)/g,
    '$1<span class="text-rose-500 dark:text-rose-400">$2</span>'
  );

  return highlighted;
}

export function CodeBlock({ 
  code, 
  isTyping, 
  placeholder,
  isLocked = false,
  previewLines = 25
}: CodeBlockProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [displayedCode, setDisplayedCode] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationComplete, setAnimationComplete] = useState(false);
  const prevRawCodeRef = useRef<string>('');

  // Get the code to display (truncated if locked)
  const codeToDisplay = isLocked 
    ? code.split('\n').slice(0, previewLines).join('\n') + '\n\n// ... Code verrouillé - Effectuez le paiement pour accéder au script complet ...'
    : code;

  // Typing animation effect
  // Important: ONLY animate when the *raw code* changes.
  // When the lock toggles (isLocked), we must NOT restart the animation from line 1.
  useEffect(() => {
    if (!codeToDisplay) {
      prevRawCodeRef.current = '';
      setDisplayedCode('');
      setIsAnimating(false);
      setAnimationComplete(false);
      return;
    }

    const rawChanged = code !== prevRawCodeRef.current;

    // If only lock state changed (same raw code), swap view instantly without re-animating.
    if (!rawChanged) {
      if (!isAnimating && displayedCode !== codeToDisplay) {
        setDisplayedCode(codeToDisplay);
      }
      return;
    }

    prevRawCodeRef.current = code;

    setIsAnimating(true);
    setAnimationComplete(false);
    let currentIndex = 0;
    const lines = codeToDisplay.split('\n');
    const totalLines = lines.length;

    // Animation rapide: afficher ligne par ligne
    const interval = setInterval(() => {
      currentIndex += 3; // 3 lignes à la fois pour aller vite
      if (currentIndex >= totalLines) {
        setDisplayedCode(codeToDisplay);
        setIsAnimating(false);
        // Attendre plus longtemps après la fin du code avant d'afficher le verrou
        setTimeout(() => setAnimationComplete(true), 1200);
        clearInterval(interval);
      } else {
        setDisplayedCode(lines.slice(0, currentIndex).join('\n'));
      }
    }, 25); // 25ms entre chaque batch de lignes

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // If the lock state (or previewLines) changes WITHOUT a new generated code,
  // swap the displayed content instantly (no re-typing from line 1).
  useEffect(() => {
    if (!codeToDisplay) return;
    if (isAnimating) return;
    if (displayedCode === codeToDisplay) return;
    setDisplayedCode(codeToDisplay);
  }, [codeToDisplay, isAnimating, displayedCode]);

  // Keep Radix viewport pinned to bottom during generation + lock overlay.
  // This also survives late reflows (e.g. payment banner / animations in the modal).
  useRadixScrollStickToBottom({
    containerRef: scrollRef,
    // Important: in the Architecte modal, late reflows (overlay/blur/security footer)
    // can still happen after the typing animation ends; keep pinning after completion.
    enabled: isAnimating || isTyping || isLocked || animationComplete,
  });

  if (!code) {
    return (
      <div className="h-full min-h-[200px] bg-muted/30 rounded-lg border border-dashed border-muted-foreground/30 flex items-center justify-center">
        <p className="text-muted-foreground text-sm">{placeholder}</p>
      </div>
    );
  }

  const lines = displayedCode.split('\n');
  const highlightedCode = highlightSyntax(displayedCode);
  const totalLines = code.split('\n').length;

  // Show lock overlay only when animation is complete AND isLocked is true
  const showLockOverlay = isLocked && animationComplete;

  return (
    <div className="relative h-full min-h-[200px] rounded overflow-hidden border bg-background flex flex-col" ref={scrollRef}>
      {/* Scrollable code area */}
      <ScrollArea className="flex-1">
        <div className="flex">
          {/* Line numbers */}
          <div className="flex-shrink-0 py-3 px-2 bg-muted/50 select-none border-r border-border">
            {lines.map((_, i) => (
              <div
                key={i}
                className="text-xs text-muted-foreground text-right pr-2 leading-5 font-mono"
                style={{ minWidth: '2.5rem' }}
              >
                {i + 1}
              </div>
            ))}
          </div>

          {/* Code content */}
          <div className="flex-1 py-3 px-4 overflow-x-auto bg-card">
            <pre className="text-xs leading-5 font-mono">
              <code 
                dangerouslySetInnerHTML={{ __html: highlightedCode }}
                className="text-foreground"
              />
              {/* Cursor animation while typing */}
              {(isTyping || isAnimating) && (
                <motion.span
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ repeat: Infinity, duration: 0.5 }}
                  className="inline-block w-2 h-4 bg-primary ml-0.5 align-middle"
                />
              )}
            </pre>
          </div>
        </div>
      </ScrollArea>

      {/* Lock overlay - positioned fixed at bottom of visible area */}
      {showLockOverlay && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          className="absolute inset-x-0 bottom-0 h-2/3 flex flex-col items-center justify-end pb-8 pointer-events-none"
          style={{ zIndex: 10 }}
        >
          {/* Gray gradient blur overlay - from bottom to top */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-400/98 via-slate-400/85 to-transparent dark:from-slate-600/98 dark:via-slate-600/85" />
          
          {/* Padlock */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6, duration: 0.5, ease: 'easeOut' }}
            className="relative z-10"
          >
            <Lock className="w-6 h-6 text-violet-500" strokeWidth={1.5} />
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
