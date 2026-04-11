import { corsHeaders } from '../_shared/cors.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { writeIdentity } from '../_shared/identityGateway.ts';

/* ── LocalBusiness schema types recognized by Google ─────────────── */
const LOCAL_BUSINESS_TYPES = new Set([
  'LocalBusiness', 'Restaurant', 'ItalianRestaurant', 'FrenchRestaurant',
  'MexicanRestaurant', 'IndianRestaurant', 'JapaneseRestaurant',
  'BarOrPub', 'CafeOrCoffeeShop', 'Bakery', 'FastFoodRestaurant',
  'FoodEstablishment', 'Store', 'ClothingStore', 'ElectronicsStore',
  'HardwareStore', 'GroceryStore', 'BookStore', 'ShoeStore',
  'SportingGoodsStore', 'ToyStore', 'PetStore', 'FurnitureStore',
  'JewelryStore', 'LiquorStore', 'MobilePhoneStore', 'ConvenienceStore',
  'AutoPartsStore', 'TireShop', 'AutoRepair', 'AutoDealer',
  'GasStation', 'HairSalon', 'BeautySalon', 'NailSalon', 'DaySpa',
  'HealthAndBeautyBusiness', 'Dentist', 'Physician', 'Pharmacy',
  'Hospital', 'MedicalClinic', 'VeterinaryCare', 'Optician',
  'LegalService', 'Attorney', 'Notary', 'AccountingService',
  'FinancialService', 'InsuranceAgency', 'RealEstateAgent',
  'TravelAgency', 'LodgingBusiness', 'Hotel', 'Motel', 'Hostel',
  'BedAndBreakfast', 'Campground',
  'EntertainmentBusiness', 'MovieTheater', 'NightClub', 'Casino',
  'AmusementPark', 'BowlingAlley',
  'SportsActivityLocation', 'GolfCourse', 'SkiResort', 'Stadium',
  'ExerciseGym', 'TennisComplex', 'PublicSwimmingPool',
  'ChildCare', 'DryCleaningOrLaundry', 'EmergencyService',
  'Florist', 'FuneralHome', 'GovernmentOffice', 'Library',
  'ProfessionalService', 'HomeAndConstructionBusiness',
  'Electrician', 'Plumber', 'RoofingContractor', 'HVACBusiness',
  'LocksmithService', 'MovingCompany', 'Photographer',
  'TattooParlor', 'CateringService', 'EventVenue',
  'CoworkingSpace', 'InternetCafe',
]);

/* ── Category → most specific @type mapping ──────────────────────── */
const GMB_CATEGORY_TO_TYPE: Record<string, string> = {
  'restaurant': 'Restaurant',
  'italian restaurant': 'ItalianRestaurant',
  'french restaurant': 'FrenchRestaurant',
  'japanese restaurant': 'JapaneseRestaurant',
  'mexican restaurant': 'MexicanRestaurant',
  'indian restaurant': 'IndianRestaurant',
  'bakery': 'Bakery',
  'cafe': 'CafeOrCoffeeShop',
  'bar': 'BarOrPub',
  'hair salon': 'HairSalon',
  'beauty salon': 'BeautySalon',
  'dentist': 'Dentist',
  'plumber': 'Plumber',
  'electrician': 'Electrician',
  'real estate agent': 'RealEstateAgent',
  'hotel': 'Hotel',
  'gym': 'ExerciseGym',
  'clothing store': 'ClothingStore',
  'florist': 'Florist',
  'veterinarian': 'VeterinaryCare',
  'pharmacy': 'Pharmacy',
  'lawyer': 'Attorney',
  'accountant': 'AccountingService',
  'auto repair': 'AutoRepair',
  'caterer': 'CateringService',
  'photographer': 'Photographer',
};

/* ── Detect local business signals from HTML content ─────────────── */
interface LocalSignals {
  hasAddress: boolean;
  hasPhone: boolean;
  hasOpeningHours: boolean;
  hasGeoCoordinates: boolean;
  hasLocalBusinessSchema: boolean;
  detectedSchemaType: string | null;
  hasMapEmbed: boolean;
  hasCityMentions: boolean;
  schemaFields: {
    type: string | null;
    geo: boolean;
    areaServed: boolean;
    priceRange: boolean;
    aggregateRating: boolean;
    openingHours: boolean;
  };
}

