import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { Globe, Code, Shield, Brain, CheckCircle2, Target, Link2, Users, Search, Music, ListMusic, X, SkipBack, SkipForward } from 'lucide-react';
import { useSpotifyTrackRotation } from './useSpotifyTrackRotation';
import { useCustomPlaylist } from '@/hooks/useCustomPlaylist';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// Track IDs from the "Chill out 🐈" playlist
const PLAYLIST_TRACK_IDS = [
  '17nOJOcPbcl4sKzM2yyYDp', // Sugar Man - Rodríguez
  '51rPRW8NjxZoWPPjnRGzHw', // Tadow - Masego, FKJ
  '2jX5c5RFp0A9E1GDsvGxIa', // Balance ton quoi - Angèle
  '6eZZcBjuiLVOxO0VX2xEfF', // Insomnia - Faithless
  '39qYD4J4BKvZMQgxfXl5bv', // Eye In The Sky - Alan Parsons
  '5CQ30WqJwcep0pYcV4AMNc', // Stairway to Heaven - Led Zeppelin
  '51tUT1gHE30GQPhn1agudM', // Hideaway - Kiesza
  '1vxw6aYJls2oq3gW0DujAo', // Crazy - Gnarls Barkley
  '1dEy9Pl81QopSxNsPxXQxv', // Stay - Rihanna
  '0Q0IVlqMV64kNLlwjPj0Hl', // Killing Me Softly - Fugees
  '08QmEfykPyTLC5uCC9WCHv', // La javanaise - Gainsbourg
  '0YMFcrMtBowDdD5bPz0cgy', // Talkin' Bout a Revolution - Tracy Chapman
  '6ztstiyZL6FXzh4aG46ZPD', // Boogie Wonderland - Earth Wind & Fire
  '0DwClY2t9YAWHBROMIgrXb', // Ho Hey - The Lumineers
  '3spdoTYpuCpmq19tuD0bOe', // My Way - Frank Sinatra
  '2g4oQ1siRRrg8yAkQLVx0c', // Le vent nous portera - Noir Désir
  '6zeE5tKyr8Nu882DQhhSQI', // Dust in the Wind - Kansas
  '2YplrdHMBoRdnHgMeHEwHm', // The Sound of Silence - Simon & Garfunkel
  '2Fxmhks0bxGSBdJ92vM42m', // bad guy - Billie Eilish
  '2Foc5Q5nqNiosCNqttzHof', // Get Lucky - Daft Punk
  '6FLwmdmW77N1Pxb1aWsZmO', // Only Time - Enya
  '7wC8EVTpYfKxe73eXmbiMe', // Postcards from Italy - Beirut
  '4KFM3A5QF2IMcc6nHsu3Wp', // Englishman In New York - Sting
  '2gNjmvuQiEd2z9SqyYi8HH', // Summertime - Ella Fitzgerald & Louis Armstrong
  '1jGkLUJCl46NmXIM6rUghn', // Estación Esperanza - Sofia Kourtesis
  '5gOnivVq0hLxPvIPC00ZhF', // Cosmic Dancer - T. Rex
  '1fmoCZ6mtMiqA5GHWPcZz9', // A New Error - Moderat
  '29GuoJqjg7aMxUmEO3XLEp', // Comment te dire adieu - Françoise Hardy
  '7aZjExRehKGrH6vZ3MNXlq', // Precious Angel - Bob Dylan
  '0rqCsgBpf8mojW1bMy6DQU', // Back In The Day - De Hofnar
  '688swhveYzWFjUpyR060tG', // Castle in the Snow - The Avener
  '5CQ30WqJwcep0pYcV4AMNc', // Stairway to Heaven alt
  '2ZQVJD9I6GCqXmkmMuEoLa', // Le vent nous portera alt - Noir Désir
  '5y788ya4NvwhBznoDIcXwK', // The Sound of Silence acoustic - Simon & Garfunkel
  '2FH3BLTMhJlCH1Dmkua5DW', // Insomnia Monster Mix - Faithless
  '0GNI8K3VATWBABQFAzBAYe', // Stay alt - Rihanna
  '0biKl6K9vgQtXNqoOrH9QM', // Je suis venu te dire - Gainsbourg
  '2H6BI0TAiEYHVfhcjgGEZS', // La loi de Murphy - Angèle
  '5IV5Wh6hdncGcsnbVhhVug', // La marcheuse - Christine and the Queens
];

