import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
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
  ChevronRight, Calendar, Megaphone, Plus, BarChart3, Store, CheckCircle2, AlertTriangle, GripVertical, Swords,
  Plug, Unplug, Loader2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { GmbLocalCompetitorsTab } from './GmbLocalCompetitorsTab';
import { GmbKeywordsTab } from './GmbKeywordsTab';
import { GmbPowerScoreCard } from './GmbPowerScoreCard';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';

// ─── Translations ──────────────────────────────────────────────

const translations = {
  fr: {
    constructionTitle: '🚧 En construction — Données simulées',
    constructionDesc: "Ce module sera connecté à l'API Google Business Profile une fois l'accès approuvé par Google.",
    searches: 'Recherches',
    mapsViews: 'Vues Maps',
    siteClicks: 'Clics site',
    directions: 'Itinéraires',
    calls: 'Appels',
    photoViews: 'Vues photos',
    weeklyEvolution: 'Évolution hebdomadaire (12 semaines)',
    userActions: 'Actions utilisateur',
    reviews: 'avis',
    reviewsTab: 'Avis',
    reply: 'Répondre',
    report: 'Signaler',
    reported: 'Signalé',
    yourReply: 'Votre réponse :',
    replyPlaceholder: 'Votre réponse...',
    cancel: 'Annuler',
    send: 'Envoyer',
    publications: 'publications',
    newPublication: 'Nouvelle publication',
    news: 'Actualité',
    event: 'Événement',
    offer: 'Offre',
    published: 'Publié',
    draft: 'Brouillon',
    publishedOn: 'Publié le',
    businessInfo: "Informations de l'établissement",
    verified: 'Vérifié',
    name: 'Nom',
    category: 'Catégorie',
    address: 'Adresse',
    phone: 'Téléphone',
    website: 'Site web',
    photos: 'Photos',
    photosPublished: 'photos publiées',
    openingHours: "Horaires d'ouverture",
    editHours: 'Modifier les horaires',
    closed: 'Fermé',
    addPhoto: 'Ajouter une photo',
    add: 'Ajouter',
    googleReviews: 'avis Google',
    days: { Lundi: 'Lundi', Mardi: 'Mardi', Mercredi: 'Mercredi', Jeudi: 'Jeudi', Vendredi: 'Vendredi', Samedi: 'Samedi', Dimanche: 'Dimanche' },
  },
  en: {
    constructionTitle: '🚧 Under construction — Simulated data',
    constructionDesc: 'This module will be connected to the Google Business Profile API once approved by Google.',
    searches: 'Searches',
    mapsViews: 'Maps Views',
    siteClicks: 'Site Clicks',
    directions: 'Directions',
    calls: 'Calls',
    photoViews: 'Photo Views',
    weeklyEvolution: 'Weekly evolution (12 weeks)',
    userActions: 'User actions',
    reviews: 'reviews',
    reviewsTab: 'Reviews',
    reply: 'Reply',
    report: 'Report',
    reported: 'Reported',
    yourReply: 'Your reply:',
    replyPlaceholder: 'Your reply...',
    cancel: 'Cancel',
    send: 'Send',
    publications: 'publications',
    newPublication: 'New publication',
    news: 'News',
    event: 'Event',
    offer: 'Offer',
    published: 'Published',
    draft: 'Draft',
    publishedOn: 'Published on',
    businessInfo: 'Business information',
    verified: 'Verified',
    name: 'Name',
    category: 'Category',
    address: 'Address',
    phone: 'Phone',
    website: 'Website',
    photos: 'Photos',
    photosPublished: 'photos published',
    openingHours: 'Opening hours',
    editHours: 'Edit hours',
    closed: 'Closed',
    addPhoto: 'Add a photo',
    add: 'Add',
    googleReviews: 'Google reviews',
    days: { Lundi: 'Monday', Mardi: 'Tuesday', Mercredi: 'Wednesday', Jeudi: 'Thursday', Vendredi: 'Friday', Samedi: 'Saturday', Dimanche: 'Sunday' },
  },
  es: {
    constructionTitle: '🚧 En construcción — Datos simulados',
    constructionDesc: 'Este módulo se conectará a la API de Google Business Profile una vez aprobado por Google.',
    searches: 'Búsquedas',
    mapsViews: 'Vistas Maps',
    siteClicks: 'Clics sitio',
    directions: 'Direcciones',
    calls: 'Llamadas',
    photoViews: 'Vistas fotos',
    weeklyEvolution: 'Evolución semanal (12 semanas)',
    userActions: 'Acciones del usuario',
    reviews: 'reseñas',
    reviewsTab: 'Reseñas',
    reply: 'Responder',
    report: 'Reportar',
    reported: 'Reportado',
    yourReply: 'Tu respuesta:',
    replyPlaceholder: 'Tu respuesta...',
    cancel: 'Cancelar',
    send: 'Enviar',
    publications: 'publicaciones',
    newPublication: 'Nueva publicación',
    news: 'Actualidad',
    event: 'Evento',
    offer: 'Oferta',
    published: 'Publicado',
    draft: 'Borrador',
    publishedOn: 'Publicado el',
    businessInfo: 'Información del establecimiento',
    verified: 'Verificado',
    name: 'Nombre',
    category: 'Categoría',
    address: 'Dirección',
    phone: 'Teléfono',
    website: 'Sitio web',
    photos: 'Fotos',
    photosPublished: 'fotos publicadas',
    openingHours: 'Horario de apertura',
    editHours: 'Modificar horario',
    closed: 'Cerrado',
    addPhoto: 'Añadir una foto',
    add: 'Añadir',
    googleReviews: 'reseñas Google',
    days: { Lundi: 'Lunes', Mardi: 'Martes', Mercredi: 'Miércoles', Jeudi: 'Jueves', Vendredi: 'Viernes', Samedi: 'Sábado', Dimanche: 'Domingo' },
  },
};

