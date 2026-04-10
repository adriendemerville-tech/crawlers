/**
 * Simulated data for Social Hub demo mode.
 */

export const SIMULATED_SOCIAL_STATS = {
  impressions: 12400,
  clicks: 847,
  likes: 1245,
  shares: 312,
  comments: 189,
  posts: 24,
};

export const SIMULATED_PLATFORM_STATS: Record<string, typeof SIMULATED_SOCIAL_STATS> = {
  linkedin: { impressions: 6200, clicks: 420, likes: 680, shares: 190, comments: 95, posts: 10 },
  facebook: { impressions: 3800, clicks: 280, likes: 350, shares: 80, comments: 62, posts: 8 },
  instagram: { impressions: 2400, clicks: 147, likes: 215, shares: 42, comments: 32, posts: 6 },
};

export const SIMULATED_FEED_POSTS = [
  {
    id: 'demo-1', title: '10 astuces SEO pour 2026', status: 'published' as const,
    content_linkedin: '🚀 Découvrez les 10 meilleures pratiques SEO pour booster votre visibilité en 2026.\n\n1. Optimisez pour l\'intention de recherche\n2. Misez sur le contenu E-E-A-T\n3. Structurez votre maillage interne\n\n#SEO #Marketing #DigitalStrategy',
    content_facebook: '🔥 10 astuces SEO incontournables pour 2026 ! Découvrez comment booster votre visibilité organique avec des stratégies éprouvées.',
    content_instagram: '✨ TOP 10 SEO 2026 ✨\n\nVous voulez dominer les SERPs cette année ? Voici les 10 stratégies que les experts utilisent.\n\n#SEO #Marketing #Growth',
    hashtags: ['#SEO', '#Marketing', '#DigitalStrategy'], publish_platforms: ['linkedin', 'facebook', 'instagram'],
    published_at: '2026-04-08T10:00:00Z', created_at: '2026-04-07T14:30:00Z', image_urls: [],
    metrics: { impressions: 2400, likes: 180, comments: 45, shares: 67 },
  },
  {
    id: 'demo-2', title: 'Google Business Profile : le guide complet', status: 'published' as const,
    content_linkedin: '📍 Votre fiche Google Business est votre vitrine locale. Voici comment l\'optimiser pour attirer plus de clients.\n\nLes 3 erreurs à éviter absolument :\n• Photos de mauvaise qualité\n• Horaires non mis à jour\n• Catégories mal choisies\n\n#GEO #LocalSEO',
    content_facebook: '📍 Saviez-vous que 76% des recherches locales mènent à une visite en magasin ? Optimisez votre fiche Google Business dès maintenant !',
    content_instagram: '📍 LOCAL SEO 101\n\nVotre fiche Google Business = votre vitrine digitale\n\nSwipez pour découvrir les 5 optimisations essentielles →\n\n#GEO #LocalSEO #GoogleBusiness',
    hashtags: ['#GEO', '#LocalSEO'], publish_platforms: ['linkedin', 'facebook'],
    published_at: '2026-04-05T09:00:00Z', created_at: '2026-04-04T16:00:00Z', image_urls: [],
    metrics: { impressions: 1800, likes: 120, comments: 28, shares: 45 },
  },
  {
    id: 'demo-3', title: 'IA et création de contenu', status: 'scheduled' as const,
    content_linkedin: '🤖 L\'IA transforme la création de contenu mais ne remplace pas l\'expertise humaine.\n\nComme outil d\'assistance, elle permet de :\n✅ Gagner du temps sur la recherche\n✅ Structurer les idées\n✅ Adapter le ton par plateforme\n\nMais la valeur ajoutée reste dans VOTRE expertise.\n\n#IA #ContentMarketing',
    content_facebook: '🤖 L\'IA change la donne en marketing de contenu. Mais attention : elle reste un outil, pas un remplaçant !',
    content_instagram: '🤖 IA + CONTENU = 🚀\n\nL\'intelligence artificielle au service de votre stratégie de contenu.\n\n5 cas d\'usage concrets dans notre dernier article →\n\n#IA #ContentMarketing #AIMarketing',
    hashtags: ['#IA', '#ContentMarketing'], publish_platforms: ['linkedin', 'instagram'],
    published_at: null, created_at: '2026-04-09T11:00:00Z', image_urls: [],
    metrics: null,
  },
  {
    id: 'demo-4', title: 'Stratégie de maillage interne', status: 'published' as const,
    content_linkedin: '🕸️ Le maillage interne est un levier SEO souvent sous-estimé.\n\nAvec une bonne stratégie cocon sémantique, vous pouvez :\n📈 +35% de pages indexées\n📈 +22% de temps passé sur site\n📈 +18% de conversions\n\nRetour d\'expérience complet ici 👇\n\n#CocoonSEO #Maillage',
    content_facebook: '🕸️ Le maillage interne peut transformer vos performances SEO. Découvrez notre retour d\'expérience avec des résultats concrets.',
    content_instagram: null,
    hashtags: ['#CocoonSEO', '#Maillage', '#SEO'], publish_platforms: ['linkedin', 'facebook'],
    published_at: '2026-04-02T08:00:00Z', created_at: '2026-04-01T15:00:00Z', image_urls: [],
    metrics: { impressions: 3100, likes: 245, comments: 52, shares: 89 },
  },
  {
    id: 'demo-5', title: 'E-E-A-T : crédibilité et SEO', status: 'published' as const,
    content_linkedin: '🏆 Google valorise l\'expertise, l\'expérience et la fiabilité.\n\nE-E-A-T n\'est pas un facteur de ranking direct, mais influence la qualité perçue de votre contenu.\n\n3 actions concrètes pour renforcer votre E-E-A-T :\n1. Ajoutez des auteurs experts\n2. Citez vos sources\n3. Mettez à jour régulièrement\n\n#EEAT #Trust #SEO',
    content_facebook: '🏆 E-E-A-T : le secret pour que Google vous fasse confiance. 3 actions concrètes dans notre dernier guide.',
    content_instagram: '🏆 E-E-A-T DECODED\n\nExpertise · Expérience · Autorité · Fiabilité\n\nLa recette Google pour un contenu de qualité ✅\n\n#EEAT #Trust #SEO #ContentQuality',
    hashtags: ['#EEAT', '#Trust', '#SEO'], publish_platforms: ['linkedin', 'facebook', 'instagram'],
    published_at: '2026-03-28T10:00:00Z', created_at: '2026-03-27T14:00:00Z', image_urls: [],
    metrics: { impressions: 4200, likes: 310, comments: 78, shares: 112 },
  },
];