const technicalSteps = [
  { id: 'connect', label: 'Audit Speed et Performances...', icon: Globe },
  { id: 'html', label: 'Analyse du code HTML...', icon: Code },
  { id: 'links', label: 'Vérification des liens cassés...', icon: Link2 },
  { id: 'security', label: 'Vérification Safe Browsing...', icon: Shield },
  { id: 'ai', label: 'Calcul du score GEO & IA...', icon: Brain },
  { id: 'done', label: 'Génération du rapport...', icon: CheckCircle2 },
];

const strategicSteps = [
  { id: 'fetch', label: 'Récupération du contenu...', icon: Globe },
  { id: 'keywords', label: 'Étude des mots-clés...', icon: Target },
  { id: 'brand', label: 'Analyse de l\'identité de marque...', icon: Target },
  { id: 'competition', label: 'Analyse de la concurrence...', icon: Users },
  { id: 'geo', label: 'Évaluation du score GEO...', icon: Brain },
  { id: 'llm_queries', label: 'Requêtes LLM cibles...', icon: Search },
  { id: 'roadmap', label: 'Construction de la roadmap stratégique...', icon: Code },
  { id: 'done', label: 'Génération du rapport...', icon: CheckCircle2 },
];

interface LoadingStepsProps {
  siteName?: string;
  variant?: 'technical' | 'strategic';
  onStopMusicRef?: React.MutableRefObject<(() => void) | null>;
}

