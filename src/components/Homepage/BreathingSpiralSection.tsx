import { memo, useEffect, useRef, useState, useCallback } from 'react';
import { motion, useInView } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Activity, BarChart3, Sun, Cloud, Calendar, Newspaper } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { t3 } from '@/utils/i18n';

/* ─── Interactive Spiral Canvas ─── */
const SpiralCanvas = memo(() => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const [events, setEvents] = useState<Array<{ label: string; icon: string; x: number; y: number; opacity: number; birth: number }>>([]);
  const timeRef = useRef(0);
  const eventTimerRef = useRef(0);

  const EVENT_TYPES = [
    { label: 'GSC +12%', icon: '📊' },
    { label: 'GA4 bounce ↑', icon: '📈' },
    { label: 'Saisonnalité', icon: '🗓️' },
    { label: 'Météo 32°C', icon: '☀️' },
    { label: 'Actualité SEO', icon: '📰' },
    { label: 'Concurrent ↑', icon: '⚡' },
    { label: 'CWV alert', icon: '🔴' },
    { label: 'Backlink lost', icon: '🔗' },
  ];

  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => {
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h / 2;

    // Breathing effect — slow pulsation
    const breathe = Math.sin(t * 0.4) * 0.15 + 1;
    // Contract when events are recent
    const hasRecentEvents = events.some(e => (t - e.birth) < 2);
    const contractFactor = hasRecentEvents ? 0.82 : 1;
    const scale = breathe * contractFactor;

    // Draw spiral arms
    const arms = 3;
    const maxRadius = Math.min(w, h) * 0.38;

    for (let arm = 0; arm < arms; arm++) {
      const armOffset = (arm / arms) * Math.PI * 2;
      ctx.beginPath();

      for (let i = 0; i <= 200; i++) {
        const progress = i / 200;
        const angle = progress * Math.PI * 6 + t * 0.3 + armOffset;
        const radius = progress * maxRadius * scale;

        // Spiral point
        const x = cx + Math.cos(angle) * radius;
        const y = cy + Math.sin(angle) * radius;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      // Gradient stroke
      const gradient = ctx.createLinearGradient(cx - maxRadius, cy, cx + maxRadius, cy);
      gradient.addColorStop(0, `hsla(260, 80%, 65%, ${0.1 + arm * 0.1})`);
      gradient.addColorStop(0.5, `hsla(280, 70%, 55%, ${0.4 + arm * 0.1})`);
      gradient.addColorStop(1, `hsla(200, 80%, 60%, ${0.2 + arm * 0.1})`);

      ctx.strokeStyle = gradient;
      ctx.lineWidth = 2 - arm * 0.3;
      ctx.stroke();
    }

    // Draw center glow
    const glowRadius = 20 * scale;
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius);
    glow.addColorStop(0, hasRecentEvents ? 'hsla(30, 100%, 60%, 0.8)' : 'hsla(260, 80%, 70%, 0.6)');
    glow.addColorStop(0.5, hasRecentEvents ? 'hsla(30, 100%, 50%, 0.3)' : 'hsla(260, 80%, 60%, 0.2)');
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    // Draw orbiting dots (priorities)
    const dotCount = 8;
    for (let i = 0; i < dotCount; i++) {
      const dotProgress = (i / dotCount);
      const dotAngle = dotProgress * Math.PI * 4 + t * 0.5;
      const dotRadius = dotProgress * maxRadius * scale * 0.9;
      const x = cx + Math.cos(dotAngle) * dotRadius;
      const y = cy + Math.sin(dotAngle) * dotRadius;
      const size = 2 + (1 - dotProgress) * 3;

      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${260 + i * 15}, 70%, 65%, ${0.4 + dotProgress * 0.5})`;
      ctx.fill();
    }

    // Draw event bubbles
    events.forEach(ev => {
      const age = t - ev.birth;
      if (age > 3) return;
      const fadeOut = age > 2 ? 1 - (age - 2) : 1;
      const moveUp = age * 15;

      ctx.font = '14px system-ui';
      ctx.fillStyle = `rgba(255,255,255,${fadeOut * 0.9})`;
      ctx.fillText(ev.icon + ' ' + ev.label, ev.x, ev.y - moveUp);
    });
  }, [events]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const w = rect.width;
    const h = rect.height;

    let running = true;

    const animate = () => {
      if (!running) return;
      timeRef.current += 0.016;
      eventTimerRef.current += 0.016;

      // Spawn a new event every ~2.5 seconds
      if (eventTimerRef.current > 2.5) {
        eventTimerRef.current = 0;
        const evType = EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)];
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.min(w, h) * 0.3 + Math.random() * 40;
        setEvents(prev => [
          ...prev.filter(e => (timeRef.current - e.birth) < 3.5),
          {
            ...evType,
            x: w / 2 + Math.cos(angle) * radius,
            y: h / 2 + Math.sin(angle) * radius,
            opacity: 1,
            birth: timeRef.current,
          },
        ]);
      }

      draw(ctx, w, h, timeRef.current);
      animRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      running = false;
      cancelAnimationFrame(animRef.current);
    };
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ width: '100%', height: '100%' }}
    />
  );
});
SpiralCanvas.displayName = 'SpiralCanvas';

/* ─── Signal Pill ─── */
const SignalPill = ({ icon: Icon, label, delay }: { icon: any; label: string; delay: number }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.8 }}
    whileInView={{ opacity: 1, scale: 1 }}
    viewport={{ once: true }}
    transition={{ duration: 0.5, delay }}
    className="flex items-center gap-2 rounded-full border border-border/50 bg-card/60 backdrop-blur-sm px-3 py-1.5 text-xs font-medium text-muted-foreground"
  >
    <Icon className="h-3.5 w-3.5 text-primary" />
    {label}
  </motion.div>
);

/* ─── Main Section ─── */
export const BreathingSpiralSection = memo(() => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });
  const { language } = useLanguage();

  return (
    <section
      ref={ref}
      className="relative py-20 sm:py-28 overflow-hidden border-b border-border"
    >
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-violet-950/10 to-background" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.06),transparent_70%)]" />

      <div className="relative container mx-auto px-4">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">

          {/* ─── Left: Animated Spiral ─── */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={inView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 1, ease: 'easeOut' }}
            className="w-full lg:w-1/2 aspect-square max-w-[480px] relative"
          >
            {/* Outer glow ring */}
            <div className="absolute inset-[-20px] rounded-full bg-gradient-to-br from-violet-500/10 via-transparent to-cyan-500/10 blur-2xl" />

            <div className="relative w-full h-full rounded-2xl border border-border/30 bg-card/20 backdrop-blur-sm overflow-hidden">
              <SpiralCanvas />

              {/* Overlay label */}
              <div className="absolute bottom-4 left-4 right-4 text-center">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-medium">
                  {t3(language, 'Visualisation temps réel', 'Real-time visualization', 'Visualización en tiempo real')}
                </span>
              </div>
            </div>
          </motion.div>

          {/* ─── Right: Copy ─── */}
          <div className="flex-1 space-y-6 max-w-xl">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-violet-400"
            >
              <Activity className="h-3.5 w-3.5" />
              {t3(language, 'Innovation de rupture', 'Breakthrough Innovation', 'Innovación disruptiva')}
            </motion.div>

            {/* Title */}
            <motion.h2
              initial={{ opacity: 0, y: 15 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="text-3xl md:text-4xl lg:text-[2.75rem] font-extrabold tracking-tight leading-[1.15]"
            >
              <span className="text-foreground">Breathing Spiral</span>
              <br />
              <span className="bg-gradient-to-r from-violet-400 via-primary to-cyan-400 bg-clip-text text-transparent">
                {t3(language,
                  'l\'algorithme qui respire au rythme de votre marché',
                  'the algorithm that breathes with your market',
                  'el algoritmo que respira al ritmo de su mercado'
                )}
              </span>
            </motion.h2>

            {/* Description */}
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.45 }}
              className="text-muted-foreground leading-relaxed text-base"
            >
              {t3(language,
                'Fini les listes de tâches statiques. La Breathing Spiral recalcule en continu vos priorités SEO et GEO en intégrant les signaux réels de votre écosystème : données Google Search Console, Analytics, saisonnalité, météo, actualités sectorielles et mouvements concurrentiels. Chaque signal contracte ou dilate la spirale — les tâches les plus urgentes remontent automatiquement au centre.',
                'No more static task lists. The Breathing Spiral continuously recalculates your SEO and GEO priorities by integrating real signals from your ecosystem: Google Search Console data, Analytics, seasonality, weather, sector news, and competitive movements. Each signal contracts or expands the spiral — the most urgent tasks automatically rise to the center.',
                'Se acabaron las listas de tareas estáticas. La Breathing Spiral recalcula continuamente sus prioridades SEO y GEO integrando señales reales de su ecosistema: datos de Google Search Console, Analytics, estacionalidad, clima, noticias sectoriales y movimientos competitivos. Cada señal contrae o expande la espiral — las tareas más urgentes suben automáticamente al centro.'
              )}
            </motion.p>

            {/* Signal pills */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="flex flex-wrap gap-2"
            >
              <SignalPill icon={BarChart3} label="GSC / GA4" delay={0.65} />
              <SignalPill icon={Calendar} label={t3(language, 'Saisonnalité', 'Seasonality', 'Estacionalidad')} delay={0.7} />
              <SignalPill icon={Sun} label={t3(language, 'Météo', 'Weather', 'Clima')} delay={0.75} />
              <SignalPill icon={Newspaper} label={t3(language, 'Actualités', 'News', 'Noticias')} delay={0.8} />
              <SignalPill icon={Cloud} label={t3(language, 'Concurrence', 'Competition', 'Competencia')} delay={0.85} />
            </motion.div>

            {/* Key differentiator */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.7 }}
              className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4"
            >
              <p className="text-sm text-foreground font-medium">
                {t3(language,
                  '🌀 Les plateformes classiques vous donnent un score et une liste de tâches. La Breathing Spiral transforme ces données en un organisme vivant qui s\'adapte à votre réalité business, et gère en direct la transformation de vos pages.',
                  '🌀 Traditional platforms give you a score and a task list. The Breathing Spiral transforms that data into a living organism that adapts to your business reality, and manages your page transformations in real-time.',
                  '🌀 Las plataformas clásicas le dan un score y una lista de tareas. La Breathing Spiral transforma esos datos en un organismo vivo que se adapta a su realidad empresarial, y gestiona en directo la transformación de sus páginas.'
                )}
              </p>
            </motion.div>

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.85 }}
              className="pt-2"
            >
              <Link to="/breathing-spiral">
                <Button
                  size="lg"
                  className="gap-2 bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-700 hover:to-cyan-600 text-white font-semibold px-8 shadow-lg hover:shadow-xl transition-all"
                >
                  <Activity className="h-5 w-5" />
                  {t3(language,
                    'Découvrir la Breathing Spiral',
                    'Discover the Breathing Spiral',
                    'Descubrir la Breathing Spiral'
                  )}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
});
BreathingSpiralSection.displayName = 'BreathingSpiralSection';