export const SIMULATED_CALENDAR_EVENTS = [
  { id: 'cal-1', title: '10 astuces SEO 2026', event_date: formatDate(0), event_time: '10:00', recurrence: 'none', color: '#3b82f6', post_id: 'demo-1', platforms: ['linkedin', 'facebook'], is_auto_generated: false },
  { id: 'cal-2', title: 'Google Business Guide', event_date: formatDate(3), event_time: '09:00', recurrence: 'none', color: '#10b981', post_id: 'demo-2', platforms: ['linkedin'], is_auto_generated: false },
  { id: 'cal-3', title: 'IA et contenu (auto)', event_date: formatDate(7), event_time: '14:00', recurrence: 'none', color: '#8b5cf6', post_id: 'demo-3', platforms: ['linkedin', 'instagram'], is_auto_generated: true },
  { id: 'cal-4', title: 'Newsletter SEO mensuelle', event_date: formatDate(12), event_time: '08:00', recurrence: 'monthly', color: '#f59e0b', post_id: null, platforms: ['linkedin', 'facebook'], is_auto_generated: true },
  { id: 'cal-5', title: 'Retour expérience client', event_date: formatDate(18), event_time: '11:00', recurrence: 'none', color: '#ef4444', post_id: null, platforms: ['linkedin'], is_auto_generated: false },
  { id: 'cal-6', title: 'Astuce de la semaine', event_date: formatDate(5), event_time: '16:00', recurrence: 'weekly', color: '#06b6d4', post_id: null, platforms: ['instagram'], is_auto_generated: true },
];

export const SIMULATED_ACTION_ITEMS = [
  { id: 'act-1', title: 'Créer un post LinkedIn sur les Core Web Vitals', finding_category: 'performance', severity: 'high', priority_tag: 'P1', status: 'pending', score: 145, description: 'Les métriques de performance de votre site se sont améliorées. Communiquez ces résultats sur LinkedIn pour renforcer votre crédibilité technique.' },
  { id: 'act-2', title: 'Partager le guide E-E-A-T sur les 3 plateformes', finding_category: 'content', severity: 'medium', priority_tag: 'P2', status: 'pending', score: 128, description: 'Votre guide E-E-A-T a généré beaucoup de trafic organique. Amplifiez via les réseaux sociaux.' },
  { id: 'act-3', title: 'Promouvoir la nouvelle page cocon sémantique', finding_category: 'architecture', severity: 'high', priority_tag: 'P1', status: 'in_progress', score: 162, description: 'La nouvelle structure cocon est déployée. Créez du contenu social pour attirer du trafic vers ces pages.' },
  { id: 'act-4', title: 'Annoncer la mise à jour du blog', finding_category: 'content', severity: 'low', priority_tag: 'P3', status: 'pending', score: 85, description: '12 articles ont été mis à jour ce mois-ci. Préparez un post récapitulatif.' },
  { id: 'act-5', title: 'Campagne social backlinks guest posts', finding_category: 'backlinks', severity: 'medium', priority_tag: 'P2', status: 'pending', score: 110, description: 'Vous avez obtenu 3 nouveaux guest posts. Partagez-les sur les réseaux pour maximiser leur impact.' },
];

function formatDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split('T')[0];
}