export function LoadingSteps({ siteName, variant = 'technical', onStopMusicRef }: LoadingStepsProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const steps = variant === 'strategic' ? strategicSteps : technicalSteps;
  const { embedContainerRef, stopPlayback, isCustomPlaylist, goNext, goPrev } = useSpotifyTrackRotation();
  const { playlistUri, savePlaylist, clearPlaylist } = useCustomPlaylist();
  const [showPlaylistInput, setShowPlaylistInput] = useState(false);
  const [playlistInputValue, setPlaylistInputValue] = useState('');

  useEffect(() => {
    if (onStopMusicRef) {
      onStopMusicRef.current = stopPlayback;
    }
  }, [onStopMusicRef, stopPlayback]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev < steps.length - 1) return prev + 1;
        return prev;
      });
    }, variant === 'strategic' ? 8000 : 2500);

    return () => clearInterval(interval);
  }, [steps.length, variant]);

  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-8">
      {/* Spinning loader with ring */}
      <div className="relative">
        <div className="h-20 w-20 rounded-full border-4 border-muted"></div>
        <div className={`absolute inset-0 h-20 w-20 rounded-full border-4 border-t-transparent animate-spin ${
          variant === 'strategic' ? 'border-slate-500' : 'border-primary'
        }`}></div>
        <motion.div 
          className="absolute inset-0 flex items-center justify-center"
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        >
          {variant === 'strategic' ? (
            <Target className="h-8 w-8 text-slate-600 dark:text-slate-400" />
          ) : (
            <Brain className="h-8 w-8 text-primary" />
          )}
        </motion.div>
      </div>

      {/* Animated "Analyse de [site]..." text */}
      <div className="flex items-center gap-1 text-xl font-semibold text-foreground max-w-[90vw] px-4">
        <span className="truncate min-w-0">Analyse {siteName ? `de ${siteName}` : ''}</span>
        <span className="inline-flex">
          <motion.span
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}
          >.</motion.span>
          <motion.span
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
          >.</motion.span>
          <motion.span
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: 0.6 }}
          >.</motion.span>
        </span>
      </div>

      <div className="space-y-3 w-full max-w-md">
        <AnimatePresence mode="wait">
          {steps.map((step, index) => {
            const StepIcon = step.icon;
            const isActive = index === currentStep;
            const isComplete = index < currentStep;
            const isPending = index > currentStep;

            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ 
                  opacity: isActive || isComplete ? 1 : 0.4, 
                  x: 0,
                  scale: isActive ? 1.02 : 1
                }}
                className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                  isActive 
                    ? variant === 'strategic' 
                      ? 'bg-slate-500/10 border border-slate-500/30' 
                      : 'bg-primary/10 border border-primary/30'
                    : isComplete 
                    ? 'bg-success/10' 
                    : isPending && variant === 'strategic'
                    ? 'bg-slate-500/5 border border-slate-500/20'
                    : 'bg-muted/30'
                }`}
              >
                <StepIcon className={`h-5 w-5 ${
                  isComplete ? 'text-success' : 
                  isActive 
                    ? variant === 'strategic' ? 'text-slate-600 dark:text-slate-400' : 'text-primary' 
                    : isPending && variant === 'strategic'
                    ? 'text-slate-500/60'
                    : 'text-muted-foreground'
                }`} />
                <span className={`text-sm ${isActive ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                  {step.label}
                </span>
                {isComplete && (
                  <CheckCircle2 className="h-4 w-4 text-success ml-auto" />
                )}
                {isActive && (
                  <motion.div
                    className="ml-auto"
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    <div className={`h-2 w-2 rounded-full ${variant === 'strategic' ? 'bg-slate-500' : 'bg-primary'}`} />
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Spotify Playlist */}
      <div className="w-full max-w-md mt-4">
        <div className="flex items-center gap-2 justify-center mb-3">
          <Music className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">
            {isCustomPlaylist ? 'Ma Playlist' : 'Playlist Crawlers'}
          </span>
          <button
            onClick={() => setShowPlaylistInput(!showPlaylistInput)}
            className="ml-1 p-1 rounded-md hover:bg-muted/60 transition-colors"
            title="Changer de playlist"
          >
            <ListMusic className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          {isCustomPlaylist && (
            <button
              onClick={() => { clearPlaylist(); window.location.reload(); }}
              className="p-1 rounded-md hover:bg-destructive/10 transition-colors"
              title="Revenir à la playlist Crawlers"
            >
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
        </div>

        {showPlaylistInput && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-3 flex gap-2"
          >
            <Input
              placeholder="https://open.spotify.com/playlist/..."
              value={playlistInputValue}
              onChange={(e) => setPlaylistInputValue(e.target.value)}
              className="text-xs h-8"
            />
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-3 text-xs shrink-0"
              onClick={() => {
                if (savePlaylist(playlistInputValue)) {
                  toast.success('Playlist enregistrée ! Rechargement...');
                  setTimeout(() => window.location.reload(), 800);
                } else {
                  toast.error('URL Spotify invalide');
                }
              }}
            >
              OK
            </Button>
          </motion.div>
        )}

        <div className="flex items-center gap-2">
          {!isCustomPlaylist && (
            <button
              onClick={goPrev}
              className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              title="Précédent"
            >
              <SkipBack className="h-4 w-4" />
            </button>
          )}
          <div
            className="flex-1 w-full overflow-hidden rounded-[12px] bg-[#282828] isolate"
            style={{ clipPath: 'inset(0 round 12px)' }}
          >
            <div
              ref={embedContainerRef}
              className="w-full"
              style={{ transform: 'scale(1.05)', transformOrigin: 'center center' }}
              aria-label={isCustomPlaylist ? 'Ma Playlist' : 'Playlist Crawlers'}
            />
          </div>
          {!isCustomPlaylist && (
            <button
              onClick={goNext}
              className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              title="Suivant"
            >
              <SkipForward className="h-4 w-4" />
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground text-center mt-2 opacity-60">
          Connectez votre Spotify en paramètres
        </p>
      </div>

      <p className="text-sm text-muted-foreground text-center">
        L'analyse peut prendre jusqu'à 9 minutes.
        <br />
        <span className="text-xs opacity-70">Veuillez patienter pendant que nous analysons votre site en profondeur.</span>
      </p>
    </div>
  );
}
