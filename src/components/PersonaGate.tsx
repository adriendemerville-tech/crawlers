import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Briefcase, Search, Megaphone, ShoppingBag, Loader2, Check, Tag } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';

export type PersonaType = 'entrepreneur' | 'seo_pro' | 'marketing' | 'ecommerce';

interface PersonaGateProps {
  onSelect: (persona: PersonaType) => void;
}

const translations = {
  fr: {
    question: 'Pour personnaliser votre expérience Crawlers, quel est votre profil ?',
    entrepreneur: 'Entrepreneur / Dirigeant',
    seo_pro: 'Expert SEO / SIO',
    marketing: 'Responsable Audience / Marketing',
    ecommerce: 'Boutique ecommerce',
    affiliateLabel: "J'ai un code d'affiliation",
    affiliatePlaceholder: 'Entrez votre code',
  },
  en: {
    question: 'To personalize your Crawlers experience, what is your profile?',
    entrepreneur: 'Entrepreneur / Executive',
    seo_pro: 'SEO / SIO Expert',
    marketing: 'Audience / Marketing Manager',
    ecommerce: 'Ecommerce store',
    affiliateLabel: 'I have an affiliate code',
    affiliatePlaceholder: 'Enter your code',
  },
  es: {
    question: 'Para personalizar tu experiencia Crawlers, ¿cuál es tu perfil?',
    entrepreneur: 'Emprendedor / Directivo',
    seo_pro: 'Experto SEO / SIO',
    marketing: 'Responsable de Audiencia / Marketing',
    ecommerce: 'Tienda ecommerce',
    affiliateLabel: 'Tengo un código de afiliación',
    affiliatePlaceholder: 'Introduce tu código',
  },
};

const personas: { id: PersonaType; icon: typeof Briefcase; gradient: string }[] = [
  { id: 'entrepreneur', icon: Briefcase, gradient: 'from-violet-600 to-violet-400' },
  { id: 'seo_pro', icon: Search, gradient: 'from-violet-500 to-amber-400' },
  { id: 'marketing', icon: Megaphone, gradient: 'from-amber-500 to-amber-300' },
  { id: 'ecommerce', icon: ShoppingBag, gradient: 'from-emerald-500 to-teal-400' },
];

export function PersonaGate({ onSelect }: PersonaGateProps) {
  const { language } = useLanguage();
  const t = translations[language] || translations.fr;
  const [selected, setSelected] = useState<PersonaType | null>(null);
  const [showAffiliate, setShowAffiliate] = useState(false);
  const [affiliateCode, setAffiliateCode] = useState('');
  const [affiliateStatus, setAffiliateStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = (id: PersonaType) => {
    setSelected(id);
    setTimeout(() => onSelect(id), 500);
  };

  // Auto-check affiliate code with debounce
  useEffect(() => {
    if (affiliateCode.length < 3) {
      setAffiliateStatus('idle');
      return;
    }

    setAffiliateStatus('checking');

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from('affiliate_codes')
        .select('id, code, is_active')
        .eq('code', affiliateCode.toUpperCase().trim())
        .eq('is_active', true)
        .maybeSingle();

      if (data) {
        setAffiliateStatus('valid');
        sessionStorage.setItem('pending_affiliate_code', affiliateCode.toUpperCase().trim());
      } else {
        setAffiliateStatus('invalid');
        sessionStorage.removeItem('pending_affiliate_code');
        // Clear after shake animation
        setTimeout(() => {
          setAffiliateCode('');
          setAffiliateStatus('idle');
        }, 800);
      }
    }, 600);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [affiliateCode]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/98 backdrop-blur-xl"
    >
      <div className="flex flex-col items-center gap-8 px-6 max-w-lg w-full">
        {/* Question */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="text-xl sm:text-2xl font-bold text-center leading-tight"
          style={{ fontFamily: "'Space Grotesk Variable', sans-serif" }}
        >
          <span className="bg-gradient-to-r from-violet-600 via-violet-400 to-amber-400 bg-clip-text text-transparent">
            {t.question}
          </span>
        </motion.h1>

        {/* Persona Buttons */}
        <div className="flex flex-col gap-3 w-full">
          {personas.map((p, i) => {
            const Icon = p.icon;
            const isSelected = selected === p.id;
            const isDisabled = selected !== null && !isSelected;

            return (
              <motion.button
                key={p.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: isDisabled ? 0.4 : 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.08, duration: 0.3 }}
                onClick={() => !selected && handleClick(p.id)}
                disabled={!!selected}
                className={`
                  group relative w-full rounded-xl border-2 p-4 sm:p-5
                  transition-all duration-300 cursor-pointer
                  ${isSelected
                    ? 'border-violet-500 bg-violet-500/10 shadow-lg shadow-violet-500/20'
                    : 'border-border/60 bg-card hover:border-violet-400/60 hover:shadow-md hover:shadow-violet-500/10'
                  }
                `}
              >
                <div className="flex items-center gap-4">
                  <div className={`
                    w-10 h-10 rounded-lg flex items-center justify-center shrink-0
                    bg-gradient-to-br ${p.gradient} shadow-sm
                  `}>
                    {isSelected ? (
                      <Loader2 className="w-5 h-5 text-white animate-spin" />
                    ) : (
                      <Icon className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <span className="text-sm sm:text-base font-semibold text-foreground text-left">
                    {t[p.id]}
                  </span>
                </div>

                {/* Subtle glow on hover */}
                <div className={`
                  absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300
                  bg-gradient-to-r ${p.gradient} blur-xl -z-10
                  ${isSelected ? 'opacity-30' : ''}
                `} style={{ transform: 'scale(0.95)' }} />
              </motion.button>
            );
          })}
        </div>

        {/* Affiliate Code Section — detached below */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.4 }}
          className="w-full pt-2"
        >
          {!showAffiliate ? (
            <button
              onClick={() => setShowAffiliate(true)}
              className="mx-auto flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Tag className="h-3.5 w-3.5" />
              {t.affiliateLabel}
            </button>
          ) : (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center gap-2"
            >
              <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Tag className="h-3 w-3" />
                {t.affiliateLabel}
              </label>
              <div className="relative w-full max-w-xs">
                <motion.input
                  animate={affiliateStatus === 'invalid' ? { x: [0, -8, 8, -6, 6, -3, 3, 0] } : {}}
                  transition={{ duration: 0.5 }}
                  type="text"
                  value={affiliateCode}
                  onChange={(e) => setAffiliateCode(e.target.value.toUpperCase())}
                  placeholder={t.affiliatePlaceholder}
                  maxLength={20}
                  className={`
                    w-full h-10 rounded-lg border-2 bg-card px-3 text-sm text-center font-mono tracking-widest uppercase
                    outline-none transition-all duration-300
                    ${affiliateStatus === 'valid'
                      ? 'border-emerald-500 shadow-sm shadow-emerald-500/20'
                      : affiliateStatus === 'invalid'
                        ? 'border-destructive'
                        : 'border-border/60 focus:border-violet-400'
                    }
                  `}
                />
                {/* Status icon */}
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <AnimatePresence mode="wait">
                    {affiliateStatus === 'checking' && (
                      <motion.div key="check" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </motion.div>
                    )}
                    {affiliateStatus === 'valid' && (
                      <motion.div
                        key="valid"
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                      >
                        <Check className="h-4 w-4 text-emerald-500" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}
