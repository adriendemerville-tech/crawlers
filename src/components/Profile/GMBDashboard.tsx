import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Construction, Star, MapPin, Phone, Globe, Clock, Search, Map, MousePointerClick,
  Navigation, PhoneCall, Image, MessageSquare, Send, Flag, TrendingUp, Eye,
  ChevronRight, Calendar, Megaphone, Plus, BarChart3, Store, CheckCircle2, AlertTriangle
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';

// ─── Simulated Data ────────────────────────────────────────────

const SIMULATED_PERFORMANCE = (() => {
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getTime() - (11 - i) * 7 * 24 * 60 * 60 * 1000);
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay() + 1);
    return {
      week: weekStart.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
      search_views: 120 + Math.floor(Math.random() * 80) + i * 5,
      maps_views: 80 + Math.floor(Math.random() * 60) + i * 3,
      website_clicks: 25 + Math.floor(Math.random() * 20) + i * 2,
      direction_requests: 8 + Math.floor(Math.random() * 12),
      phone_calls: 3 + Math.floor(Math.random() * 8),
      photo_views: 40 + Math.floor(Math.random() * 30) + i * 2,
    };
  });
})();

const SIMULATED_REVIEWS = [
  { id: '1', reviewer_name: 'Marie Dupont', star_rating: 5, comment: 'Excellent service, très professionnel !', review_created_at: '2026-03-10T10:00:00Z', reply_comment: 'Merci beaucoup Marie ! Nous sommes ravis.', is_flagged: false, reviewer_photo: null },
  { id: '2', reviewer_name: 'Jean Martin', star_rating: 4, comment: 'Très bien dans l\'ensemble, juste un petit temps d\'attente.', review_created_at: '2026-03-08T15:30:00Z', reply_comment: null, is_flagged: false, reviewer_photo: null },
  { id: '3', reviewer_name: 'Sophie Bernard', star_rating: 5, comment: 'Je recommande vivement, équipe au top !', review_created_at: '2026-03-05T09:15:00Z', reply_comment: 'Merci Sophie, au plaisir de vous revoir !', is_flagged: false, reviewer_photo: null },
  { id: '4', reviewer_name: 'Pierre Durand', star_rating: 2, comment: 'Accueil moyen, le produit n\'était pas en stock.', review_created_at: '2026-03-01T14:00:00Z', reply_comment: null, is_flagged: false, reviewer_photo: null },
  { id: '5', reviewer_name: 'Utilisateur Google', star_rating: 1, comment: 'Avis douteux, concurrent probable...', review_created_at: '2026-02-28T11:00:00Z', reply_comment: null, is_flagged: true, reviewer_photo: null },
  { id: '6', reviewer_name: 'Claire Moreau', star_rating: 5, comment: 'Superbe expérience, je reviendrai !', review_created_at: '2026-02-25T16:45:00Z', reply_comment: 'Merci Claire !', is_flagged: false, reviewer_photo: null },
  { id: '7', reviewer_name: 'Luc Petit', star_rating: 4, comment: 'Bon rapport qualité-prix.', review_created_at: '2026-02-20T12:00:00Z', reply_comment: null, is_flagged: false, reviewer_photo: null },
  { id: '8', reviewer_name: 'Emma Laurent', star_rating: 3, comment: 'Correct sans plus, des améliorations possibles.', review_created_at: '2026-02-15T10:30:00Z', reply_comment: null, is_flagged: false, reviewer_photo: null },
];

const SIMULATED_POSTS = [
  { id: '1', post_type: 'STANDARD', summary: '🎉 Nouvelle collection printemps disponible ! Venez découvrir nos nouveautés en magasin.', status: 'published', published_at: '2026-03-15T09:00:00Z' },
  { id: '2', post_type: 'EVENT', summary: '📅 Journée portes ouvertes le 22 mars. Réductions exclusives de -20% sur tout le magasin.', status: 'published', published_at: '2026-03-10T10:00:00Z' },
  { id: '3', post_type: 'OFFER', summary: '🔥 Offre spéciale : -15% avec le code SPRING26 jusqu\'au 31 mars.', status: 'draft', published_at: null },
];