// ─── Simulated Data ────────────────────────────────────────────

const SIMULATED_LOCATIONS = [
  {
    id: 'loc-1',
    name: 'Mon Entreprise — Paris',
    address: '12 Rue de la Paix, 75002 Paris',
    category: 'Agence de communication',
    phone: '+33 1 23 45 67 89',
    website: 'https://mon-entreprise.fr',
    avg_rating: 4.3,
    reviews_count: 47,
    verified: true,
    photos_count: 24,
    hours: {
      Lundi: { open: '09:00', close: '18:00' },
      Mardi: { open: '09:00', close: '18:00' },
      Mercredi: { open: '09:00', close: '18:00' },
      Jeudi: { open: '09:00', close: '18:00' },
      Vendredi: { open: '09:00', close: '17:00' },
      Samedi: { open: '10:00', close: '13:00' },
      Dimanche: null as { open: string; close: string } | null,
    },
  },
  {
    id: 'loc-2',
    name: 'Mon Entreprise — Lyon',
    address: '8 Place Bellecour, 69002 Lyon',
    category: 'Agence de communication',
    phone: '+33 4 78 12 34 56',
    website: 'https://mon-entreprise.fr/lyon',
    avg_rating: 4.6,
    reviews_count: 23,
    verified: true,
    photos_count: 12,
    hours: {
      Lundi: { open: '09:00', close: '18:00' },
      Mardi: { open: '09:00', close: '18:00' },
      Mercredi: { open: '09:00', close: '18:00' },
      Jeudi: { open: '09:00', close: '18:00' },
      Vendredi: { open: '09:00', close: '17:00' },
      Samedi: null as { open: string; close: string } | null,
      Dimanche: null as { open: string; close: string } | null,
    },
  },
];

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
  { id: '2', reviewer_name: 'Jean Martin', star_rating: 4, comment: "Très bien dans l'ensemble, juste un petit temps d'attente.", review_created_at: '2026-03-08T15:30:00Z', reply_comment: null, is_flagged: false, reviewer_photo: null },
  { id: '3', reviewer_name: 'Sophie Bernard', star_rating: 5, comment: 'Je recommande vivement, équipe au top !', review_created_at: '2026-03-05T09:15:00Z', reply_comment: 'Merci Sophie, au plaisir de vous revoir !', is_flagged: false, reviewer_photo: null },
  { id: '4', reviewer_name: 'Pierre Durand', star_rating: 2, comment: "Accueil moyen, le produit n'était pas en stock.", review_created_at: '2026-03-01T14:00:00Z', reply_comment: null, is_flagged: false, reviewer_photo: null },
  { id: '5', reviewer_name: 'Utilisateur Google', star_rating: 1, comment: 'Avis douteux, concurrent probable...', review_created_at: '2026-02-28T11:00:00Z', reply_comment: null, is_flagged: true, reviewer_photo: null },
  { id: '6', reviewer_name: 'Claire Moreau', star_rating: 5, comment: 'Superbe expérience, je reviendrai !', review_created_at: '2026-02-25T16:45:00Z', reply_comment: 'Merci Claire !', is_flagged: false, reviewer_photo: null },
  { id: '7', reviewer_name: 'Luc Petit', star_rating: 4, comment: 'Bon rapport qualité-prix.', review_created_at: '2026-02-20T12:00:00Z', reply_comment: null, is_flagged: false, reviewer_photo: null },
  { id: '8', reviewer_name: 'Emma Laurent', star_rating: 3, comment: 'Correct sans plus, des améliorations possibles.', review_created_at: '2026-02-15T10:30:00Z', reply_comment: null, is_flagged: false, reviewer_photo: null },
];

