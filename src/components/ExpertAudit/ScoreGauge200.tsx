import { motion } from 'framer-motion';

interface ScoreGauge200Props {
  score: number;
  maxScore?: number;
  size?: number;
}

export function ScoreGauge200({ score, maxScore = 200, size = 200 }: ScoreGauge200Props) {
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percentage = score / maxScore;
  const offset = circumference - percentage * circumference;

  const getColor = () => {
    if (score < 100) return 'hsl(var(--destructive))';
    if (score < 150) return 'hsl(var(--warning))';
    return 'hsl(var(--success))';
  };

  const getGradientId = () => {
    if (score < 100) return 'gradient-red';
    if (score < 150) return 'gradient-orange';
    return 'gradient-green';
  };

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="gradient-red" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(0, 84%, 60%)" />
            <stop offset="100%" stopColor="hsl(20, 90%, 50%)" />
          </linearGradient>
          <linearGradient id="gradient-orange" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(35, 92%, 50%)" />
            <stop offset="100%" stopColor="hsl(45, 93%, 47%)" />
          </linearGradient>
          <linearGradient id="gradient-green" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(142, 71%, 45%)" />
            <stop offset="100%" stopColor="hsl(160, 84%, 39%)" />
          </linearGradient>
        </defs>
        
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
          className="opacity-30"
        />
        
        {/* Animated progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${getGradientId()})`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeLinecap="round"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        />
      </svg>
      
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span 
          className="text-5xl font-bold"
          style={{ color: getColor() }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          {score}
        </motion.span>
        <span className="text-lg text-muted-foreground font-medium">/ {maxScore}</span>
      </div>
    </div>
  );
}