function detectLocalSignals(html: string): LocalSignals {
  const lower = html.toLowerCase();

  // Address patterns (French / international)
  const hasAddress = /(\d{1,5}\s+(rue|avenue|boulevard|chemin|place|allée|impasse|cours))|(\d{5}\s+[a-zéèàê]+)/i.test(html)
    || /"streetAddress"/i.test(html) || /"postalCode"/i.test(html);

  // Phone
  const hasPhone = /(\+?\d{1,3}[\s.-]?\(?\d{1,4}\)?[\s.-]?\d{2,4}[\s.-]?\d{2,4}[\s.-]?\d{0,4})/.test(html)
    && (/"telephone"/i.test(html) || /href="tel:/i.test(html));

  // Opening hours
  const hasOpeningHours = /"openingHoursSpecification"/i.test(html) || /"openingHours"/i.test(html)
    || /horaires?\s*(d['']ouverture)?/i.test(html);

  // Geo coordinates
  const hasGeoCoordinates = /"geo"\s*:\s*\{/i.test(html) && /"latitude"/i.test(html);

  // Map embed
  const hasMapEmbed = /maps\.google|google\.com\/maps|openstreetmap\.org/i.test(html)
    || /iframe.*maps/i.test(html);

  // City mentions (simple heuristic)
  const hasCityMentions = /\b(paris|lyon|marseille|toulouse|nice|nantes|strasbourg|montpellier|bordeaux|lille|rennes|reims|toulon|grenoble)\b/i.test(html);

  // Detect LocalBusiness schema
  let detectedSchemaType: string | null = null;
  let hasLocalBusinessSchema = false;
  for (const type of LOCAL_BUSINESS_TYPES) {
    const regex = new RegExp(`"@type"\\s*:\\s*"${type}"`, 'i');
    if (regex.test(html)) {
      detectedSchemaType = type;
      hasLocalBusinessSchema = true;
      break;
    }
  }

  // Audit individual schema fields
  const schemaFields = {
    type: detectedSchemaType,
    geo: hasGeoCoordinates,
    areaServed: /"areaServed"/i.test(html),
    priceRange: /"priceRange"/i.test(html),
    aggregateRating: /"aggregateRating"/i.test(html),
    openingHours: /"openingHoursSpecification"/i.test(html),
  };

  return {
    hasAddress, hasPhone, hasOpeningHours, hasGeoCoordinates,
    hasLocalBusinessSchema, detectedSchemaType, hasMapEmbed,
    hasCityMentions, schemaFields,
  };
}

/* ── Determine if a site is a local business ─────────────────────── */
function isLocalBusiness(signals: LocalSignals, gmbConnected: boolean, entityType: string | null): { isLocal: boolean; confidence: number } {
  let score = 0;
  if (signals.hasLocalBusinessSchema) score += 35;
  if (gmbConnected) score += 25;
  if (signals.hasAddress) score += 10;
  if (signals.hasPhone) score += 5;
  if (signals.hasOpeningHours) score += 10;
  if (signals.hasMapEmbed) score += 5;
  if (signals.hasCityMentions) score += 5;
  if (signals.hasGeoCoordinates) score += 5;
  if (entityType && ['commerce', 'artisan', 'restaurant', 'prestataire_local', 'profession_liberale'].includes(entityType)) score += 15;

  return { isLocal: score >= 30, confidence: Math.min(score, 100) };
}

/* ── Audit the 6 critical LocalBusiness schema signals ────────────── */
interface SchemaAuditResult {
  score: number; // 0-100
  status: 'missing' | 'partial' | 'complete';
  signals: {
    key: string;
    label: string;
    status: 'ok' | 'missing' | 'generic';
    recommendation: string;
    priority: 'critical' | 'high' | 'medium';
  }[];
  recommended_type: string;
  generated_schema: Record<string, unknown> | null;
}

function auditLocalSchema(
  signals: LocalSignals,
  gmbData: { category?: string; address?: string; phone?: string; hours?: any; place_id?: string; location_name?: string; avg_rating?: number; total_reviews?: number } | null,
  domain: string,
  brandName: string | null,
): SchemaAuditResult {
  const results: SchemaAuditResult['signals'] = [];

  // 1. @type — must be specific, not just "LocalBusiness"
  const gmbCategory = gmbData?.category?.toLowerCase() || '';
  const mappedType = GMB_CATEGORY_TO_TYPE[gmbCategory] || null;
  const recommendedType = mappedType || signals.detectedSchemaType || 'LocalBusiness';

  if (!signals.schemaFields.type) {
    results.push({ key: 'type', label: '@type exact', status: 'missing', recommendation: `Ajouter "@type": "${recommendedType}" — le sous-type spécifique fait toute la différence pour Google`, priority: 'critical' });
  } else if (signals.schemaFields.type === 'LocalBusiness' && mappedType) {
    results.push({ key: 'type', label: '@type exact', status: 'generic', recommendation: `Remplacer "LocalBusiness" par "${mappedType}" pour plus de précision (basé sur votre catégorie GMB)`, priority: 'high' });
  } else {
    results.push({ key: 'type', label: '@type exact', status: 'ok', recommendation: `Type "${signals.schemaFields.type}" détecté — spécifique ✓`, priority: 'medium' });
  }

  // 2. GeoCoordinates
  if (!signals.schemaFields.geo) {
    results.push({ key: 'geo', label: 'GeoCoordinates', status: 'missing', recommendation: 'Ajouter latitude et longitude précises (pas approximatives) — essentiel pour le Local Pack', priority: 'critical' });
  } else {
    results.push({ key: 'geo', label: 'GeoCoordinates', status: 'ok', recommendation: 'Coordonnées géographiques détectées ✓', priority: 'medium' });
  }

  // 3. AreaServed
  if (!signals.schemaFields.areaServed) {
    results.push({ key: 'areaServed', label: 'AreaServed', status: 'missing', recommendation: 'Ajouter les quartiers et zones réellement desservis — différencie des concurrents nationaux', priority: 'high' });
  } else {
    results.push({ key: 'areaServed', label: 'AreaServed', status: 'ok', recommendation: 'Zones desservies déclarées ✓', priority: 'medium' });
  }

  // 4. PriceRange
  if (!signals.schemaFields.priceRange) {
    results.push({ key: 'priceRange', label: 'PriceRange', status: 'missing', recommendation: 'Ajouter la vraie fourchette de prix (ex: "25€-80€"), pas "€€€" générique', priority: 'medium' });
  } else {
    results.push({ key: 'priceRange', label: 'PriceRange', status: 'ok', recommendation: 'Fourchette de prix détectée ✓', priority: 'medium' });
  }

  // 5. AggregateRating
  if (!signals.schemaFields.aggregateRating) {
    const ratingNote = gmbData?.avg_rating ? ` Votre note Google : ${gmbData.avg_rating}/5 (${gmbData.total_reviews} avis) — synchronisez-la !` : '';
    results.push({ key: 'aggregateRating', label: 'AggregateRating', status: 'missing', recommendation: `Synchroniser avec vos avis Google réels.${ratingNote}`, priority: 'high' });
  } else {
    results.push({ key: 'aggregateRating', label: 'AggregateRating', status: 'ok', recommendation: 'Note agrégée détectée ✓', priority: 'medium' });
  }

  // 6. openingHoursSpecification
  if (!signals.schemaFields.openingHours) {
    results.push({ key: 'openingHours', label: 'openingHoursSpecification', status: 'missing', recommendation: 'Ajouter les horaires exacts par jour — Google les affiche dans le Knowledge Panel', priority: 'high' });
  } else {
    results.push({ key: 'openingHours', label: 'openingHoursSpecification', status: 'ok', recommendation: 'Horaires structurés détectés ✓', priority: 'medium' });
  }

  const okCount = results.filter(r => r.status === 'ok').length;
  const score = Math.round((okCount / results.length) * 100);
  const status: SchemaAuditResult['status'] = okCount === 0 ? 'missing' : okCount === results.length ? 'complete' : 'partial';

  return { score, status, signals: results, recommended_type: recommendedType, generated_schema: null };
}

/* ── Generate complete LocalBusiness JSON-LD from GMB + crawl data ── */
function generateLocalBusinessSchema(
  auditResult: SchemaAuditResult,
  gmbData: { category?: string; address?: string; phone?: string; hours?: any; place_id?: string; location_name?: string; avg_rating?: number; total_reviews?: number; website?: string } | null,
  domain: string,
  brandName: string | null,
  locationDetail: string | null,
): Record<string, unknown> {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': auditResult.recommended_type,
    'name': brandName || gmbData?.location_name || domain,
    'url': gmbData?.website || `https://${domain}`,
  };

  // Address from GMB
  if (gmbData?.address) {
    // Parse GMB address (format: "street, city, postal, country")
    const parts = gmbData.address.split(',').map(p => p.trim());
    schema['address'] = {
      '@type': 'PostalAddress',
      'streetAddress': parts[0] || '',
      'addressLocality': parts[1] || locationDetail || '',
      'postalCode': parts[2] || '',
      'addressCountry': parts[3] || 'FR',
    };
  }

  // Phone
  if (gmbData?.phone) {
    schema['telephone'] = gmbData.phone;
  }

  // Geo — placeholder with instruction
  schema['geo'] = {
    '@type': 'GeoCoordinates',
    'latitude': '/* Remplacez par votre latitude exacte */',
    'longitude': '/* Remplacez par votre longitude exacte */',
  };

  // AreaServed
  if (locationDetail) {
    schema['areaServed'] = {
      '@type': 'City',
      'name': locationDetail,
    };
  }

  // PriceRange — placeholder
  schema['priceRange'] = '/* Ex: "25€-80€" — pas "€€€" */';

  // AggregateRating from GMB
  if (gmbData?.avg_rating && gmbData.total_reviews) {
    schema['aggregateRating'] = {
      '@type': 'AggregateRating',
      'ratingValue': gmbData.avg_rating,
      'reviewCount': gmbData.total_reviews,
      'bestRating': 5,
      'worstRating': 1,
    };
  }

  // Opening hours from GMB
  if (gmbData?.hours && typeof gmbData.hours === 'object') {
    const daysMap: Record<string, string> = {
      'monday': 'Mo', 'tuesday': 'Tu', 'wednesday': 'We', 'thursday': 'Th',
      'friday': 'Fr', 'saturday': 'Sa', 'sunday': 'Su',
      'lundi': 'Mo', 'mardi': 'Tu', 'mercredi': 'We', 'jeudi': 'Th',
      'vendredi': 'Fr', 'samedi': 'Sa', 'dimanche': 'Su',
    };

    const specs: Record<string, unknown>[] = [];
    const hours = gmbData.hours as Record<string, any>;
    for (const [day, times] of Object.entries(hours)) {
      const dayCode = daysMap[day.toLowerCase()];
      if (!dayCode || !times) continue;
      if (typeof times === 'string' && times.includes('-')) {
        const [opens, closes] = times.split('-').map((t: string) => t.trim());
        specs.push({
          '@type': 'OpeningHoursSpecification',
          'dayOfWeek': dayCode,
          'opens': opens,
          'closes': closes,
        });
      }
    }
    if (specs.length > 0) {
      schema['openingHoursSpecification'] = specs;
    }
  }

  return schema;
}

/* ── Main handler ─────────────────────────────────────────────────── */
handleRequest(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const body = await req.json();
  const { tracked_site_id, html_content, user_id, url: inputUrl, domain: inputDomain } = body;

  if (!user_id) {
    return jsonError('Missing user_id', 400);
  }

  const supabase = getServiceClient();

  let siteDomain = inputDomain || '';
  let brandName: string | null = null;
  let entityType: string | null = null;
  let locationDetail: string | null = null;
  let gmbData: any = null;

  // Mode 1: tracked_site_id provided → full data from DB + GMB
  if (tracked_site_id) {
    const { data: site } = await supabase
      .from('tracked_sites')
      .select('domain, brand_name, entity_type, location_detail, gmb_presence, gmb_city')
      .eq('id', tracked_site_id)
      .single();

    if (site) {
      siteDomain = site.domain;
      brandName = site.brand_name;
      entityType = site.entity_type;
      locationDetail = site.location_detail;

      // Fetch GMB data
      const { data: gmbLocation } = await supabase
        .from('gmb_locations')
        .select('location_name, category, address, phone, hours, place_id, website')
        .eq('tracked_site_id', tracked_site_id)
        .maybeSingle();

      if (gmbLocation) {
        const { data: perf } = await supabase
          .from('gmb_performance')
          .select('avg_rating, total_reviews')
          .eq('gmb_location_id', gmbLocation.place_id || '')
          .order('measured_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        gmbData = {
          ...gmbLocation,
          avg_rating: perf?.avg_rating || null,
          total_reviews: perf?.total_reviews || null,
        };
      }
    }
  }
  // Mode 2: URL-only mode (from expert audit) — also try to find tracked site by domain
  else if (inputDomain || inputUrl) {
    siteDomain = inputDomain || new URL(inputUrl).hostname.replace(/^www\./, '');

    // Try to find a tracked site for this user + domain to get GMB data
    const { data: site } = await supabase
      .from('tracked_sites')
      .select('id, brand_name, entity_type, location_detail')
      .eq('user_id', user_id)
      .eq('domain', siteDomain)
      .maybeSingle();

    if (site) {
      brandName = site.brand_name;
      entityType = site.entity_type;
      locationDetail = site.location_detail;

      // Fetch GMB data via the found tracked site
      const { data: gmbLocation } = await supabase
        .from('gmb_locations')
        .select('location_name, category, address, phone, hours, place_id, website')
        .eq('tracked_site_id', site.id)
        .maybeSingle();

      if (gmbLocation) {
        const { data: perf } = await supabase
          .from('gmb_performance')
          .select('avg_rating, total_reviews')
          .eq('gmb_location_id', gmbLocation.place_id || '')
          .order('measured_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        gmbData = {
          ...gmbLocation,
          avg_rating: perf?.avg_rating || null,
          total_reviews: perf?.total_reviews || null,
        };
      }
    }
  } else {
    return jsonError('Missing tracked_site_id, url, or domain', 400);
  }

  // Fetch HTML if not provided
  let html = html_content || '';
  if (!html && siteDomain) {
    try {
      const resp = await fetch(`https://${siteDomain}`, {
        headers: { 'User-Agent': 'Crawlers-LocalSchema-Auditor/1.0' },
        signal: AbortSignal.timeout(10000),
      });
      if (resp.ok) html = await resp.text();
    } catch (e) {
      console.warn(`[audit-local-schema] Could not fetch ${siteDomain}:`, e);
    }
  }

  // Detect local signals
  const signals = detectLocalSignals(html);
  const { isLocal, confidence } = isLocalBusiness(signals, !!gmbData, entityType);

  // Audit schema
  const audit = auditLocalSchema(signals, gmbData, siteDomain, brandName);

  // Generate schema if local business
  let generatedSchema: Record<string, unknown> | null = null;
  if (isLocal) {
    generatedSchema = generateLocalBusinessSchema(audit, gmbData, siteDomain, brandName, locationDetail);
    audit.generated_schema = generatedSchema;
  }

  // Save to tracked_sites if we have a tracked_site_id
  if (tracked_site_id) {
    await writeIdentity({
      siteId: tracked_site_id,
      fields: {
        is_local_business: isLocal,
        local_schema_status: audit.status,
        local_schema_audit: {
          score: audit.score,
          status: audit.status,
          signals: audit.signals,
          recommended_type: audit.recommended_type,
          detection_confidence: confidence,
          gmb_connected: !!gmbData,
          audited_at: new Date().toISOString(),
        },
      },
      source: 'expert_audit',
      userId: user_id,
    });
  }

  return jsonOk({
    is_local_business: isLocal,
    detection_confidence: confidence,
    schema_audit: audit,
    generated_schema: generatedSchema,
    gmb_data_used: !!gmbData,
  });
});