const SIMULATED_POSTS = [
  { id: '1', post_type: 'STANDARD', summary: '🎉 Nouvelle collection printemps disponible ! Venez découvrir nos nouveautés en magasin.', status: 'published', published_at: '2026-03-15T09:00:00Z' },
  { id: '2', post_type: 'EVENT', summary: '📅 Journée portes ouvertes le 22 mars. Réductions exclusives de -20% sur tout le magasin.', status: 'published', published_at: '2026-03-10T10:00:00Z' },
  { id: '3', post_type: 'OFFER', summary: "🔥 Offre spéciale : -15% avec le code SPRING26 jusqu'au 31 mars.", status: 'draft', published_at: null },
];

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

function StatsTab({ t }: { t: typeof translations.fr }) {
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
        <KpiCard icon={Search} label={t.searches} value={totals.search_views} trend={12} color="text-primary" />
        <KpiCard icon={Map} label={t.mapsViews} value={totals.maps_views} trend={8} />
        <KpiCard icon={MousePointerClick} label={t.siteClicks} value={totals.website_clicks} trend={15} color="text-primary" />
        <KpiCard icon={Navigation} label={t.directions} value={totals.direction_requests} trend={-3} />
        <KpiCard icon={PhoneCall} label={t.calls} value={totals.phone_calls} trend={5} />
        <KpiCard icon={Image} label={t.photoViews} value={totals.photo_views} trend={22} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            {t.weeklyEvolution}
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
                <Area type="monotone" dataKey="search_views" name={t.searches} stroke="hsl(var(--primary))" fill="url(#gmbSearchFill)" strokeWidth={2} />
                <Area type="monotone" dataKey="maps_views" name="Maps" stroke="hsl(var(--accent-foreground))" fill="url(#gmbMapsFill)" strokeWidth={2} />
                <Area type="monotone" dataKey="website_clicks" name={t.siteClicks} stroke="#10b981" fill="transparent" strokeWidth={1.5} strokeDasharray="4 4" />
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
            {t.userActions}
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
                <Bar dataKey="direction_requests" name={t.directions} fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
                <Bar dataKey="phone_calls" name={t.calls} fill="#f59e0b" radius={[2, 2, 0, 0]} />
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

function ReviewsTab({ t, language }: { t: typeof translations.fr; language: string }) {
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const avgRating = SIMULATED_REVIEWS.reduce((s, r) => s + r.star_rating, 0) / SIMULATED_REVIEWS.length;
  const ratingDist = [5, 4, 3, 2, 1].map(r => ({
    stars: r,
    count: SIMULATED_REVIEWS.filter(rv => rv.star_rating === r).length,
  }));

  const locale = language === 'en' ? 'en-US' : language === 'es' ? 'es-ES' : 'fr-FR';

  return (
    <div className="space-y-4">
      {/* Rating summary */}
      <div className="flex gap-6 items-center">
        <div className="text-center">
          <p className="text-4xl font-bold">{avgRating.toFixed(1)}</p>
          <StarRating rating={Math.round(avgRating)} />
          <p className="text-xs text-muted-foreground mt-1">{SIMULATED_REVIEWS.length} {t.reviews}</p>
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
                      {new Date(review.review_created_at).toLocaleDateString(locale)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StarRating rating={review.star_rating} />
                  {review.is_flagged && (
                    <Badge variant="destructive" className="text-[10px]">
                      <Flag className="h-2.5 w-2.5 mr-1" />{t.reported}
                    </Badge>
                  )}
                </div>
              </div>

              <p className="text-sm text-muted-foreground">{review.comment}</p>

              {review.reply_comment && (
                <div className="ml-6 pl-3 border-l-2 border-primary/20">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{t.yourReply}</span> {review.reply_comment}
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
                    {t.reply}
                  </Button>
                )}
                {!review.is_flagged && review.star_rating <= 2 && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-destructive">
                    <Flag className="h-3 w-3" />
                    {t.report}
                  </Button>
                )}
              </div>

              {replyingTo === review.id && (
                <div className="space-y-2 pt-2">
                  <Textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={t.replyPlaceholder}
                    className="text-sm min-h-[60px]"
                  />
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => setReplyingTo(null)}>
                      {t.cancel}
                    </Button>
                    <Button size="sm" className="gap-1">
                      <Send className="h-3 w-3" />
                      {t.send}
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

function PostsTab({ t, language }: { t: typeof translations.fr; language: string }) {
  const postTypeLabels: Record<string, { label: string; icon: any; color: string }> = {
    STANDARD: { label: t.news, icon: Megaphone, color: 'bg-primary/10 text-primary' },
    EVENT: { label: t.event, icon: Calendar, color: 'bg-blue-500/10 text-blue-600' },
    OFFER: { label: t.offer, icon: Star, color: 'bg-amber-500/10 text-amber-600' },
  };

  const locale = language === 'en' ? 'en-US' : language === 'es' ? 'es-ES' : 'fr-FR';

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{SIMULATED_POSTS.length} {t.publications}</p>
        <Button size="sm" className="gap-1">
          <Plus className="h-3.5 w-3.5" />
          {t.newPublication}
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
                        {post.status === 'published' ? t.published : t.draft}
                      </Badge>
                    </div>
                    <p className="text-sm">{post.summary}</p>
                    {post.published_at && (
                      <p className="text-[10px] text-muted-foreground">
                        {t.publishedOn} {new Date(post.published_at).toLocaleDateString(locale)}
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

function InfoTab({ location, t }: { location: typeof SIMULATED_LOCATIONS[0]; t: typeof translations.fr }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Store className="h-4 w-4" />
            {t.businessInfo}
            {location.verified && (
              <Badge variant="secondary" className="text-[10px] gap-1 bg-green-500/10 text-green-600">
                <CheckCircle2 className="h-3 w-3" />
                {t.verified}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">{t.name}</label>
              <Input value={location.name} readOnly className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">{t.category}</label>
              <Input value={location.category} readOnly className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{t.address}</label>
              <Input value={location.address} readOnly className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{t.phone}</label>
              <Input value={location.phone} readOnly className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground flex items-center gap-1"><Globe className="h-3 w-3" />{t.website}</label>
              <Input value={location.website} readOnly className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground flex items-center gap-1"><Image className="h-3 w-3" />{t.photos}</label>
              <Input value={`${location.photos_count} ${t.photosPublished}`} readOnly className="text-sm" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" />
            {t.openingHours}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Object.entries(location.hours).map(([day, hours]) => (
              <div key={day} className="flex items-center justify-between text-sm">
                <span className="font-medium w-24">{(t.days as Record<string, string>)[day] || day}</span>
                {hours ? (
                  <span className="text-muted-foreground">{hours.open} — {hours.close}</span>
                ) : (
                  <span className="text-destructive text-xs">{t.closed}</span>
                )}
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" className="mt-4 w-full text-xs">
            {t.editHours}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Photos Tab ────────────────────────────────────────────────

function PhotosTab({ t }: { t: typeof translations.fr }) {
  const placeholders = Array.from({ length: 8 }, (_, i) => i);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">24 {t.photosPublished}</p>
        <Button size="sm" className="gap-1">
          <Plus className="h-3.5 w-3.5" />
          {t.addPhoto}
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

// ─── Sortable Location Item ────────────────────────────────────

function SortableLocationItem({ loc, isSelected, onSelect }: {
  loc: typeof SIMULATED_LOCATIONS[0];
  isSelected: boolean;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: loc.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <button
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onSelect}
      className={`flex items-center gap-0.5 px-3 py-2 rounded-lg text-left transition-colors cursor-grab active:cursor-grabbing ${
        isSelected
          ? 'bg-primary/10 text-primary border border-primary/20'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent'
      }`}
    >
      <span className="text-xs font-medium truncate">{loc.name.split('—').pop()?.trim() || loc.name}</span>
    </button>
  );
}

// ─── Main Component ────────────────────────────────────────────

export function GMBDashboard({ isGated = false, simulatedDataEnabled = false }: { isGated?: boolean; simulatedDataEnabled?: boolean }) {
  const { language } = useLanguage();
  const t = translations[language] || translations.fr;
  const [activeTab, setActiveTab] = useState('stats');
  // Show simulated data when: gated users always, OR simulatedDataEnabled is on and not connected
  const showSimulated = isGated || simulatedDataEnabled;
  const [orderedLocations, setOrderedLocations] = useState(showSimulated ? SIMULATED_LOCATIONS : []);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(showSimulated ? (SIMULATED_LOCATIONS[0]?.id || null) : null);
  const [gbpConnected, setGbpConnected] = useState(false);
  const [gbpEmail, setGbpEmail] = useState<string | null>(null);
  const [gbpLoading, setGbpLoading] = useState(false);
  const [gbpDisconnecting, setGbpDisconnecting] = useState(false);
  const [locationsLoading, setLocationsLoading] = useState(!isGated);

  // Handle GBP OAuth callback URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gbpError = params.get('gbp_error');
    const gbpOk = params.get('gbp_connected');
    if (gbpError) {
      toast.error(language === 'fr' ? `Erreur Google Business : ${gbpError}` : `GBP error: ${gbpError}`);
      // Keep tab=gmb, remove error params
      params.delete('gbp_error');
      params.set('tab', 'gmb');
      window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
    } else if (gbpOk) {
      toast.success(language === 'fr' ? 'Connexion réussie ! Votre compte Google Business est connecté.' : 'Connection successful! Your Google Business account is connected.');
      // Keep tab=gmb, remove callback params
      params.delete('gbp_connected');
      params.delete('google_email');
      params.set('tab', 'gmb');
      window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
    }
  }, [language]);

  // Simulated mode always wins; otherwise fetch real GBP locations for Pro users
  useEffect(() => {
    if (isGated) return;

    if (simulatedDataEnabled) {
      setGbpConnected(false);
      setGbpEmail(null);
      setOrderedLocations(SIMULATED_LOCATIONS);
      setSelectedLocationId(SIMULATED_LOCATIONS[0]?.id || null);
      setLocationsLoading(false);
      return;
    }

    setLocationsLoading(true);

    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setGbpConnected(false);
          setGbpEmail(null);
          setOrderedLocations([]);
          setSelectedLocationId(null);
          setLocationsLoading(false);
          return;
        }
        const { data } = await supabase.functions.invoke('gbp-auth', {
          body: { action: 'status', user_id: user.id },
        });
        if (data?.connected) {
          setGbpConnected(true);
          setGbpEmail(data.email || null);
          if (data.locations && Array.isArray(data.locations) && data.locations.length > 0) {
            setOrderedLocations(data.locations);
            setSelectedLocationId(data.locations[0]?.id || null);
          } else {
            setOrderedLocations([]);
            setSelectedLocationId(null);
          }
        } else {
          setGbpConnected(false);
          setGbpEmail(null);
          setOrderedLocations([]);
          setSelectedLocationId(null);
        }
      } catch (_) {
        setGbpConnected(false);
        setGbpEmail(null);
        setOrderedLocations([]);
        setSelectedLocationId(null);
      }
      setLocationsLoading(false);
    })();
  }, [isGated, simulatedDataEnabled]);

  const handleGbpConnect = async () => {
    setGbpLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.functions.invoke('gbp-auth', {
        body: { action: 'login', user_id: user?.id, frontend_origin: window.location.origin },
      });
      if (error) throw error;
      if (data?.auth_url) window.location.href = data.auth_url;
      else throw new Error('No auth URL');
    } catch (err) {
      console.error('[GMBDashboard] GBP connect error:', err);
      toast.error(language === 'fr' ? 'Erreur de connexion GBP' : 'GBP connection error');
    } finally {
      setGbpLoading(false);
    }
  };

  // Refresh locations from already-connected GBP account (used by "Ajouter" button)
  const handleRefreshLocations = async () => {
    setGbpLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase.functions.invoke('gbp-auth', {
        body: { action: 'status', user_id: user.id },
      });
      if (error) throw error;
      if (data?.connected && data.locations?.length > 0) {
        setOrderedLocations(data.locations);
        if (!selectedLocationId || !data.locations.find((l: any) => l.id === selectedLocationId)) {
          setSelectedLocationId(data.locations[0]?.id || null);
        }
        toast.success(language === 'fr' ? `${data.locations.length} établissement(s) trouvé(s)` : `${data.locations.length} location(s) found`);
      } else if (data?.connected) {
        toast.info(language === 'fr' 
          ? 'Aucun nouvel établissement trouvé. Vérifiez votre compte Google Business.' 
          : 'No new locations found. Check your Google Business account.');
      } else {
        toast.error(language === 'fr' ? 'Connexion GBP expirée, reconnectez-vous.' : 'GBP connection expired, please reconnect.');
        setGbpConnected(false);
      }
    } catch (err) {
      console.error('[GMBDashboard] Refresh locations error:', err);
      toast.error(language === 'fr' ? 'Erreur lors du rafraîchissement' : 'Refresh error');
    } finally {
      setGbpLoading(false);
    }
  };

  const handleGbpDisconnect = async () => {
    setGbpDisconnecting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase.functions.invoke('gbp-auth', {
        body: { action: 'disconnect', user_id: user.id },
      });
      if (error) throw error;
      setGbpConnected(false);
      setGbpEmail(null);
      if (!isGated) {
        setOrderedLocations([]);
        setSelectedLocationId(null);
      }
      toast.success(language === 'fr' ? 'Google Business Profile déconnecté' : 'GBP disconnected');
    } catch (err) {
      console.error('[GMBDashboard] GBP disconnect error:', err);
      toast.error(language === 'fr' ? 'Erreur de déconnexion' : 'Disconnect error');
    } finally {
      setGbpDisconnecting(false);
    }
  };

  const activeLocation = orderedLocations.find(l => l.id === selectedLocationId) || orderedLocations[0];
  const showSidebar = orderedLocations.length > 1;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setOrderedLocations(prev => {
        const oldIndex = prev.findIndex(l => l.id === active.id);
        const newIndex = prev.findIndex(l => l.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  }

  // Loading state for Pro users
  if (locationsLoading && !isGated) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Empty state for Pro users with no GBP connection and no locations
  if (!isGated && orderedLocations.length === 0) {
    // Connected but no locations found
    if (gbpConnected) {
      return (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-8 text-center space-y-4">
              <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500" />
              <div>
                <h3 className="font-semibold text-lg">
                  {language === 'fr' ? 'Compte Google connecté' : 'Google account connected'}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {gbpEmail && <span className="font-medium">{gbpEmail}</span>}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  {language === 'fr' 
                    ? 'Aucun établissement Google Business Profile n\'a été trouvé sur ce compte. Vérifiez que vous avez bien un profil d\'établissement actif sur Google Business.'
                    : 'No Google Business Profile location was found on this account. Make sure you have an active business profile on Google Business.'}
                </p>
              </div>
              <div className="flex gap-2 justify-center">
                <Button 
                  onClick={handleGbpDisconnect} 
                  disabled={gbpDisconnecting} 
                  variant="outline" 
                  className="gap-2 rounded-sm text-destructive border-destructive/40 hover:bg-destructive/5"
                >
                  {gbpDisconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unplug className="h-4 w-4" />}
                  {language === 'fr' ? 'Déconnecter' : 'Disconnect'}
                </Button>
                <Button 
                  onClick={handleGbpConnect} 
                  disabled={gbpLoading} 
                  variant="outline" 
                  className="gap-2 rounded-sm border-foreground/60 text-foreground bg-transparent hover:bg-foreground/5"
                >
                  {gbpLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
                  {language === 'fr' ? 'Reconnecter avec un autre compte' : 'Reconnect with another account'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }
    // Not connected at all
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <Store className="h-12 w-12 mx-auto text-muted-foreground/40" />
            <div>
              <h3 className="font-semibold text-lg">
                {language === 'fr' ? 'Aucun établissement connecté' : 'No location connected'}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {language === 'fr' 
                  ? 'Connectez votre compte Google Business Profile pour gérer vos établissements.'
                  : 'Connect your Google Business Profile account to manage your locations.'}
              </p>
            </div>
            <Button onClick={handleGbpConnect} disabled={gbpLoading} variant="outline" className="gap-2 rounded-sm border-foreground/60 text-foreground bg-transparent hover:bg-foreground/5">
              {gbpLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
              {language === 'fr' ? 'Connecter Google Business' : 'Connect Google Business'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${isGated ? 'relative' : ''}`}>
      {isGated && (
        <div className="absolute inset-0 z-10 pointer-events-none">
          <div className="sticky top-4 flex justify-center pointer-events-auto">
            <Badge className="bg-violet-600/90 text-white gap-1.5 px-4 py-1.5 text-sm shadow-lg backdrop-blur-sm">
              <Store className="h-4 w-4" />
              {language === 'fr' ? 'Données simulées — Abonnez-vous pour connecter votre compte Google Business' 
                : 'Simulated data — Subscribe to connect your Google Business account'}
            </Badge>
          </div>
        </div>
      )}

      {showSimulated && !isGated && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {language === 'fr' ? 'Données simulées — disponible pour vous sous quelques jours.'
            : language === 'es' ? 'Datos simulados — disponible para usted en unos días.'
            : 'Simulated data — available for you within a few days.'}
        </div>
      )}

      <div className="flex gap-4">
        {/* Location sidebar + GBP connect */}
        <div className="flex flex-col gap-1 shrink-0 w-44">
          {showSidebar && (
            <>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={orderedLocations.map(l => l.id)} strategy={verticalListSortingStrategy}>
                  {orderedLocations.map(loc => (
                    <SortableLocationItem
                      key={loc.id}
                      loc={loc}
                      isSelected={selectedLocationId === loc.id}
                      onSelect={() => setSelectedLocationId(loc.id)}
                    />
                  ))}
                </SortableContext>
              </DndContext>

              <Button
                variant="ghost"
                size="sm"
                className="mt-1 gap-1 text-xs text-muted-foreground hover:text-foreground justify-start"
                disabled={gbpLoading}
                onClick={gbpConnected ? handleRefreshLocations : handleGbpConnect}
              >
                {gbpLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                {t.add}
              </Button>
            </>
          )}

          {/* GBP Connect / Disconnect — under add button */}
          <div className="mt-3 pt-3 border-t border-border/40">
            {gbpConnected ? (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 px-1">
                  <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                  <span className="text-[10px] text-muted-foreground truncate">
                    {gbpEmail ? gbpEmail.replace('gbp:', '') : (language === 'fr' ? 'Connecté' : 'Connected')}
                  </span>
                </div>
                <button
                  onClick={handleGbpDisconnect}
                  disabled={gbpDisconnecting}
                  className="flex items-center gap-1.5 px-1 py-1 text-[10px] text-muted-foreground/60 hover:text-destructive transition-colors duration-200 group"
                >
                  {gbpDisconnecting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unplug className="h-3 w-3 group-hover:text-destructive" />}
                  {language === 'fr' ? 'Déconnecter' : 'Disconnect'}
                </button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="mt-1 gap-1 text-xs text-muted-foreground hover:text-foreground justify-start"
                onClick={handleGbpConnect}
                disabled={gbpLoading || isGated}
              >
                {gbpLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plug className="h-3.5 w-3.5" />
                )}
                Google Business
              </Button>
            )}
          </div>
        </div>

      {/* Main content */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Business summary card */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{activeLocation.name}</h3>
                    {activeLocation.verified && (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {activeLocation.address}
                  </p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1">
                    <span className="text-2xl font-bold">{activeLocation.avg_rating}</span>
                    <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                  </div>
                  <p className="text-[10px] text-muted-foreground">{activeLocation.reviews_count} {t.googleReviews}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full grid grid-cols-7 h-9">
              <TabsTrigger value="stats" className="text-xs gap-1">
                <span className="hidden sm:inline">Stats</span>
              </TabsTrigger>
              <TabsTrigger value="keywords" className="text-xs gap-1">
                <Search className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Keywords</span>
              </TabsTrigger>
              <TabsTrigger value="reviews" className="text-xs gap-1">
                <Star className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t.reviewsTab}</span>
              </TabsTrigger>
              <TabsTrigger value="posts" className="text-xs gap-1">
                <span className="hidden sm:inline">Posts</span>
              </TabsTrigger>
              <TabsTrigger value="competitors" className="text-xs gap-1">
                <Swords className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Concurrence</span>
              </TabsTrigger>
              <TabsTrigger value="info" className="text-xs gap-1">
                <span className="hidden sm:inline">Infos</span>
              </TabsTrigger>
              <TabsTrigger value="photos" className="text-xs gap-1">
                <span className="hidden sm:inline">{t.photos}</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="stats">
              <div className="space-y-4">
                <GmbPowerScoreCard trackedSiteId={null} />
                <StatsTab t={t} />
              </div>
            </TabsContent>
            <TabsContent value="keywords">
              <GmbKeywordsTab
                trackedSiteId={null}
                businessName={activeLocation.name}
                businessCategory={activeLocation.category}
                businessCity={activeLocation.address?.split(',').pop()?.trim()}
              />
            </TabsContent>
            <TabsContent value="reviews"><ReviewsTab t={t} language={language} /></TabsContent>
            <TabsContent value="posts"><PostsTab t={t} language={language} /></TabsContent>
            <TabsContent value="competitors">
              <GmbLocalCompetitorsTab
                gmbLocationId={null}
                trackedSiteId={null}
                ownBusinessName={activeLocation.name}
              />
            </TabsContent>
            <TabsContent value="info"><InfoTab location={activeLocation} t={t} /></TabsContent>
            <TabsContent value="photos"><PhotosTab t={t} /></TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
