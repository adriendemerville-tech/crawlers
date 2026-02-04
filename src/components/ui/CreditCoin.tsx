import { Bot } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CreditCoinProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: { container: 'w-4 h-4', icon: 'w-2.5 h-2.5' },
  md: { container: 'w-5 h-5', icon: 'w-3 h-3' },
  lg: { container: 'w-6 h-6', icon: 'w-4 h-4' },
};

export function CreditCoin({ size = 'md', className }: CreditCoinProps) {
  const sizes = sizeMap[size];
  
  return (
    <span 
      className={cn(
        "inline-flex items-center justify-center rounded-full shrink-0",
        "bg-gradient-to-br from-amber-400 via-yellow-400 to-amber-500",
        "shadow-[inset_0_2px_4px_rgba(255,255,255,0.4),inset_0_-2px_4px_rgba(0,0,0,0.1),0_1px_2px_rgba(0,0,0,0.2)]",
        "border-2 border-amber-300",
        "relative overflow-hidden",
        sizes.container,
        className
      )}
      aria-hidden="true"
    >
      {/* Metallic shine effect */}
      <span className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/30 to-transparent" />
      {/* Bot icon */}
      <Bot className={cn(sizes.icon, "text-amber-700 relative z-10 drop-shadow-sm")} strokeWidth={2.5} />
    </span>
  );
}