const SIMULATED_INFO = {
  name: 'Mon Entreprise',
  address: '12 Rue de la Paix, 75002 Paris, France',
  phone: '+33 1 23 45 67 89',
  website: 'https://mon-entreprise.fr',
  category: 'Agence de communication',
  hours: {
    Lundi: { open: '09:00', close: '18:00' },
    Mardi: { open: '09:00', close: '18:00' },
    Mercredi: { open: '09:00', close: '18:00' },
    Jeudi: { open: '09:00', close: '18:00' },
    Vendredi: { open: '09:00', close: '17:00' },
    Samedi: { open: '10:00', close: '13:00' },
    Dimanche: null as { open: string; close: string } | null,
  },
  photos_count: 24,
  verified: true,
};

// ─── Subcomponents ─────────────────────────────────────────────

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i <= rating ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground/30'}`}
        />
      ))}
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, trend, color = 'text-foreground' }: {
  icon: any; label: string; value: string | number; trend?: number; color?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-3 space-y-1">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="flex items-center gap-2">
        <p className={`text-lg font-semibold ${color}`}>{typeof value === 'number' ? value.toLocaleString() : value}</p>
        {trend !== undefined && (
          <span className={`text-[10px] font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend >= 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Stats Tab ─────────────────────────────────────────────────

function StatsTab() {
  const totals = useMemo(() => {
    const data = SIMULATED_PERFORMANCE;
    return {
      search_views: data.reduce((s, w) => s + w.search_views, 0),
      maps_views: data.reduce((s, w) => s + w.maps_views, 0),
      website_clicks: data.reduce((s, w) => s + w.website_clicks, 0),
      direction_requests: data.reduce((s, w) => s + w.direction_requests, 0),
      phone_calls: data.reduce((s, w) => s + w.phone_calls, 0),
      photo_views: data.reduce((s, w) => s + w.photo_views, 0),
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        <KpiCard icon={Search} label="Recherches" value={totals.search_views} trend={12} color="text-primary" />
        <KpiCard icon={Map} label="Vues Maps" value={totals.maps_views} trend={8} />
        <KpiCard icon={MousePointerClick} label="Clics site" value={totals.website_clicks} trend={15} color="text-primary" />
        <KpiCard icon={Navigation} label="Itinéraires" value={totals.direction_requests} trend={-3} />
        <KpiCard icon={PhoneCall} label="Appels" value={totals.phone_calls} trend={5} />
        <KpiCard icon={Image} label="Vues photos" value={totals.photo_views} trend={22} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Évolution hebdomadaire (12 semaines)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={SIMULATED_PERFORMANCE} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                <defs>
                  <linearGradient id="gmbSearchFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gmbMapsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="week" tick={{ fontSize: 10 }} className="text-muted-foreground" />
                <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" />
                <RechartsTooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))' }} />
                <Area type="monotone" dataKey="search_views" name="Recherches" stroke="hsl(var(--primary))" fill="url(#gmbSearchFill)" strokeWidth={2} />
                <Area type="monotone" dataKey="maps_views" name="Maps" stroke="hsl(var(--accent-foreground))" fill="url(#gmbMapsFill)" strokeWidth={2} />
                <Area type="monotone" dataKey="website_clicks" name="Clics site" stroke="#10b981" fill="transparent" strokeWidth={1.5} strokeDasharray="4 4" />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Actions utilisateur
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={SIMULATED_PERFORMANCE} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <RechartsTooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))' }} />
                <Bar dataKey="direction_requests" name="Itinéraires" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
                <Bar dataKey="phone_calls" name="Appels" fill="#f59e0b" radius={[2, 2, 0, 0]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Reviews Tab ───────────────────────────────────────────────

function ReviewsTab() {
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const avgRating = SIMULATED_REVIEWS.reduce((s, r) => s + r.star_rating, 0) / SIMULATED_REVIEWS.length;
  const ratingDist = [5, 4, 3, 2, 1].map(r => ({
    stars: r,
    count: SIMULATED_REVIEWS.filter(rv => rv.star_rating === r).length,
  }));

  return (
    <div className="space-y-4">
      {/* Rating summary */}
      <div className="flex gap-6 items-center">
        <div className="text-center">
          <p className="text-4xl font-bold">{avgRating.toFixed(1)}</p>
          <StarRating rating={Math.round(avgRating)} />
          <p className="text-xs text-muted-foreground mt-1">{SIMULATED_REVIEWS.length} avis</p>
        </div>
        <div className="flex-1 space-y-1">
          {ratingDist.map(({ stars, count }) => (
            <div key={stars} className="flex items-center gap-2 text-xs">
              <span className="w-3 text-right">{stars}</span>
              <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-yellow-500 rounded-full"
                  style={{ width: `${(count / SIMULATED_REVIEWS.length) * 100}%` }}
                />
              </div>
              <span className="w-4 text-right text-muted-foreground">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Reviews list */}
      <div className="space-y-3">
        {SIMULATED_REVIEWS.map(review => (
          <Card key={review.id} className={review.is_flagged ? 'border-red-500/30 bg-red-500/5' : ''}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                    {review.reviewer_name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{review.reviewer_name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(review.review_created_at).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StarRating rating={review.star_rating} />
                  {review.is_flagged && (
                    <Badge variant="destructive" className="text-[10px]">
                      <Flag className="h-2.5 w-2.5 mr-1" />Signalé
                    </Badge>
                  )}
                </div>
              </div>

              <p className="text-sm text-muted-foreground">{review.comment}</p>

              {review.reply_comment && (
                <div className="ml-6 pl-3 border-l-2 border-primary/20">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Votre réponse :</span> {review.reply_comment}
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                {!review.reply_comment && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => { setReplyingTo(review.id); setReplyText(''); }}
                  >
                    <MessageSquare className="h-3 w-3" />
                    Répondre
                  </Button>
                )}
                {!review.is_flagged && review.star_rating <= 2 && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-destructive">
                    <Flag className="h-3 w-3" />
                    Signaler
                  </Button>
                )}
              </div>

              {replyingTo === review.id && (
                <div className="space-y-2 pt-2">
                  <Textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Votre réponse..."
                    className="text-sm min-h-[60px]"
                  />
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => setReplyingTo(null)}>
                      Annuler
                    </Button>
                    <Button size="sm" className="gap-1">
                      <Send className="h-3 w-3" />
                      Envoyer
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Posts Tab ──────────────────────────────────────────────────

function PostsTab() {
  const postTypeLabels: Record<string, { label: string; icon: any; color: string }> = {
    STANDARD: { label: 'Actualité', icon: Megaphone, color: 'bg-primary/10 text-primary' },
    EVENT: { label: 'Événement', icon: Calendar, color: 'bg-blue-500/10 text-blue-600' },
    OFFER: { label: 'Offre', icon: Star, color: 'bg-amber-500/10 text-amber-600' },
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{SIMULATED_POSTS.length} publications</p>
        <Button size="sm" className="gap-1">
          <Plus className="h-3.5 w-3.5" />
          Nouvelle publication
        </Button>
      </div>

      <div className="space-y-3">
        {SIMULATED_POSTS.map(post => {
          const typeInfo = postTypeLabels[post.post_type] || postTypeLabels.STANDARD;
          const TypeIcon = typeInfo.icon;
          return (
            <Card key={post.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={`text-[10px] gap-1 ${typeInfo.color}`}>
                        <TypeIcon className="h-3 w-3" />
                        {typeInfo.label}
                      </Badge>
                      <Badge variant={post.status === 'published' ? 'default' : 'outline'} className="text-[10px]">
                        {post.status === 'published' ? 'Publié' : 'Brouillon'}
                      </Badge>
                    </div>
                    <p className="text-sm">{post.summary}</p>
                    {post.published_at && (
                      <p className="text-[10px] text-muted-foreground">
                        Publié le {new Date(post.published_at).toLocaleDateString('fr-FR')}
                      </p>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ─── Info Tab ──────────────────────────────────────────────────

function InfoTab() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Store className="h-4 w-4" />
            Informations de l'établissement
            {SIMULATED_INFO.verified && (
              <Badge variant="secondary" className="text-[10px] gap-1 bg-green-500/10 text-green-600">
                <CheckCircle2 className="h-3 w-3" />
                Vérifié
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Nom</label>
              <Input value={SIMULATED_INFO.name} readOnly className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Catégorie</label>
              <Input value={SIMULATED_INFO.category} readOnly className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />Adresse</label>
              <Input value={SIMULATED_INFO.address} readOnly className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />Téléphone</label>
              <Input value={SIMULATED_INFO.phone} readOnly className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground flex items-center gap-1"><Globe className="h-3 w-3" />Site web</label>
              <Input value={SIMULATED_INFO.website} readOnly className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground flex items-center gap-1"><Image className="h-3 w-3" />Photos</label>
              <Input value={`${SIMULATED_INFO.photos_count} photos publiées`} readOnly className="text-sm" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Horaires d'ouverture
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Object.entries(SIMULATED_INFO.hours).map(([day, hours]) => (
              <div key={day} className="flex items-center justify-between text-sm">
                <span className="font-medium w-24">{day}</span>
                {hours ? (
                  <span className="text-muted-foreground">{hours.open} — {hours.close}</span>
                ) : (
                  <span className="text-red-500 text-xs">Fermé</span>
                )}
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" className="mt-4 w-full text-xs">
            Modifier les horaires
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Photos Tab ────────────────────────────────────────────────

function PhotosTab() {
  const placeholders = Array.from({ length: 8 }, (_, i) => i);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">24 photos publiées</p>
        <Button size="sm" className="gap-1">
          <Plus className="h-3.5 w-3.5" />
          Ajouter une photo
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {placeholders.map(i => (
          <div
            key={i}
            className="aspect-square rounded-lg bg-muted/50 border border-dashed border-border/50 flex items-center justify-center"
          >
            <Image className="h-8 w-8 text-muted-foreground/30" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────

export function GMBDashboard() {
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState('stats');

  return (
    <div className="space-y-4">
      {/* Construction banner */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
        <Construction className="h-5 w-5 text-amber-500 shrink-0" />
        <div>
          <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
            🚧 En construction — Données simulées
          </p>
          <p className="text-xs text-muted-foreground">
            Ce module sera connecté à l'API Google Business Profile une fois l'accès approuvé par Google.
          </p>
        </div>
      </div>

      {/* Business summary card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Store className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{SIMULATED_INFO.name}</h3>
                {SIMULATED_INFO.verified && (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                )}
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" />{SIMULATED_INFO.address}
              </p>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1">
                <span className="text-2xl font-bold">4.3</span>
                <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
              </div>
              <p className="text-[10px] text-muted-foreground">47 avis Google</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full grid grid-cols-5 h-9">
          <TabsTrigger value="stats" className="text-xs gap-1">
            <BarChart3 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Stats</span>
          </TabsTrigger>
          <TabsTrigger value="reviews" className="text-xs gap-1">
            <MessageSquare className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Avis</span>
          </TabsTrigger>
          <TabsTrigger value="posts" className="text-xs gap-1">
            <Megaphone className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Posts</span>
          </TabsTrigger>
          <TabsTrigger value="info" className="text-xs gap-1">
            <Store className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Infos</span>
          </TabsTrigger>
          <TabsTrigger value="photos" className="text-xs gap-1">
            <Image className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Photos</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stats"><StatsTab /></TabsContent>
        <TabsContent value="reviews"><ReviewsTab /></TabsContent>
        <TabsContent value="posts"><PostsTab /></TabsContent>
        <TabsContent value="info"><InfoTab /></TabsContent>
        <TabsContent value="photos"><PhotosTab /></TabsContent>
      </Tabs>
    </div>
  );
}
