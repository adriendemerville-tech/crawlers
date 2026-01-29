import { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ScrollArea } from '@/components/ui/scroll-area';

interface CodeBlockProps {
  code: string;
  isTyping: boolean;
  placeholder?: string;
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

export function CodeBlock({ code, isTyping, placeholder }: CodeBlockProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom while typing
  useEffect(() => {
    if (isTyping && scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [code, isTyping]);

  if (!code) {
    return (
      <div className="h-[300px] bg-muted/30 rounded-lg border border-dashed border-muted-foreground/30 flex items-center justify-center">
        <p className="text-muted-foreground text-sm">{placeholder}</p>
      </div>
    );
  }

  const lines = code.split('\n');
  const highlightedCode = highlightSyntax(code);
  const highlightedLines = highlightedCode.split('\n');

  return (
    <div className="relative h-[300px] rounded-lg overflow-hidden border bg-background" ref={scrollRef}>
      {/* Line numbers gutter */}
      <ScrollArea className="h-full">
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
              {isTyping && (
                <motion.span
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ repeat: Infinity, duration: 0.8 }}
                  className="inline-block w-2 h-4 bg-primary ml-0.5 align-middle"
                />
              )}
            </pre>
          </div>
        </div>
      </ScrollArea>

      {/* Typing indicator */}
      {isTyping && (
        <div className="absolute bottom-2 right-2">
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 1 }}
            className="flex items-center gap-1.5 bg-primary/20 text-primary px-2 py-1 rounded-full text-xs"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-primary" style={{ animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />
            Génération...
          </motion.div>
        </div>
      )}
    </div>
  );
}
