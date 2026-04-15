// Expert Lexicon Terms - Wiki Expert System for Crawlers.fr
// 20 advanced technical terms covering Anti-Bot, Data & AI, Architecture, and Ethics

export interface ExpertTerm {
  slug: string;
  term: string;
  category: 'anti-bot' | 'data-ai' | 'architecture' | 'ethics';
  microDefinition: string; // 15 words max
  fullDefinition: string; // AI-Ready snippet-optimized definition
  deepDive: string; // Rich technical explanation
  codeExample: {
    language: 'python' | 'javascript' | 'typescript';
    code: string;
    description: string;
  };
  expertOpinion: string; // 2026 trends and analysis
  relatedTerms: string[]; // Slugs of related terms
  updatedAt: string; // ISO date for SEO freshness
}

export const expertTermsData: Record<string, ExpertTerm[]> = {
  fr: [
    // === ANTI-BOT DETECTION ===
    {
      slug: 'tls-fingerprinting',
      term: 'TLS Fingerprinting',
      category: 'anti-bot',
      microDefinition: 'Identification des clients via leur signature de négociation SSL/TLS unique.',
      fullDefinition: 'Le TLS Fingerprinting est une technique d\'identification des clients web basée sur l\'analyse de leur négociation TLS (Transport Layer Security). Chaque navigateur, bibliothèque HTTP ou bot génère une empreinte unique lors du handshake SSL, incluant les cipher suites supportées, les extensions TLS et l\'ordre des paramètres. Les systèmes anti-bot comme Cloudflare utilisent le hash JA3 pour détecter et bloquer les scrapers automatisés.',
      deepDive: `## Pourquoi le TLS Fingerprinting est crucial en 2026

Le TLS Fingerprinting représente l'une des techniques de détection anti-bot les plus efficaces et les plus difficiles à contourner. Contrairement aux headers User-Agent facilement falsifiables, la signature TLS est générée au niveau de la couche transport, avant même l'envoi de la requête HTTP.

### Comment fonctionne la détection

1. **Handshake TLS** : Lors de la connexion HTTPS, le client envoie un "ClientHello" contenant ses capacités cryptographiques
2. **Génération du hash JA3** : Le serveur calcule un hash MD5 des paramètres TLS (version, cipher suites, extensions, courbes elliptiques)
3. **Comparaison avec une base** : Ce hash est comparé aux empreintes connues de navigateurs légitimes

### Implications pour le web scraping

Les bibliothèques Python standard (requests, urllib) génèrent des empreintes TLS facilement identifiables comme non-navigateur. En 2026, plus de 70% des sites à fort trafic utilisent cette technique de détection.

### Protocoles JA3 et JA3S

- **JA3** : Hash de l'empreinte client (ClientHello)
- **JA3S** : Hash de la réponse serveur (ServerHello)
- La combinaison JA3+JA3S permet une identification encore plus précise`,
      codeExample: {
        language: 'python',
        code: `# Contournement TLS Fingerprinting avec curl_cffi
from curl_cffi import requests

# Impersonate un vrai navigateur Chrome
session = requests.Session(impersonate="chrome120")

response = session.get(
    "https://example.com/protected-page",
    headers={
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "fr-FR,fr;q=0.9"
    }
)

# Le hash JA3 sera identique à Chrome 120
print(f"Status: {response.status_code}")
print(f"Content length: {len(response.text)}")`,
        description: 'Utilisation de curl_cffi pour imiter l\'empreinte TLS de Chrome 120'
      },
      expertOpinion: 'En 2026, le TLS Fingerprinting devient la première ligne de défense des CDN. Les techniques de contournement comme curl_cffi ou tls-client sont essentielles pour tout projet de scraping professionnel. Attention : l\'utilisation de ces techniques sur des sites sans autorisation peut violer leurs conditions d\'utilisation.',
      relatedTerms: ['ja3-ja3s', 'behavioral-analysis', 'headless-browsing'],
      updatedAt: '2026-02-01'
    },
    {
      slug: 'ja3-ja3s',
      term: 'JA3 / JA3S',
      category: 'anti-bot',
      microDefinition: 'Hashes MD5 identifiant les empreintes SSL client et serveur.',
      fullDefinition: 'JA3 et JA3S sont des méthodes de fingerprinting réseau développées par Salesforce. JA3 génère un hash MD5 à partir des paramètres du ClientHello TLS (version SSL, cipher suites, extensions). JA3S fait de même pour le ServerHello. Ces signatures permettent d\'identifier précisément le client HTTP utilisé, même si les headers sont falsifiés.',
      deepDive: `## JA3/JA3S : L'ADN de votre connexion HTTPS

### Composition du hash JA3

Le hash JA3 est calculé à partir de 5 paramètres du ClientHello, concaténés et séparés par des virgules :

1. **SSLVersion** : Version TLS (ex: 771 pour TLS 1.2)
2. **Ciphers** : Liste des cipher suites supportées
3. **Extensions** : Extensions TLS activées
4. **EllipticCurves** : Courbes elliptiques pour ECDHE
5. **EllipticCurvePointFormats** : Formats de points des courbes

### Exemple de calcul

\`\`\`
Input: 771,4865-4866-4867-49195-49199,0-23-65281-10-11-35-16-5-13-18-51-45-43,29-23-24,0
Hash MD5: bd0bf25947d4a37404f0424edf4db9ad
\`\`\`

### Bases de données JA3

Des services comme ja3er.com maintiennent des bases de données de hashes connus, permettant d\'identifier :
- Navigateurs (Chrome, Firefox, Safari avec leurs versions)
- Bibliothèques (Python requests, Node.js axios)
- Bots malveillants

### Limites du JA3

- Peut varier selon l'OS et la configuration
- TLS 1.3 réduit les informations disponibles
- Nécessite une mise à jour constante des bases`,
      codeExample: {
        language: 'python',
        code: `# Calculer le hash JA3 d'une connexion
import hashlib

def compute_ja3(client_hello):
    """
    Calcule le hash JA3 à partir des paramètres ClientHello
    """
    # Extraction des paramètres
    ssl_version = client_hello.get('version', 771)
    ciphers = ','.join(map(str, client_hello.get('cipher_suites', [])))
    extensions = ','.join(map(str, client_hello.get('extensions', [])))
    curves = ','.join(map(str, client_hello.get('elliptic_curves', [])))
    point_formats = ','.join(map(str, client_hello.get('ec_point_formats', [])))
    
    # Construction de la chaîne JA3
    ja3_string = f"{ssl_version},{ciphers},{extensions},{curves},{point_formats}"
    
    # Hash MD5
    ja3_hash = hashlib.md5(ja3_string.encode()).hexdigest()
    
    return ja3_hash, ja3_string

# Exemple
client_hello = {
    'version': 771,
    'cipher_suites': [4865, 4866, 4867, 49195],
    'extensions': [0, 23, 65281, 10, 11],
    'elliptic_curves': [29, 23, 24],
    'ec_point_formats': [0]
}

ja3_hash, ja3_raw = compute_ja3(client_hello)
print(f"JA3 Hash: {ja3_hash}")
print(f"JA3 Raw: {ja3_raw}")`,
        description: 'Calcul du hash JA3 à partir des paramètres ClientHello TLS'
      },
      expertOpinion: 'JA3/JA3S restent en 2026 le standard de facto pour l\'identification TLS. Cependant, l\'adoption croissante de TLS 1.3 avec ses extensions chiffrées (ECH) pourrait réduire l\'efficacité de cette technique d\'ici 2027. Les équipes anti-fraude combinent désormais JA3 avec l\'analyse comportementale.',
      relatedTerms: ['tls-fingerprinting', 'user-agent-spoofing'],
      updatedAt: '2026-02-01'
    },
    {
      slug: 'behavioral-analysis',
      term: 'Behavioral Analysis',
      category: 'anti-bot',
      microDefinition: 'Détection des bots par analyse des patterns de navigation humaine.',
      fullDefinition: 'L\'analyse comportementale (Behavioral Analysis) étudie les patterns d\'interaction utilisateur pour distinguer les humains des bots. Elle mesure les mouvements de souris, la vitesse de scroll, les délais entre clics, et les séquences de navigation. Des solutions comme DataDome ou PerimeterX utilisent le machine learning pour détecter les comportements non-humains.',
      deepDive: `## L'art de détecter les robots par leur comportement

### Signaux analysés

**Mouvements de souris**
- Trajectoires trop linéaires = suspect
- Accélérations/décélérations naturelles
- Micro-corrections typiquement humaines

**Patterns de scroll**
- Vitesse et régularité du défilement
- Pauses de lecture réalistes
- Scroll jusqu'en bas sans lecture = bot probable

**Timing des interactions**
- Délai entre le chargement et le premier clic
- Temps de lecture du contenu
- Intervalles entre les requêtes

### Machine Learning anti-bot

Les systèmes modernes utilisent des modèles entraînés sur des millions de sessions :
- Classification supervisée (sessions humaines vs bots)
- Détection d'anomalies en temps réel
- Scoring de confiance par session

### Défis pour le scraping

La simulation de comportement humain réaliste est complexe car :
- Les patterns doivent être aléatoires mais cohérents
- Chaque site a ses propres heuristiques
- Les modèles évoluent constamment`,
      codeExample: {
        language: 'python',
        code: `# Simulation de comportement humain avec Playwright
import asyncio
import random
from playwright.async_api import async_playwright

async def human_like_browse(page, url):
    """Simule un comportement de navigation humain"""
    
    await page.goto(url)
    
    # Attente aléatoire (lecture)
    await asyncio.sleep(random.uniform(2, 5))
    
    # Mouvement de souris naturel
    for _ in range(random.randint(3, 7)):
        x = random.randint(100, 800)
        y = random.randint(100, 600)
        await page.mouse.move(x, y, steps=random.randint(10, 25))
        await asyncio.sleep(random.uniform(0.1, 0.3))
    
    # Scroll progressif avec pauses
    scroll_steps = random.randint(3, 6)
    for i in range(scroll_steps):
        scroll_amount = random.randint(200, 500)
        await page.evaluate(f"window.scrollBy(0, {scroll_amount})")
        await asyncio.sleep(random.uniform(1, 3))
    
    # Clic aléatoire sur un lien
    links = await page.query_selector_all('a[href]')
    if links:
        random_link = random.choice(links[:10])
        await random_link.hover()
        await asyncio.sleep(random.uniform(0.2, 0.5))
        await random_link.click()

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()
        await human_like_browse(page, "https://example.com")

asyncio.run(main())`,
        description: 'Simulation de navigation humaine avec mouvements de souris et scroll réalistes'
      },
      expertOpinion: 'L\'analyse comportementale représente le futur de la détection anti-bot. En 2026, les systèmes comme Kasada ou HUMAN utilisent des réseaux de neurones analysant plus de 200 signaux par session. Pour les scrapers éthiques, la meilleure approche reste d\'utiliser des navigateurs headless avec des délais réalistes et de respecter les conditions d\'utilisation.',
      relatedTerms: ['headless-browsing', 'canvas-fingerprinting'],
      updatedAt: '2026-02-01'
    },
    {
      slug: 'ip-rotation-proxies',
      term: 'IP Rotation & Residential Proxies',
      category: 'anti-bot',
      microDefinition: 'Changement d\'adresses IP pour éviter les blocages de scraping.',
      fullDefinition: 'L\'IP Rotation consiste à alterner les adresses IP sources lors du web scraping pour éviter les rate limits et les blocages. Les Residential Proxies utilisent des IP d\'utilisateurs résidentiels réels, les rendant indistinguables du trafic légitime. Cette technique est essentielle pour le scraping à grande échelle mais soulève des questions éthiques.',
      deepDive: `## Stratégies de rotation IP en 2026

### Types de proxies

**Datacenter Proxies**
- IP de centres de données (AWS, OVH...)
- Rapides et peu coûteux
- Facilement détectables par les systèmes anti-bot

**Residential Proxies**
- IP de FAI résidentiels réels
- Difficiles à distinguer du trafic humain
- Plus chers, géolocalisables par ville

**Mobile Proxies**
- IP de réseaux 4G/5G
- Rotation naturelle du carrier
- Très haute confiance mais coûteux

### Stratégies de rotation

1. **Rotation par requête** : Nouvelle IP à chaque appel
2. **Sticky sessions** : Même IP pendant X minutes
3. **Géo-targeting** : Pool d'IP par pays/région
4. **Rotation intelligente** : Changement après erreur 429/403

### Considérations légales

L'utilisation de proxies résidentiels peut impliquer :
- Utilisation de bande passante d'utilisateurs (via SDK)
- Questions sur le consentement des utilisateurs
- Violation potentielle des CGU des sites cibles`,
      codeExample: {
        language: 'python',
        code: `# Rotation IP avec backoff intelligent
import httpx
import random
from typing import List
import asyncio

class ProxyRotator:
    def __init__(self, proxies: List[str]):
        self.proxies = proxies
        self.current_index = 0
        self.failed_proxies = set()
    
    def get_next_proxy(self) -> str:
        """Retourne le prochain proxy disponible"""
        available = [p for p in self.proxies if p not in self.failed_proxies]
        if not available:
            self.failed_proxies.clear()  # Reset si tous échoués
            available = self.proxies
        return random.choice(available)
    
    def mark_failed(self, proxy: str):
        """Marque un proxy comme défaillant"""
        self.failed_proxies.add(proxy)

async def scrape_with_rotation(urls: List[str], proxies: List[str]):
    rotator = ProxyRotator(proxies)
    results = []
    
    async with httpx.AsyncClient() as client:
        for url in urls:
            for attempt in range(3):
                proxy = rotator.get_next_proxy()
                try:
                    response = await client.get(
                        url,
                        proxy=f"http://{proxy}",
                        timeout=10
                    )
                    if response.status_code == 200:
                        results.append(response.text)
                        break
                    elif response.status_code in [403, 429]:
                        rotator.mark_failed(proxy)
                except Exception as e:
                    rotator.mark_failed(proxy)
                
                await asyncio.sleep(2 ** attempt)  # Backoff
    
    return results

# Usage
proxies = [
    "user:pass@residential1.proxy.com:8080",
    "user:pass@residential2.proxy.com:8080",
    "user:pass@residential3.proxy.com:8080",
]`,
        description: 'Système de rotation de proxies avec gestion des échecs et backoff exponentiel'
      },
      expertOpinion: 'En 2026, les systèmes anti-bot analysent les patterns d\'IP au-delà de l\'adresse seule : ASN, géolocalisation, historique de réputation. Les proxies résidentiels restent efficaces mais leur coût augmente. La tendance est aux "browser farms" combinant proxies résidentiels et navigateurs réels distribués.',
      relatedTerms: ['behavioral-analysis', 'ethical-scraping'],
      updatedAt: '2026-02-01'
    },
    {
      slug: 'canvas-fingerprinting',
      term: 'Canvas Fingerprinting',
      category: 'anti-bot',
      microDefinition: 'Identification par le rendu unique d\'un élément canvas HTML5.',
      fullDefinition: 'Le Canvas Fingerprinting exploite les variations de rendu graphique entre navigateurs et systèmes pour créer une empreinte unique. En demandant au navigateur de dessiner un texte ou une forme, puis en analysant le résultat pixel par pixel, les sites peuvent identifier les visiteurs même sans cookies. Cette technique est utilisée pour le tracking et la détection de bots.',
      deepDive: `## Comment fonctionne le Canvas Fingerprinting

### Principe technique

1. Un script JavaScript crée un élément \`<canvas>\` caché
2. Il dessine du texte avec des polices spécifiques
3. Il applique des effets (ombres, dégradés, courbes)
4. Le résultat est converti en hash via \`toDataURL()\`

### Pourquoi chaque rendu est unique

Le rendu dépend de nombreux facteurs :
- **GPU** : Différences de traitement graphique
- **Drivers** : Versions et configurations
- **Polices** : Jeu de polices installées
- **Anti-aliasing** : Lissage des contours
- **OS** : Paramètres de rendu système

### Statistiques de diversité

Selon une étude de l'EFF (Electronic Frontier Foundation) :
- Plus de 80% des navigateurs ont une empreinte canvas unique
- Combiné avec d'autres signaux, le fingerprinting atteint 99%+ de précision

### Détection dans les contextes headless

Les environnements Puppeteer/Playwright génèrent des rendus canvas "parfaits" qui sont paradoxalement suspects car trop uniformes.`,
      codeExample: {
        language: 'javascript',
        code: `// Génération d'une empreinte canvas (côté site)
function getCanvasFingerprint() {
  const canvas = document.createElement('canvas');
  canvas.width = 200;
  canvas.height = 50;
  
  const ctx = canvas.getContext('2d');
  
  // Texte avec différentes polices
  ctx.textBaseline = 'top';
  ctx.font = '14px Arial';
  ctx.fillText('Crawlers.fr 🤖', 2, 2);
  
  ctx.font = '18px Georgia';
  ctx.fillStyle = '#3b82f6';
  ctx.fillText('Fingerprint Test', 4, 20);
  
  // Formes géométriques
  ctx.beginPath();
  ctx.arc(50, 40, 10, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(168, 85, 247, 0.5)';
  ctx.fill();
  
  // Extraction du hash
  const dataUrl = canvas.toDataURL();
  return hashCode(dataUrl);
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(16);
}

// Pour les scrapers : injection d'un fingerprint réaliste
// En mode headless, on peut spoofer le canvas :
// page.evaluateOnNewDocument(() => {
//   HTMLCanvasElement.prototype.toDataURL = () => 'data:...';
// });`,
        description: 'Génération d\'empreinte canvas et technique de contournement pour scrapers'
      },
      expertOpinion: 'Le Canvas Fingerprinting évolue vers des techniques plus sophistiquées en 2026 : WebGL fingerprinting, Audio fingerprinting, et même analyse des timings de rendu. Les navigateurs comme Firefox et Brave intègrent des protections anti-fingerprinting. Pour le scraping éthique, le respect de la vie privée des utilisateurs doit primer.',
      relatedTerms: ['behavioral-analysis', 'headless-browsing'],
      updatedAt: '2026-02-01'
    },
    {
      slug: 'user-agent-spoofing',
      term: 'User-Agent Spoofing',
      category: 'anti-bot',
      microDefinition: 'Falsification du header User-Agent pour masquer l\'identité du client.',
      fullDefinition: 'Le User-Agent Spoofing consiste à modifier le header HTTP User-Agent pour faire passer un script ou un bot pour un navigateur légitime. Bien que simple à implémenter, cette technique seule est insuffisante car les systèmes anti-bot modernes vérifient la cohérence entre le User-Agent déclaré et d\'autres signaux (TLS fingerprint, JavaScript APIs).',
      deepDive: `## User-Agent Spoofing : nécessaire mais insuffisant

### Structure d'un User-Agent

\`\`\`
Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 
(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36
\`\`\`

Composants :
- **Mozilla/5.0** : Token de compatibilité historique
- **Platform** : OS et architecture
- **Engine** : Moteur de rendu (WebKit, Gecko)
- **Browser** : Nom et version

### Pourquoi le spoofing seul ne suffit plus

Les anti-bots vérifient la cohérence :

| Signal | UA Chrome | Bot Python |
|--------|-----------|------------|
| TLS Fingerprint | JA3 Chrome | JA3 urllib |
| navigator.webdriver | false | true |
| navigator.plugins | [plugins...] | [] |
| canvas fingerprint | Unique | Identique |

### Bonnes pratiques

1. Utiliser des UA récents (vérifier chromestatus.com)
2. Matcher l'OS du UA avec d'autres signaux
3. Maintenir une base de UA à jour
4. Varier les UA de manière réaliste`,
      codeExample: {
        language: 'python',
        code: `# Rotation User-Agent intelligente avec cohérence
import random
from dataclasses import dataclass
from typing import List

@dataclass
class BrowserProfile:
    user_agent: str
    accept_language: str
    platform: str
    sec_ch_ua: str
    sec_ch_ua_platform: str

# Profils cohérents (UA + headers Client Hints)
BROWSER_PROFILES: List[BrowserProfile] = [
    BrowserProfile(
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        accept_language="fr-FR,fr;q=0.9,en;q=0.8",
        platform="Win32",
        sec_ch_ua='"Google Chrome";v="120", "Chromium";v="120"',
        sec_ch_ua_platform='"Windows"'
    ),
    BrowserProfile(
        user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        accept_language="fr-FR,fr;q=0.9",
        platform="MacIntel",
        sec_ch_ua='"Google Chrome";v="120", "Chromium";v="120"',
        sec_ch_ua_platform='"macOS"'
    ),
    BrowserProfile(
        user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        accept_language="en-US,en;q=0.9",
        platform="Linux x86_64",
        sec_ch_ua='"Google Chrome";v="120", "Chromium";v="120"',
        sec_ch_ua_platform='"Linux"'
    ),
]

def get_coherent_headers() -> dict:
    """Retourne des headers cohérents pour un profil aléatoire"""
    profile = random.choice(BROWSER_PROFILES)
    return {
        "User-Agent": profile.user_agent,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": profile.accept_language,
        "Accept-Encoding": "gzip, deflate, br",
        "Sec-Ch-Ua": profile.sec_ch_ua,
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": profile.sec_ch_ua_platform,
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
    }`,
        description: 'Gestion de profils navigateur cohérents incluant Client Hints pour éviter la détection'
      },
      expertOpinion: 'Le User-Agent Spoofing est devenu une technique de base en 2026, mais son efficacité dépend entièrement de la cohérence globale du profil de requête. Les Client Hints (Sec-CH-UA-*) ajoutent une couche de complexité car ils doivent être cohérents avec le UA. La tendance est à l\'utilisation de bibliothèques complètes comme undetected-chromedriver plutôt qu\'au spoofing manuel.',
      relatedTerms: ['tls-fingerprinting', 'ja3-ja3s', 'headless-browsing'],
      updatedAt: '2026-02-01'
    },

    // === ARCHITECTURE TECHNIQUE ===
    {
      slug: 'headless-browsing',
      term: 'Headless Browsing',
      category: 'architecture',
      microDefinition: 'Exécution de navigateurs sans interface graphique pour automatisation.',
      fullDefinition: 'Le Headless Browsing permet d\'exécuter un navigateur web (Chrome, Firefox) sans affichage graphique, contrôlé par code. Les outils comme Puppeteer (Node.js), Playwright (multi-langage) et Selenium permettent d\'automatiser la navigation, exécuter JavaScript et capturer le contenu rendu. Essentiel pour scraper les SPA modernes.',
      deepDive: `## Headless Browsers : les outils du scraping moderne

### Comparatif des solutions 2026

| Outil | Langage | Navigateurs | Détection | Performance |
|-------|---------|-------------|-----------|-------------|
| Puppeteer | Node.js | Chrome/Firefox | Moyenne | Rapide |
| Playwright | Multi | Tous majeurs | Faible | Très rapide |
| Selenium | Multi | Tous | Haute | Lente |
| undetected-chromedriver | Python | Chrome | Très faible | Moyenne |

### Playwright vs Puppeteer en 2026

**Playwright** est devenu le standard car :
- Support natif de Chrome, Firefox, Safari
- API async moderne et cohérente
- Auto-wait intelligent (moins de flakiness)
- Contextes isolés pour le parallélisme

### Défis de la détection

Les sites détectent les headless via :
- \`navigator.webdriver\` (true en mode automation)
- Absence de plugins/extensions
- Dimensions de viewport suspectes
- Comportement trop rapide/régulier

### Solutions anti-détection

1. **playwright-stealth** : Patches pour cacher les signaux
2. **undetected-chromedriver** : Chrome patché
3. **Browserless.io** : Infrastructure cloud optimisée`,
      codeExample: {
        language: 'typescript',
        code: `// Scraping avec Playwright et anti-détection
import { chromium, Page } from 'playwright';

async function stealthScrape(url: string): Promise<string> {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-sandbox',
    ]
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
  });

  // Injection anti-détection
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['fr-FR', 'fr'] });
    
    // Spoof chrome runtime
    (window as any).chrome = { runtime: {} };
  });

  const page = await context.newPage();
  
  // Navigation avec attente intelligente
  await page.goto(url, { waitUntil: 'networkidle' });
  
  // Attendre le contenu dynamique
  await page.waitForSelector('main', { timeout: 10000 });
  
  const content = await page.content();
  await browser.close();
  
  return content;
}

// Usage
const html = await stealthScrape('https://example.com');`,
        description: 'Configuration Playwright avec techniques anti-détection et contexts isolés'
      },
      expertOpinion: 'En 2026, Playwright domine le marché du headless browsing grâce à son API unifiée et ses performances. La tendance est au "browser-as-a-service" avec des plateformes comme Browserless ou Apify qui gèrent l\'infrastructure et les contournements anti-bot. Pour les projets critiques, combiner headless + residential proxies + behavioral simulation reste la recette gagnante.',
      relatedTerms: ['dom-parsing', 'behavioral-analysis', 'ssr-vs-csr'],
      updatedAt: '2026-02-01'
    },
    {
      slug: 'dom-parsing',
      term: 'DOM Parsing',
      category: 'architecture',
      microDefinition: 'Analyse et extraction de données depuis la structure HTML d\'une page.',
      fullDefinition: 'Le DOM Parsing consiste à analyser le Document Object Model d\'une page web pour en extraire des données structurées. Les parsers HTML comme BeautifulSoup (Python), Cheerio (Node.js) ou lxml transforment le HTML brut en arbre navigable. Cette technique est fondamentale pour le web scraping et l\'indexation.',
      deepDive: `## DOM Parsing : l'extraction de données à grande échelle

### Parsers populaires par écosystème

**Python**
- \`BeautifulSoup\` : Simple, flexible, lent
- \`lxml\` : Rapide, support XPath
- \`selectolax\` : Ultra-rapide, API moderne
- \`parsel\` : Utilisé par Scrapy

**Node.js**
- \`cheerio\` : API jQuery-like, rapide
- \`jsdom\` : DOM complet, plus lent
- \`linkedom\` : Alternative légère à jsdom

### Sélecteurs : CSS vs XPath

**CSS Selectors** - Plus lisibles
\`\`\`
div.product > h2.title
article[data-id="123"]
li:nth-child(odd)
\`\`\`

**XPath** - Plus puissants
\`\`\`
//div[contains(@class, "product")]//h2
//a[starts-with(@href, "/category")]
//text()[normalize-space()]
\`\`\`

### Performance à grande échelle

Pour parser des millions de pages :
1. Utiliser un parser C-based (lxml, selectolax)
2. Parser en streaming si possible
3. Paralléliser avec multiprocessing
4. Éviter les regex sur du HTML`,
      codeExample: {
        language: 'python',
        code: `# Extraction de données structurées avec selectolax (ultra-rapide)
from selectolax.parser import HTMLParser
from dataclasses import dataclass
from typing import List, Optional
import httpx

@dataclass
class Product:
    name: str
    price: float
    rating: Optional[float]
    url: str

def parse_products(html: str) -> List[Product]:
    """Parse une page produit et extrait les données structurées"""
    tree = HTMLParser(html)
    products = []
    
    for item in tree.css('article.product-card'):
        # Extraction avec gestion des valeurs manquantes
        name_node = item.css_first('h2.product-title')
        price_node = item.css_first('[data-price]')
        rating_node = item.css_first('.rating-value')
        link_node = item.css_first('a.product-link')
        
        if name_node and price_node and link_node:
            product = Product(
                name=name_node.text(strip=True),
                price=float(price_node.attributes.get('data-price', 0)),
                rating=float(rating_node.text()) if rating_node else None,
                url=link_node.attributes.get('href', '')
            )
            products.append(product)
    
    return products

def extract_with_xpath(html: str) -> List[dict]:
    """Alternative avec lxml et XPath pour des requêtes complexes"""
    from lxml import html as lxml_html
    
    tree = lxml_html.fromstring(html)
    
    # XPath pour trouver des patterns complexes
    items = tree.xpath('''
        //article[contains(@class, "product")]
        [.//span[@class="in-stock"]]
        [number(.//span[@data-price]) < 100]
    ''')
    
    return [
        {
            'name': item.xpath('.//h2/text()')[0],
            'price': item.xpath('.//@data-price')[0]
        }
        for item in items
    ]

# Benchmark : selectolax est ~20x plus rapide que BeautifulSoup
# sur des documents HTML volumineux`,
        description: 'Parsing HTML performant avec selectolax et lxml, incluant gestion des données manquantes'
      },
      expertOpinion: 'Le DOM Parsing évolue vers des approches hybrides en 2026 : parsers traditionnels pour l\'extraction brute, puis LLMs pour la normalisation et la compréhension sémantique. Les sites complexes avec Shadow DOM et composants React nécessitent souvent un rendering JavaScript avant parsing.',
      relatedTerms: ['shadow-dom', 'headless-browsing', 'schema-org-extraction'],
      updatedAt: '2026-02-01'
    },
    {
      slug: 'shadow-dom',
      term: 'Shadow DOM',
      category: 'architecture',
      microDefinition: 'Encapsulation DOM isolant le style et la structure des composants web.',
      fullDefinition: 'Le Shadow DOM est une API permettant d\'encapsuler le markup, le style et le comportement d\'un composant web. Ce DOM "caché" n\'est pas accessible via les sélecteurs CSS ou JavaScript standard, posant un défi pour le web scraping. Les Web Components modernes l\'utilisent intensivement.',
      deepDive: `## Shadow DOM : le défi caché du web scraping

### Qu'est-ce que le Shadow DOM ?

Le Shadow DOM crée une arborescence DOM séparée attachée à un élément :

\`\`\`html
<custom-product>
  #shadow-root (open/closed)
    <div class="internal">
      <h2>Titre produit</h2>
      <span class="price">99€</span>
    </div>
</custom-product>
\`\`\`

### Types de Shadow DOM

- **Open** : Accessible via \`element.shadowRoot\`
- **Closed** : Inaccessible (théoriquement), utilisé pour la sécurité

### Impact sur le scraping

**Ce qui ne fonctionne PAS :**
\`\`\`javascript
document.querySelector('custom-product .price'); // null
document.querySelectorAll('h2'); // Ne trouve pas le titre
\`\`\`

**Solution pour Shadow DOM open :**
\`\`\`javascript
const host = document.querySelector('custom-product');
const shadow = host.shadowRoot;
const price = shadow.querySelector('.price'); // Fonctionne !
\`\`\`

### Frameworks utilisant Shadow DOM

- LitElement / Lit
- Stencil.js
- Polymer
- Salesforce Lightning Web Components`,
      codeExample: {
        language: 'javascript',
        code: `// Extraction récursive de tout le contenu Shadow DOM
async function extractAllShadowContent(page) {
  return await page.evaluate(() => {
    function extractShadowRoots(element) {
      const results = [];
      
      // Extraire le contenu de cet élément
      if (element.shadowRoot) {
        results.push({
          host: element.tagName.toLowerCase(),
          content: element.shadowRoot.innerHTML,
          text: element.shadowRoot.textContent.trim()
        });
        
        // Récursion dans le shadow root
        element.shadowRoot.querySelectorAll('*').forEach(child => {
          results.push(...extractShadowRoots(child));
        });
      }
      
      // Récursion dans les enfants normaux
      element.querySelectorAll('*').forEach(child => {
        results.push(...extractShadowRoots(child));
      });
      
      return results;
    }
    
    return extractShadowRoots(document.body);
  });
}

// Avec Playwright - Piercing du Shadow DOM
async function scrapeShadowDOM(page, selector) {
  // Playwright peut percer le Shadow DOM avec >> et >>>
  // >> : traverse un shadow root
  // css= : sélecteur CSS
  
  const element = await page.locator(
    'custom-product >> .price'
  ).textContent();
  
  // Ou utiliser pierceAll pour tous les shadow roots
  const allPrices = await page.locator(
    ':scope >>> .price'
  ).allTextContents();
  
  return allPrices;
}

// Détection automatique de Shadow DOM
async function hasShadowDOM(page) {
  return await page.evaluate(() => {
    return !!document.querySelector('*').shadowRoot ||
           document.querySelectorAll('[shadowroot]').length > 0;
  });
}`,
        description: 'Techniques d\'extraction de contenu depuis Shadow DOM ouvert et fermé avec Playwright'
      },
      expertOpinion: 'Le Shadow DOM se généralise avec l\'adoption des Web Components, notamment dans les CMS headless et les design systems. En 2026, Playwright est devenu l\'outil de référence grâce à ses sélecteurs "piercing" natifs. Pour les Shadow DOM fermés, l\'injection de scripts au niveau du runtime reste la seule option.',
      relatedTerms: ['dom-parsing', 'headless-browsing', 'ssr-vs-csr'],
      updatedAt: '2026-02-01'
    },
    {
      slug: 'ssr-vs-csr',
      term: 'SSR vs CSR',
      category: 'architecture',
      microDefinition: 'Rendu serveur (HTML complet) vs rendu client (JavaScript).',
      fullDefinition: 'SSR (Server-Side Rendering) génère le HTML complet sur le serveur, facilitant l\'indexation SEO et le scraping. CSR (Client-Side Rendering) génère le contenu via JavaScript dans le navigateur, nécessitant un headless browser pour le scraping. Les frameworks modernes (Next.js, Nuxt) combinent les deux approches.',
      deepDive: `## SSR vs CSR : impact sur le crawling et le SEO

### Comparatif technique

| Aspect | SSR | CSR |
|--------|-----|-----|
| HTML initial | Complet | Minimal (shell) |
| Temps au contenu | Rapide | Après JS load |
| SEO / Crawling | Excellent | Problématique |
| Interactivité | Après hydration | Immédiate |
| Charge serveur | Plus élevée | Minimale |

### Évolution des architectures

**Génération 1 : PHP/Rails (Pure SSR)**
- HTML rendu à chaque requête
- Simple à scraper

**Génération 2 : React SPA (Pure CSR)**
- JavaScript génère tout le DOM
- Nécessite headless browser

**Génération 3 : Next.js/Nuxt (Hybride)**
- SSR pour le premier rendu
- Hydration côté client
- ISR (Incremental Static Regeneration)

### Détection du mode de rendu

Pour savoir si un site utilise CSR :
1. Désactiver JavaScript dans le navigateur
2. Si la page est vide → CSR pur
3. Si le contenu apparaît → SSR ou SSG`,
      codeExample: {
        language: 'python',
        code: `# Détection automatique SSR vs CSR et stratégie de scraping adaptée
import httpx
from playwright.async_api import async_playwright
from selectolax.parser import HTMLParser

async def detect_rendering_mode(url: str) -> dict:
    """Détecte si un site utilise SSR ou CSR"""
    
    # 1. Fetch HTML brut (sans JavaScript)
    async with httpx.AsyncClient() as client:
        response = await client.get(url)
        raw_html = response.text
    
    raw_tree = HTMLParser(raw_html)
    raw_text_content = raw_tree.body.text(strip=True) if raw_tree.body else ""
    
    # 2. Fetch avec JavaScript (Playwright)
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.goto(url, wait_until='networkidle')
        rendered_html = await page.content()
        await browser.close()
    
    rendered_tree = HTMLParser(rendered_html)
    rendered_text_content = rendered_tree.body.text(strip=True) if rendered_tree.body else ""
    
    # 3. Comparer les contenus
    raw_length = len(raw_text_content)
    rendered_length = len(rendered_text_content)
    
    content_ratio = raw_length / rendered_length if rendered_length > 0 else 0
    
    # Heuristique : si le HTML brut contient moins de 30% du contenu rendu
    is_csr = content_ratio < 0.3
    
    return {
        'url': url,
        'mode': 'CSR' if is_csr else 'SSR',
        'raw_content_length': raw_length,
        'rendered_content_length': rendered_length,
        'content_ratio': round(content_ratio, 2),
        'recommendation': 'Use headless browser' if is_csr else 'Simple HTTP fetch is sufficient'
    }

async def adaptive_scrape(url: str):
    """Scrape adaptatif selon le mode de rendu détecté"""
    mode_info = await detect_rendering_mode(url)
    
    if mode_info['mode'] == 'SSR':
        # Scraping simple et rapide
        async with httpx.AsyncClient() as client:
            response = await client.get(url)
            return HTMLParser(response.text)
    else:
        # Scraping avec JavaScript rendering
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page()
            await page.goto(url, wait_until='networkidle')
            html = await page.content()
            await browser.close()
            return HTMLParser(html)`,
        description: 'Détection automatique du mode de rendu et sélection de la stratégie de scraping optimale'
      },
      expertOpinion: 'La tendance 2026 est au "Partial Hydration" et aux "Server Components" (React) qui complexifient encore la donne. Les scrapers professionnels maintiennent des profils par domaine indiquant le mode de rendu optimal. L\'idéal reste de détecter automatiquement et d\'utiliser la méthode la plus légère possible.',
      relatedTerms: ['headless-browsing', 'dom-parsing'],
      updatedAt: '2026-02-01'
    },
    {
      slug: 'http2-http3',
      term: 'HTTP/2 & HTTP/3',
      category: 'architecture',
      microDefinition: 'Protocoles modernes améliorant la vitesse et le multiplexage des requêtes.',
      fullDefinition: 'HTTP/2 introduit le multiplexage (plusieurs requêtes sur une connexion), la compression des headers et le server push. HTTP/3 utilise QUIC au lieu de TCP, réduisant la latence et améliorant la résilience réseau. Ces protocoles impactent les performances de crawling et la détection des bots.',
      deepDive: `## HTTP/2 et HTTP/3 : révolution pour le crawling

### Évolution des protocoles

**HTTP/1.1 (1997)**
- Une requête par connexion
- Limite de 6 connexions parallèles par domaine
- Headers en clair, répétés à chaque requête

**HTTP/2 (2015)**
- Multiplexage : plusieurs requêtes sur une connexion
- Compression HPACK des headers
- Server Push (peu utilisé en pratique)

**HTTP/3 (2022)**
- QUIC remplace TCP (basé sur UDP)
- 0-RTT : connexion quasi-instantanée
- Meilleure gestion de la perte de paquets

### Impact sur le web scraping

**Avantages**
- Moins de connexions TCP à établir
- Headers compressés = moins de bande passante
- Latence réduite pour les crawls internationaux

**Défis**
- Les bibliothèques doivent supporter ces protocoles
- HTTP/3 encore mal supporté (httpx, curl récent)
- Le TLS fingerprinting change avec QUIC`,
      codeExample: {
        language: 'python',
        code: `# Scraping HTTP/2 performant avec httpx
import httpx
import asyncio
from typing import List

async def parallel_scrape_h2(urls: List[str]) -> List[dict]:
    """
    Scraping parallèle exploitant le multiplexage HTTP/2
    Une seule connexion par domaine, multiples requêtes
    """
    results = []
    
    # Configuration HTTP/2 optimisée
    limits = httpx.Limits(
        max_connections=100,
        max_keepalive_connections=20,
        keepalive_expiry=30
    )
    
    async with httpx.AsyncClient(
        http2=True,  # Activer HTTP/2
        limits=limits,
        timeout=httpx.Timeout(30.0),
        follow_redirects=True
    ) as client:
        # Semaphore pour limiter la concurrence
        semaphore = asyncio.Semaphore(50)
        
        async def fetch_one(url: str):
            async with semaphore:
                try:
                    response = await client.get(url)
                    return {
                        'url': url,
                        'status': response.status_code,
                        'http_version': response.http_version,
                        'size': len(response.content),
                        'headers': dict(response.headers)
                    }
                except Exception as e:
                    return {'url': url, 'error': str(e)}
        
        # Lancer toutes les requêtes en parallèle
        tasks = [fetch_one(url) for url in urls]
        results = await asyncio.gather(*tasks)
    
    return results

# Vérifier le support HTTP/2 d'un serveur
async def check_h2_support(url: str) -> dict:
    async with httpx.AsyncClient(http2=True) as client:
        response = await client.get(url)
        return {
            'url': url,
            'http_version': response.http_version,
            'supports_h2': response.http_version == 'HTTP/2',
            'alt_svc': response.headers.get('alt-svc', 'None')  # HTTP/3 advertised here
        }

# HTTP/3 avec curl (si disponible)
import subprocess

def check_h3_support(url: str) -> bool:
    """Vérifie le support HTTP/3 avec curl"""
    try:
        result = subprocess.run(
            ['curl', '--http3', '-I', '-s', url],
            capture_output=True,
            text=True,
            timeout=10
        )
        return 'HTTP/3' in result.stdout
    except:
        return False`,
        description: 'Scraping HTTP/2 multiplexé avec httpx et détection du support HTTP/3'
      },
      expertOpinion: 'HTTP/3 devient mainstream en 2026 avec son adoption par les CDN majeurs (Cloudflare, Fastly). Pour le scraping, HTTP/2 offre déjà d\'excellentes performances. Le vrai enjeu est la compatibilité des bibliothèques : curl_cffi supporte HTTP/3, httpx reste en HTTP/2. Le QUIC fingerprinting pourrait devenir un nouveau vecteur de détection.',
      relatedTerms: ['tls-fingerprinting', 'concurrency-control'],
      updatedAt: '2026-02-01'
    },

    // === DATA & AI (GEO) ===
    {
      slug: 'data-normalization',
      term: 'Data Normalization',
      category: 'data-ai',
      microDefinition: 'Standardisation des données extraites pour uniformité et qualité.',
      fullDefinition: 'La Data Normalization transforme les données brutes extraites en format structuré et cohérent. Elle inclut le nettoyage (suppression de HTML, espaces), la standardisation (formats de date, devises, unités) et la validation. Étape cruciale entre le scraping et l\'exploitation des données par les LLMs.',
      deepDive: `## Normalisation des données : de la soupe HTML à l'or structuré

### Pipeline de normalisation typique

\`\`\`
HTML brut → Extraction → Nettoyage → Standardisation → Validation → Stockage
\`\`\`

### Types de normalisation

**Textuelle**
- Suppression des balises HTML résiduelles
- Normalisation Unicode (NFC/NFD)
- Trimming et collapse des espaces
- Correction de l'encodage

**Numérique**
- Parsing des prix : "1 299,99 €" → 1299.99
- Conversion d'unités : "15kg" → 15.0, "kg"
- Gestion des séparateurs locaux

**Temporelle**
- Parsing multiformat : "15 jan 2026", "2026-01-15"
- Conversion en UTC
- Calcul de dates relatives : "il y a 2 jours"

**Catégorielle**
- Mapping vers des taxonomies standards
- Détection et correction des fautes de frappe
- Synonymes et variantes`,
      codeExample: {
        language: 'python',
        code: `# Pipeline de normalisation de données complet
import re
import unicodedata
from datetime import datetime
from typing import Any, Optional
from dataclasses import dataclass
import dateparser

@dataclass
class NormalizedProduct:
    name: str
    price: float
    currency: str
    availability: bool
    scraped_at: datetime

class DataNormalizer:
    """Normalisateur de données e-commerce"""
    
    # Patterns de prix par locale
    PRICE_PATTERNS = [
        (r'([\d\s]+[,.]?\d*)\s*€', 'EUR'),
        (r'\$([\d,]+\.?\d*)', 'USD'),
        (r'£([\d,]+\.?\d*)', 'GBP'),
    ]
    
    def normalize_text(self, text: str) -> str:
        """Nettoie et normalise du texte brut"""
        if not text:
            return ""
        
        # Supprimer les balises HTML résiduelles
        text = re.sub(r'<[^>]+>', '', text)
        
        # Normalisation Unicode (NFC)
        text = unicodedata.normalize('NFC', text)
        
        # Collapse des espaces multiples
        text = re.sub(r'\s+', ' ', text)
        
        # Trim
        return text.strip()
    
    def normalize_price(self, price_str: str) -> tuple[float, str]:
        """Extrait et normalise un prix avec sa devise"""
        if not price_str:
            return 0.0, 'EUR'
        
        for pattern, currency in self.PRICE_PATTERNS:
            match = re.search(pattern, price_str)
            if match:
                # Nettoyer le nombre
                num_str = match.group(1)
                num_str = num_str.replace(' ', '').replace(',', '.')
                # Gérer le cas "1.299.99" → "1299.99"
                parts = num_str.split('.')
                if len(parts) > 2:
                    num_str = ''.join(parts[:-1]) + '.' + parts[-1]
                return float(num_str), currency
        
        return 0.0, 'EUR'
    
    def normalize_date(self, date_str: str, locale: str = 'fr') -> Optional[datetime]:
        """Parse une date dans divers formats"""
        if not date_str:
            return None
        
        # Utiliser dateparser pour le parsing intelligent
        settings = {
            'PREFER_DAY_OF_MONTH': 'first',
            'PREFER_DATES_FROM': 'past',
            'TIMEZONE': 'Europe/Paris',
            'RETURN_AS_TIMEZONE_AWARE': True
        }
        
        return dateparser.parse(date_str, settings=settings)
    
    def normalize_availability(self, text: str) -> bool:
        """Détecte la disponibilité depuis du texte"""
        text_lower = text.lower()
        
        available_keywords = ['en stock', 'disponible', 'in stock', 'available']
        unavailable_keywords = ['rupture', 'épuisé', 'out of stock', 'indisponible']
        
        if any(kw in text_lower for kw in available_keywords):
            return True
        if any(kw in text_lower for kw in unavailable_keywords):
            return False
        
        return True  # Default
    
    def normalize_product(self, raw_data: dict) -> NormalizedProduct:
        """Normalise un produit complet"""
        price, currency = self.normalize_price(raw_data.get('price', ''))
        
        return NormalizedProduct(
            name=self.normalize_text(raw_data.get('name', '')),
            price=price,
            currency=currency,
            availability=self.normalize_availability(raw_data.get('availability', '')),
            scraped_at=datetime.utcnow()
        )`,
        description: 'Pipeline complet de normalisation : texte, prix, dates et disponibilité avec gestion multi-locale'
      },
      expertOpinion: 'La normalisation des données prend une importance critique avec l\'essor du RAG (Retrieval-Augmented Generation). Des données mal normalisées produisent des hallucinations IA. En 2026, les pipelines intègrent des LLMs pour la normalisation sémantique : extraction d\'entités, résolution de coréférences, et enrichissement contextuel.',
      relatedTerms: ['schema-org-extraction', 'rag', 'llm-based-parsing'],
      updatedAt: '2026-02-01'
    },
    {
      slug: 'schema-org-extraction',
      term: 'Schema.org Extraction',
      category: 'data-ai',
      microDefinition: 'Extraction des données structurées JSON-LD depuis les pages web.',
      fullDefinition: 'L\'extraction Schema.org consiste à parser les balises JSON-LD, Microdata ou RDFa intégrées aux pages web. Ces données structurées (produits, articles, événements, FAQ) sont pré-normalisées par les éditeurs de sites, offrant une source de données de haute qualité pour le scraping et l\'alimentation des LLMs.',
      deepDive: `## Schema.org : la mine d'or des données structurées

### Formats de données structurées

**JSON-LD (recommandé)**
\`\`\`html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "iPhone 15 Pro",
  "offers": {
    "@type": "Offer",
    "price": "1199",
    "priceCurrency": "EUR"
  }
}
</script>
\`\`\`

**Microdata**
\`\`\`html
<div itemscope itemtype="https://schema.org/Product">
  <span itemprop="name">iPhone 15 Pro</span>
</div>
\`\`\`

### Types Schema.org les plus utiles

| Type | Usage | Données clés |
|------|-------|--------------|
| Product | E-commerce | name, price, availability, reviews |
| Article | Blog/News | headline, author, datePublished |
| LocalBusiness | Local | address, phone, openingHours |
| FAQPage | Support | Question/Answer pairs |
| Event | Agenda | startDate, location, performer |

### Avantages pour le scraping

1. **Données pré-normalisées** : Formats standards
2. **Haute qualité** : Vérifiées par Google (Rich Results)
3. **Extraction simple** : Un seul sélecteur CSS
4. **Sémantique riche** : Relations entre entités`,
      codeExample: {
        language: 'python',
        code: `# Extraction complète de Schema.org (JSON-LD, Microdata, RDFa)
import json
import re
from typing import List, Dict, Any
from selectolax.parser import HTMLParser

class SchemaExtractor:
    """Extracteur universel de données Schema.org"""
    
    def extract_jsonld(self, html: str) -> List[Dict[str, Any]]:
        """Extrait tous les blocs JSON-LD"""
        tree = HTMLParser(html)
        schemas = []
        
        for script in tree.css('script[type="application/ld+json"]'):
            try:
                text = script.text(strip=True)
                # Nettoyer les commentaires JS parfois présents
                text = re.sub(r'/\*.*?\*/', '', text, flags=re.DOTALL)
                data = json.loads(text)
                
                # Gérer les @graph (collections)
                if isinstance(data, dict) and '@graph' in data:
                    schemas.extend(data['@graph'])
                elif isinstance(data, list):
                    schemas.extend(data)
                else:
                    schemas.append(data)
            except json.JSONDecodeError:
                continue
        
        return schemas
    
    def find_by_type(self, schemas: List[Dict], schema_type: str) -> List[Dict]:
        """Filtre les schemas par @type"""
        results = []
        
        for schema in schemas:
            item_type = schema.get('@type', '')
            # @type peut être une string ou une liste
            if isinstance(item_type, list):
                if schema_type in item_type:
                    results.append(schema)
            elif item_type == schema_type:
                results.append(schema)
        
        return results
    
    def extract_products(self, html: str) -> List[Dict]:
        """Extrait et normalise les produits"""
        schemas = self.extract_jsonld(html)
        products = self.find_by_type(schemas, 'Product')
        
        normalized = []
        for product in products:
            # Extraire les offers (peut être imbriqué)
            offers = product.get('offers', {})
            if isinstance(offers, list):
                offers = offers[0] if offers else {}
            
            normalized.append({
                'name': product.get('name'),
                'description': product.get('description'),
                'sku': product.get('sku'),
                'brand': self._extract_brand(product),
                'price': offers.get('price'),
                'currency': offers.get('priceCurrency'),
                'availability': self._parse_availability(offers.get('availability', '')),
                'image': self._extract_image(product),
                'rating': self._extract_rating(product),
            })
        
        return normalized
    
    def _extract_brand(self, product: Dict) -> str:
        brand = product.get('brand', {})
        if isinstance(brand, dict):
            return brand.get('name', '')
        return brand or ''
    
    def _extract_image(self, product: Dict) -> str:
        image = product.get('image', '')
        if isinstance(image, list):
            return image[0] if image else ''
        if isinstance(image, dict):
            return image.get('url', '')
        return image
    
    def _extract_rating(self, product: Dict) -> Dict:
        rating = product.get('aggregateRating', {})
        return {
            'value': rating.get('ratingValue'),
            'count': rating.get('reviewCount'),
            'best': rating.get('bestRating', 5)
        }
    
    def _parse_availability(self, availability: str) -> bool:
        return 'InStock' in availability or 'PreOrder' in availability

# Usage
extractor = SchemaExtractor()
html = open('product_page.html').read()
products = extractor.extract_products(html)
print(json.dumps(products, indent=2))`,
        description: 'Extracteur Schema.org complet avec parsing JSON-LD, gestion des @graph et normalisation des produits'
      },
      expertOpinion: 'L\'extraction Schema.org est devenue incontournable en 2026. Google exige des données structurées pour les Rich Results, garantissant leur présence sur les sites e-commerce. Pour le GEO, ces données alimentent directement les LLMs via RAG. Astuce : combiner Schema.org avec le scraping DOM pour validation croisée.',
      relatedTerms: ['data-normalization', 'rag', 'llm-based-parsing'],
      updatedAt: '2026-02-01'
    },
    {
      slug: 'rag',
      term: 'RAG (Retrieval-Augmented Generation)',
      category: 'data-ai',
      microDefinition: 'Technique IA combinant recherche documentaire et génération de texte.',
      fullDefinition: 'Le RAG (Retrieval-Augmented Generation) améliore les réponses des LLMs en leur fournissant des documents pertinents extraits d\'une base de connaissances. Le processus : la requête utilisateur est vectorisée, les documents similaires sont récupérés, puis injectés dans le prompt du LLM. Le web scraping est essentiel pour alimenter ces bases de connaissances.',
      deepDive: `## RAG : Comment le scraping nourrit l'IA générative

### Architecture RAG

\`\`\`
1. Ingestion : Scraping → Chunking → Embedding → Vector DB
2. Retrieval : Query → Embedding → Similarity Search → Top-K docs
3. Generation : Query + Context docs → LLM → Response
\`\`\`

### Le rôle crucial du scraping

Le RAG résout le problème des "hallucinations" en ancrant le LLM dans des faits vérifiables. La qualité du RAG dépend directement de :

1. **Fraîcheur des données** : Crawling régulier
2. **Couverture** : Scraping exhaustif du domaine
3. **Qualité** : Normalisation et nettoyage
4. **Structure** : Chunking intelligent

### Chunking strategies

| Stratégie | Cas d'usage | Taille typique |
|-----------|-------------|----------------|
| Fixed size | Documents homogènes | 500-1000 tokens |
| Semantic | Articles, blogs | Paragraphes naturels |
| Recursive | Documents structurés | Sections/sous-sections |
| Sentence | Q&A, FAQ | 2-5 phrases |

### Vector Databases populaires

- **Pinecone** : Cloud, scalable
- **Weaviate** : Open-source, hybrid search
- **Chroma** : Léger, embarquable
- **Qdrant** : Performance, filtres`,
      codeExample: {
        language: 'python',
        code: `# Pipeline RAG complet : du scraping à la génération
from dataclasses import dataclass
from typing import List
import numpy as np

# Simuler les imports (dans la vraie vie: openai, chromadb, etc.)
# from openai import OpenAI
# import chromadb

@dataclass
class Document:
    content: str
    metadata: dict
    embedding: List[float] = None

class ScrapingRAGPipeline:
    """Pipeline RAG alimenté par web scraping"""
    
    def __init__(self, embedding_model="text-embedding-3-small"):
        self.embedding_model = embedding_model
        self.documents = []
        # self.client = OpenAI()
        # self.vectordb = chromadb.Client()
    
    def ingest_scraped_content(self, scraped_data: List[dict]):
        """Ingère le contenu scrapé dans la base vectorielle"""
        for item in scraped_data:
            # Chunking sémantique
            chunks = self._semantic_chunk(item['content'])
            
            for i, chunk in enumerate(chunks):
                doc = Document(
                    content=chunk,
                    metadata={
                        'source_url': item['url'],
                        'title': item.get('title', ''),
                        'scraped_at': item.get('scraped_at'),
                        'chunk_index': i
                    }
                )
                
                # Générer l'embedding
                doc.embedding = self._embed(chunk)
                self.documents.append(doc)
        
        # Stocker dans la vector DB
        self._store_in_vectordb()
    
    def _semantic_chunk(self, text: str, max_tokens: int = 500) -> List[str]:
        """Découpe le texte en chunks sémantiques"""
        # Simplification : découper par paragraphes
        paragraphs = text.split('\n\n')
        
        chunks = []
        current_chunk = []
        current_length = 0
        
        for para in paragraphs:
            para_length = len(para.split())  # Approximation tokens
            
            if current_length + para_length > max_tokens:
                if current_chunk:
                    chunks.append('\n\n'.join(current_chunk))
                current_chunk = [para]
                current_length = para_length
            else:
                current_chunk.append(para)
                current_length += para_length
        
        if current_chunk:
            chunks.append('\n\n'.join(current_chunk))
        
        return chunks
    
    def _embed(self, text: str) -> List[float]:
        """Génère l'embedding d'un texte"""
        # En production: 
        # response = self.client.embeddings.create(
        #     model=self.embedding_model,
        #     input=text
        # )
        # return response.data[0].embedding
        
        # Placeholder : embedding aléatoire 1536 dims
        return list(np.random.rand(1536))
    
    def retrieve(self, query: str, top_k: int = 5) -> List[Document]:
        """Récupère les documents pertinents"""
        query_embedding = self._embed(query)
        
        # Calcul de similarité cosinus
        similarities = []
        for doc in self.documents:
            sim = np.dot(query_embedding, doc.embedding) / (
                np.linalg.norm(query_embedding) * np.linalg.norm(doc.embedding)
            )
            similarities.append((sim, doc))
        
        # Tri et top-k
        similarities.sort(key=lambda x: x[0], reverse=True)
        return [doc for _, doc in similarities[:top_k]]
    
    def generate(self, query: str) -> str:
        """Génère une réponse RAG"""
        # Récupérer le contexte
        relevant_docs = self.retrieve(query)
        
        # Construire le prompt
        context = "\n\n---\n\n".join([
            f"Source: {doc.metadata['source_url']}\n{doc.content}"
            for doc in relevant_docs
        ])
        
        prompt = f"""Réponds à la question en te basant uniquement sur le contexte fourni.
Si l'information n'est pas dans le contexte, dis-le.

Contexte:
{context}

Question: {query}

Réponse:"""
        
        # En production:
        # response = self.client.chat.completions.create(
        #     model="gpt-4-turbo",
        #     messages=[{"role": "user", "content": prompt}]
        # )
        # return response.choices[0].message.content
        
        return f"[RAG Response based on {len(relevant_docs)} sources]"`,
        description: 'Pipeline RAG complet : ingestion de contenu scrapé, chunking sémantique, embedding et génération'
      },
      expertOpinion: 'Le RAG révolutionne l\'utilisation des données scrapées en 2026. Les entreprises construisent des "knowledge bases" propriétaires alimentées par crawling continu. La clé du succès : un chunking intelligent qui préserve le contexte, et des embeddings de qualité. Le scraping éthique prend tout son sens ici : des données de qualité = de meilleures réponses IA.',
      relatedTerms: ['llm-based-parsing', 'data-normalization', 'schema-org-extraction'],
      updatedAt: '2026-02-01'
    },
    {
      slug: 'llm-based-parsing',
      term: 'LLM-Based Parsing',
      category: 'data-ai',
      microDefinition: 'Utilisation de l\'IA pour comprendre et extraire des données du HTML.',
      fullDefinition: 'Le LLM-Based Parsing utilise des modèles de langage pour extraire des données structurées depuis du HTML brut ou du texte. Au lieu de sélecteurs CSS fragiles, le LLM comprend sémantiquement le contenu et extrait les champs demandés. Cette approche est plus résiliente aux changements de structure des sites.',
      deepDive: `## LLM Parsing : quand l'IA remplace les sélecteurs CSS

### Comparatif des approches

| Aspect | Sélecteurs CSS/XPath | LLM Parsing |
|--------|---------------------|-------------|
| Précision | Haute (si bien ciblés) | Variable (95%+) |
| Résilience | Fragile aux changements | Très résiliente |
| Coût | Minimal | Tokens LLM |
| Vitesse | Très rapide | Plus lent |
| Setup | Configuration par site | Prompt universel |

### Cas d'usage idéaux

1. **Sites changeants** : E-commerce avec A/B testing fréquent
2. **Contenu non-structuré** : Articles, reviews, forums
3. **Extraction sémantique** : Sentiment, entités, relations
4. **Prototypage rapide** : POC sans développement

### Architecture typique

\`\`\`
HTML brut → Simplification (readability) → Prompt LLM → Parsing JSON → Validation
\`\`\`

### Optimisations de coût

- Utiliser des modèles plus petits (GPT-4 mini, Claude Haiku)
- Simplifier le HTML avant envoi (supprimer scripts, styles)
- Batching : plusieurs extractions par appel
- Cache : même structure = même résultat`,
      codeExample: {
        language: 'python',
        code: `# Extraction de données par LLM avec validation Pydantic
from pydantic import BaseModel, Field
from typing import List, Optional
import json
# from openai import OpenAI

class ExtractedProduct(BaseModel):
    """Schéma de validation pour les produits extraits"""
    name: str = Field(description="Nom du produit")
    price: float = Field(description="Prix en euros")
    description: Optional[str] = Field(description="Description courte")
    availability: bool = Field(description="Disponibilité en stock")
    rating: Optional[float] = Field(ge=0, le=5, description="Note sur 5")

class LLMExtractor:
    """Extracteur de données basé sur LLM avec fallback"""
    
    def __init__(self, model: str = "gpt-4o-mini"):
        self.model = model
        # self.client = OpenAI()
    
    def simplify_html(self, html: str) -> str:
        """Simplifie le HTML pour réduire les tokens"""
        from selectolax.parser import HTMLParser
        
        tree = HTMLParser(html)
        
        # Supprimer les éléments non-pertinents
        for tag in ['script', 'style', 'nav', 'footer', 'iframe', 'noscript']:
            for node in tree.css(tag):
                node.decompose()
        
        # Supprimer les attributs sauf class et id
        for node in tree.css('*'):
            for attr in list(node.attributes.keys()):
                if attr not in ['class', 'id', 'href', 'src', 'data-price']:
                    node.attrs.pop(attr, None)
        
        return tree.html
    
    def extract_product(self, html: str) -> ExtractedProduct:
        """Extrait un produit depuis du HTML via LLM"""
        simplified = self.simplify_html(html)
        
        prompt = f'''Extrait les informations du produit depuis ce HTML.
Retourne UNIQUEMENT un objet JSON valide avec ces champs:
- name (string): nom du produit
- price (number): prix en euros (nombre, pas de symbole)
- description (string ou null): description courte
- availability (boolean): true si en stock
- rating (number ou null): note sur 5

HTML:
{simplified[:8000]}  # Limiter pour éviter overflow

JSON:'''
        
        # En production:
        # response = self.client.chat.completions.create(
        #     model=self.model,
        #     messages=[{"role": "user", "content": prompt}],
        #     temperature=0,  # Déterminisme
        #     response_format={"type": "json_object"}
        # )
        # json_str = response.choices[0].message.content
        
        # Placeholder
        json_str = '{"name": "Product", "price": 99.99, "availability": true}'
        
        # Validation avec Pydantic
        data = json.loads(json_str)
        return ExtractedProduct(**data)
    
    def extract_with_fallback(self, html: str) -> ExtractedProduct:
        """Extraction avec fallback sur parsing traditionnel"""
        try:
            return self.extract_product(html)
        except Exception as e:
            print(f"LLM extraction failed: {e}")
            return self._fallback_extraction(html)
    
    def _fallback_extraction(self, html: str) -> ExtractedProduct:
        """Fallback vers extraction par sélecteurs"""
        from selectolax.parser import HTMLParser
        import re
        
        tree = HTMLParser(html)
        
        name = tree.css_first('h1')
        price_elem = tree.css_first('[data-price], .price')
        
        price = 0.0
        if price_elem:
            price_match = re.search(r'[\d,]+\.?\d*', price_elem.text())
            if price_match:
                price = float(price_match.group().replace(',', ''))
        
        return ExtractedProduct(
            name=name.text(strip=True) if name else "Unknown",
            price=price,
            description=None,
            availability=True,
            rating=None
        )

# Usage avec batch processing
async def batch_extract(urls: List[str], extractor: LLMExtractor) -> List[ExtractedProduct]:
    """Extraction batch avec rate limiting"""
    import asyncio
    import httpx
    
    results = []
    semaphore = asyncio.Semaphore(5)  # Limite concurrence LLM
    
    async with httpx.AsyncClient() as client:
        async def process_one(url):
            async with semaphore:
                response = await client.get(url)
                product = extractor.extract_with_fallback(response.text)
                return product
        
        tasks = [process_one(url) for url in urls]
        results = await asyncio.gather(*tasks, return_exceptions=True)
    
    return [r for r in results if isinstance(r, ExtractedProduct)]`,
        description: 'Extracteur LLM avec simplification HTML, validation Pydantic et fallback sur parsing traditionnel'
      },
      expertOpinion: 'Le LLM-Based Parsing est une révolution pour le scraping en 2026, mais pas une solution miracle. Les coûts en tokens peuvent exploser à grande échelle. L\'approche hybride (LLM pour cas difficiles, sélecteurs pour patterns stables) reste optimale. Les modèles vision (GPT-4V) ouvrent aussi la voie au scraping de screenshots.',
      relatedTerms: ['rag', 'self-healing-scrapers', 'dom-parsing'],
      updatedAt: '2026-02-01'
    },
    {
      slug: 'self-healing-scrapers',
      term: 'Self-Healing Scrapers',
      category: 'data-ai',
      microDefinition: 'Scrapers IA capables de s\'adapter automatiquement aux changements de sites.',
      fullDefinition: 'Les Self-Healing Scrapers détectent automatiquement quand un site change de structure et s\'adaptent sans intervention humaine. Utilisant le machine learning ou les LLMs, ils identifient les nouveaux sélecteurs correspondant aux mêmes données. Cette approche réduit drastiquement la maintenance des pipelines de scraping.',
      deepDive: `## Self-Healing : l'avenir du web scraping

### Le problème de la fragilité

Les scrapers traditionnels cassent quand :
- Le site change sa structure HTML
- Les classes CSS sont renommées
- Les éléments sont réorganisés
- Le framework frontend change

**Statistiques** : Un scraper moyen nécessite une maintenance toutes les 2-4 semaines.

### Approches de self-healing

**1. Détection de changement**
- Monitoring des taux de succès d'extraction
- Alertes sur valeurs nulles anormales
- Comparaison avec baseline historique

**2. Réparation automatique**
- ML : Entraîner un modèle sur les patterns visuels
- LLM : Demander au modèle de trouver les nouveaux sélecteurs
- Heuristiques : Recherche par texte/pattern de données

**3. Validation**
- Test A/B ancien vs nouveau sélecteur
- Vérification sémantique des données extraites
- Rollback automatique si régression`,
      codeExample: {
        language: 'python',
        code: `# Système de Self-Healing Scraper avec LLM
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Callable
from datetime import datetime
import json

@dataclass
class SelectorConfig:
    """Configuration d'un sélecteur avec historique"""
    field_name: str
    current_selector: str
    selector_history: List[str] = field(default_factory=list)
    last_success: Optional[datetime] = None
    failure_count: int = 0
    
class SelfHealingScraper:
    """Scraper avec capacités d'auto-réparation"""
    
    def __init__(self, base_url: str, selectors: Dict[str, str]):
        self.base_url = base_url
        self.selectors = {
            name: SelectorConfig(field_name=name, current_selector=sel)
            for name, sel in selectors.items()
        }
        self.failure_threshold = 3
        # self.llm_client = OpenAI()
    
    def extract(self, html: str) -> Dict[str, any]:
        """Extraction avec détection de pannes"""
        from selectolax.parser import HTMLParser
        tree = HTMLParser(html)
        
        results = {}
        failed_fields = []
        
        for field_name, config in self.selectors.items():
            value = self._try_extract(tree, config)
            
            if value:
                config.last_success = datetime.utcnow()
                config.failure_count = 0
                results[field_name] = value
            else:
                config.failure_count += 1
                failed_fields.append(field_name)
                
                if config.failure_count >= self.failure_threshold:
                    # Déclencher l'auto-réparation
                    new_selector = self._heal_selector(html, field_name, config)
                    if new_selector:
                        config.selector_history.append(config.current_selector)
                        config.current_selector = new_selector
                        # Réessayer avec le nouveau sélecteur
                        value = self._try_extract(tree, config)
                        if value:
                            results[field_name] = value
        
        return results
    
    def _try_extract(self, tree, config: SelectorConfig) -> Optional[str]:
        """Tente d'extraire une valeur avec le sélecteur actuel"""
        try:
            node = tree.css_first(config.current_selector)
            if node:
                text = node.text(strip=True)
                return text if text else None
        except Exception:
            pass
        return None
    
    def _heal_selector(self, html: str, field_name: str, config: SelectorConfig) -> Optional[str]:
        """Utilise un LLM pour trouver le nouveau sélecteur"""
        
        # Simplifier le HTML
        from selectolax.parser import HTMLParser
        tree = HTMLParser(html)
        for tag in ['script', 'style']:
            for node in tree.css(tag):
                node.decompose()
        
        simplified_html = tree.html[:15000]  # Limite tokens
        
        prompt = f'''Le sélecteur CSS "{config.current_selector}" ne fonctionne plus pour extraire "{field_name}".

Historique des sélecteurs qui fonctionnaient avant :
{json.dumps(config.selector_history[-3:], indent=2)}

HTML actuel de la page :
{simplified_html}

Analyse le HTML et trouve le nouveau sélecteur CSS qui permet d'extraire "{field_name}".
Retourne UNIQUEMENT le sélecteur CSS, rien d'autre.'''

        # En production:
        # response = self.llm_client.chat.completions.create(
        #     model="gpt-4o-mini",
        #     messages=[{"role": "user", "content": prompt}],
        #     temperature=0
        # )
        # new_selector = response.choices[0].message.content.strip()
        
        # Placeholder - simulation de réponse LLM
        new_selector = f"[data-{field_name}], .{field_name}-new"
        
        # Valider que le nouveau sélecteur fonctionne
        if tree.css_first(new_selector):
            print(f"🔧 Healed selector for '{field_name}': {new_selector}")
            return new_selector
        
        return None
    
    def get_health_report(self) -> Dict:
        """Rapport de santé des sélecteurs"""
        return {
            field: {
                'selector': config.current_selector,
                'failures': config.failure_count,
                'last_success': config.last_success.isoformat() if config.last_success else None,
                'history_depth': len(config.selector_history)
            }
            for field, config in self.selectors.items()
        }

# Usage
scraper = SelfHealingScraper(
    base_url="https://shop.example.com",
    selectors={
        'product_name': 'h1.product-title',
        'price': '.price-box .regular-price',
        'availability': '.stock-status'
    }
)

# Le scraper s'auto-répare si les sélecteurs cassent
# results = scraper.extract(html_content)
# print(scraper.get_health_report())`,
        description: 'Scraper auto-réparant avec détection de pannes, historique des sélecteurs et réparation via LLM'
      },
      expertOpinion: 'Les Self-Healing Scrapers représentent l\'évolution naturelle du métier en 2026. Les plateformes comme Diffbot ou Zyte les intègrent nativement. Pour les projets internes, combiner monitoring proactif + LLM repair + validation humaine offre le meilleur ratio coût/fiabilité. L\'objectif : passer de "maintenance réactive" à "adaptation continue".',
      relatedTerms: ['llm-based-parsing', 'dom-parsing', 'behavioral-analysis'],
      updatedAt: '2026-02-01'
    },

    // === ETHICS & PERFORMANCE ===
    {
      slug: 'crawl-budget',
      term: 'Crawl Budget',
      category: 'ethics',
      microDefinition: 'Nombre de pages qu\'un moteur explore sur un site en un temps donné.',
      fullDefinition: 'Le Crawl Budget représente la capacité de crawling allouée par les moteurs de recherche à un site web. Il dépend du "crawl rate limit" (vitesse maximale sans surcharger le serveur) et de la "crawl demand" (intérêt du contenu). Optimiser son crawl budget est crucial pour l\'indexation SEO des grands sites.',
      deepDive: `## Crawl Budget : maximiser l'indexation de vos pages

### Composants du Crawl Budget (Google)

**1. Crawl Rate Limit**
Vitesse maximale de crawl basée sur :
- Capacité du serveur (temps de réponse)
- Paramètres Search Console
- Erreurs serveur historiques

**2. Crawl Demand**
Intérêt de Google pour le contenu :
- Popularité des pages (backlinks, trafic)
- Fraîcheur du contenu
- Importance perçue des URLs

### Facteurs gaspillant le budget

| Problème | Impact | Solution |
|----------|--------|----------|
| Pages dupliquées | Crawl inutile | Canonical, noindex |
| Paramètres URL | Explosion combinatoire | GSC URL Parameters |
| Soft 404 | Ressources gaspillées | Vrais codes 404 |
| Redirect chains | Latence, abandons | Redirections directes |
| Ressources lourdes | Timeout crawl | Optimisation perf |

### Monitoring du Crawl Budget

- **Google Search Console** : Statistiques d'exploration
- **Logs serveur** : Analyse des visites Googlebot
- **ScreamingFrog** : Simulation de crawl`,
      codeExample: {
        language: 'python',
        code: `# Analyse du Crawl Budget via logs serveur
import re
from datetime import datetime, timedelta
from collections import defaultdict
from typing import Dict, List
from dataclasses import dataclass

@dataclass
class CrawlHit:
    timestamp: datetime
    bot: str
    url: str
    status_code: int
    response_time_ms: float

class CrawlBudgetAnalyzer:
    """Analyseur de Crawl Budget à partir des logs serveur"""
    
    BOT_PATTERNS = {
        'Googlebot': r'Googlebot(?:-Image|-News|-Video)?',
        'Bingbot': r'bingbot',
        'GPTBot': r'GPTBot',
        'ClaudeBot': r'Claude-Web|ClaudeBot',
    }
    
    def __init__(self):
        self.hits: List[CrawlHit] = []
    
    def parse_log_line(self, line: str) -> CrawlHit | None:
        """Parse une ligne de log Apache/Nginx"""
        # Format: IP - - [timestamp] "METHOD URL PROTO" STATUS SIZE "REFERER" "UA"
        pattern = r'(\d+\.\d+\.\d+\.\d+).*\[(.+?)\].*"(\w+) (.+?) HTTP.*" (\d+) (\d+|-) ".*?" "(.+?)"'
        
        match = re.match(pattern, line)
        if not match:
            return None
        
        ip, timestamp_str, method, url, status, size, user_agent = match.groups()
        
        # Détecter le bot
        bot = None
        for bot_name, pattern in self.BOT_PATTERNS.items():
            if re.search(pattern, user_agent, re.IGNORECASE):
                bot = bot_name
                break
        
        if not bot:
            return None  # Ignorer les non-bots
        
        # Parser le timestamp
        timestamp = datetime.strptime(timestamp_str.split()[0], '%d/%b/%Y:%H:%M:%S')
        
        return CrawlHit(
            timestamp=timestamp,
            bot=bot,
            url=url,
            status_code=int(status),
            response_time_ms=0  # À extraire si disponible
        )
    
    def analyze_logs(self, log_file: str):
        """Analyse un fichier de logs complet"""
        with open(log_file, 'r') as f:
            for line in f:
                hit = self.parse_log_line(line)
                if hit:
                    self.hits.append(hit)
    
    def get_crawl_stats(self, days: int = 7) -> Dict:
        """Génère les statistiques de crawl"""
        cutoff = datetime.now() - timedelta(days=days)
        recent_hits = [h for h in self.hits if h.timestamp > cutoff]
        
        stats = {
            'period_days': days,
            'total_crawls': len(recent_hits),
            'by_bot': defaultdict(int),
            'by_status': defaultdict(int),
            'crawl_rate_per_day': len(recent_hits) / days,
            'top_crawled_urls': defaultdict(int),
            'error_rate': 0
        }
        
        for hit in recent_hits:
            stats['by_bot'][hit.bot] += 1
            stats['by_status'][hit.status_code] += 1
            stats['top_crawled_urls'][hit.url] += 1
        
        # Calculer le taux d'erreur
        total = len(recent_hits)
        errors = sum(1 for h in recent_hits if h.status_code >= 400)
        stats['error_rate'] = errors / total if total > 0 else 0
        
        # Top 20 URLs les plus crawlées
        stats['top_crawled_urls'] = dict(
            sorted(stats['top_crawled_urls'].items(), 
                   key=lambda x: x[1], reverse=True)[:20]
        )
        
        return stats
    
    def detect_budget_waste(self) -> List[Dict]:
        """Détecte les gaspillages de crawl budget"""
        issues = []
        stats = self.get_crawl_stats()
        
        # Issue 1: Trop de crawl sur les mêmes URLs
        for url, count in stats['top_crawled_urls'].items():
            if count > 50:  # Seuil arbitraire
                issues.append({
                    'type': 'over_crawled',
                    'url': url,
                    'crawl_count': count,
                    'recommendation': 'Vérifier le maillage interne ou utiliser noindex'
                })
        
        # Issue 2: Taux d'erreur élevé
        if stats['error_rate'] > 0.05:
            issues.append({
                'type': 'high_error_rate',
                'error_rate': f"{stats['error_rate']*100:.1f}%",
                'recommendation': 'Corriger les erreurs 4xx/5xx pour préserver le budget'
            })
        
        # Issue 3: Paramètres URL excessifs
        param_urls = [u for u in stats['top_crawled_urls'] if '?' in u]
        if len(param_urls) > 10:
            issues.append({
                'type': 'parameter_explosion',
                'count': len(param_urls),
                'recommendation': 'Configurer les paramètres URL dans Search Console'
            })
        
        return issues

# Usage
analyzer = CrawlBudgetAnalyzer()
# analyzer.analyze_logs('/var/log/nginx/access.log')
# print(analyzer.get_crawl_stats())
# print(analyzer.detect_budget_waste())`,
        description: 'Analyseur de logs serveur pour monitorer le crawl budget par bot et détecter les gaspillages'
      },
      expertOpinion: 'Le Crawl Budget devient critique en 2026 avec l\'ajout des crawlers IA (GPTBot, ClaudeBot) qui consomment aussi des ressources. Les sites doivent désormais arbitrer entre visibilité SEO classique et GEO. L\'analyse des logs reste l\'outil le plus fiable pour comprendre comment les bots explorent réellement votre site.',
      relatedTerms: ['robots-txt-interpretation', 'concurrency-control', 'ethical-scraping'],
      updatedAt: '2026-02-01'
    },
    {
      slug: 'concurrency-control',
      term: 'Concurrency Control',
      category: 'ethics',
      microDefinition: 'Gestion du nombre de requêtes parallèles lors du web scraping.',
      fullDefinition: 'Le Concurrency Control régule le nombre de requêtes simultanées envoyées à un serveur lors du scraping. Une concurrence trop élevée peut surcharger le serveur cible (DoS involontaire), déclencher des blocages IP, ou violer les conditions d\'utilisation. Une gestion intelligente équilibre vitesse et respect du serveur.',
      deepDive: `## Concurrency Control : l'art de scraper sans nuire

### Pourquoi limiter la concurrence ?

**Risques d'une concurrence excessive :**
- Surcharge du serveur cible (temps de réponse dégradé)
- Blocage IP temporaire ou permanent
- Détection comme attaque DDoS
- Violation des CGU et risques légaux

**Bonnes pratiques par type de site :**
| Type de site | Concurrence max | Délai entre requêtes |
|--------------|-----------------|---------------------|
| Petit site perso | 1-2 | 2-5 sec |
| Site corporate | 2-5 | 1-2 sec |
| E-commerce | 5-10 | 0.5-1 sec |
| CDN/API publique | 20-50 | 100-500 ms |

### Stratégies avancées

1. **Rate limiting adaptatif** : Ralentir si le serveur répond lentement
2. **Backoff exponentiel** : Doubler le délai après chaque erreur
3. **Respect du Crawl-Delay** : Lire robots.txt
4. **Fingerprint par domaine** : Limites différentes par site`,
      codeExample: {
        language: 'python',
        code: `# Système de concurrence adaptatif avec rate limiting intelligent
import asyncio
import time
from dataclasses import dataclass, field
from typing import Dict, Optional
import httpx

@dataclass
class DomainState:
    """État de rate limiting pour un domaine"""
    concurrent_requests: int = 0
    max_concurrent: int = 5
    last_request_time: float = 0
    min_delay: float = 0.5
    current_delay: float = 0.5
    consecutive_errors: int = 0
    avg_response_time: float = 0.5
    request_count: int = 0

class AdaptiveConcurrencyController:
    """Contrôleur de concurrence adaptatif par domaine"""
    
    def __init__(self):
        self.domains: Dict[str, DomainState] = {}
        self.locks: Dict[str, asyncio.Lock] = {}
    
    def _get_domain(self, url: str) -> str:
        from urllib.parse import urlparse
        return urlparse(url).netloc
    
    def _get_state(self, domain: str) -> DomainState:
        if domain not in self.domains:
            self.domains[domain] = DomainState()
            self.locks[domain] = asyncio.Lock()
        return self.domains[domain]
    
    async def acquire(self, url: str):
        """Attend et acquiert un slot de concurrence"""
        domain = self._get_domain(url)
        state = self._get_state(domain)
        
        async with self.locks[domain]:
            # Attendre si trop de requêtes en cours
            while state.concurrent_requests >= state.max_concurrent:
                await asyncio.sleep(0.1)
            
            # Respecter le délai minimum
            elapsed = time.time() - state.last_request_time
            if elapsed < state.current_delay:
                await asyncio.sleep(state.current_delay - elapsed)
            
            state.concurrent_requests += 1
            state.last_request_time = time.time()
    
    def release(self, url: str, response_time: float, success: bool):
        """Libère un slot et ajuste les paramètres"""
        domain = self._get_domain(url)
        state = self._get_state(domain)
        
        state.concurrent_requests -= 1
        state.request_count += 1
        
        # Mise à jour du temps de réponse moyen (moyenne mobile)
        alpha = 0.2
        state.avg_response_time = alpha * response_time + (1 - alpha) * state.avg_response_time
        
        if success:
            state.consecutive_errors = 0
            # Accélérer si le serveur répond vite
            if state.avg_response_time < 0.3 and state.current_delay > state.min_delay:
                state.current_delay = max(state.min_delay, state.current_delay * 0.9)
            # Augmenter la concurrence si tout va bien
            if state.request_count % 100 == 0 and state.avg_response_time < 0.5:
                state.max_concurrent = min(20, state.max_concurrent + 1)
        else:
            state.consecutive_errors += 1
            # Backoff exponentiel
            state.current_delay = min(30, state.current_delay * 2)
            # Réduire la concurrence en cas d'erreurs
            if state.consecutive_errors >= 3:
                state.max_concurrent = max(1, state.max_concurrent // 2)
    
    def get_stats(self) -> Dict:
        return {
            domain: {
                'concurrent': state.concurrent_requests,
                'max_concurrent': state.max_concurrent,
                'current_delay': round(state.current_delay, 2),
                'avg_response': round(state.avg_response_time, 3),
                'total_requests': state.request_count
            }
            for domain, state in self.domains.items()
        }

# Client HTTP avec concurrence contrôlée
class PoliteClient:
    def __init__(self):
        self.controller = AdaptiveConcurrencyController()
        self.client = httpx.AsyncClient(timeout=30)
    
    async def get(self, url: str) -> httpx.Response:
        await self.controller.acquire(url)
        
        start = time.time()
        success = False
        try:
            response = await self.client.get(url)
            success = response.status_code < 400
            return response
        finally:
            response_time = time.time() - start
            self.controller.release(url, response_time, success)
    
    async def close(self):
        await self.client.aclose()

# Usage
async def polite_scrape(urls: list):
    client = PoliteClient()
    
    async def fetch(url):
        try:
            response = await client.get(url)
            return {'url': url, 'status': response.status_code}
        except Exception as e:
            return {'url': url, 'error': str(e)}
    
    results = await asyncio.gather(*[fetch(url) for url in urls])
    
    print("Stats:", client.controller.get_stats())
    await client.close()
    return results`,
        description: 'Contrôleur de concurrence adaptatif avec rate limiting par domaine et backoff automatique'
      },
      expertOpinion: 'Le Concurrency Control différencie le scraping professionnel du "hit and run". En 2026, les entreprises responsables implémentent des systèmes adaptatifs qui respectent les serveurs cibles. La règle d\'or : si vous ne voudriez pas que quelqu\'un scrappe votre site à cette vitesse, ne le faites pas aux autres.',
      relatedTerms: ['crawl-budget', 'ethical-scraping', 'robots-txt-interpretation'],
      updatedAt: '2026-02-01'
    },
    {
      slug: 'ethical-scraping',
      term: 'Ethical Scraping / Responsible Crawling',
      category: 'ethics',
      microDefinition: 'Pratiques de web scraping respectueuses des sites cibles et du droit.',
      fullDefinition: 'L\'Ethical Scraping désigne les pratiques de collecte de données web respectant les conditions d\'utilisation des sites, le robots.txt, les limites de charge serveur, et les réglementations (RGPD). Il implique la transparence (User-Agent identifiable), la proportionnalité (ne collecter que le nécessaire), et le respect de la propriété intellectuelle.',
      deepDive: `## Ethical Scraping : le framework du scraping responsable

### Les 7 piliers du scraping éthique

1. **Respect du robots.txt**
   - Toujours lire et respecter les directives
   - Implémenter le Crawl-Delay si spécifié

2. **User-Agent transparent**
   - Identifier clairement votre bot
   - Fournir une URL de contact ou documentation

3. **Rate limiting raisonnable**
   - Ne pas surcharger les serveurs
   - Adapter la vitesse à la capacité du site

4. **Minimisation des données**
   - Ne collecter que le strict nécessaire
   - Supprimer les données personnelles non essentielles

5. **Respect des CGU**
   - Lire les conditions d'utilisation
   - Obtenir une autorisation si nécessaire

6. **Conformité RGPD**
   - Base légale pour les données personnelles
   - Droits des personnes concernées

7. **Transparence**
   - Documenter vos pratiques
   - Répondre aux demandes des sites

### Cadre légal en 2026

| Juridiction | Statut du scraping |
|-------------|-------------------|
| USA | hiQ Labs vs LinkedIn : scraping de données publiques généralement autorisé |
| UE | RGPD + directive bases de données : restrictions sur données personnelles |
| France | Droit sui generis des bases de données à respecter |`,
      codeExample: {
        language: 'python',
        code: `# Framework de scraping éthique complet
from dataclasses import dataclass
from typing import Optional, List
from urllib.parse import urlparse, urljoin
from urllib.robotparser import RobotFileParser
import httpx
import asyncio

@dataclass
class EthicalScrapingConfig:
    """Configuration de scraping éthique"""
    bot_name: str = "MyCompanyBot"
    bot_version: str = "1.0"
    contact_url: str = "https://mycompany.com/bot"
    contact_email: str = "bot@mycompany.com"
    respect_robots_txt: bool = True
    max_requests_per_second: float = 1.0
    min_delay_between_requests: float = 1.0
    max_retries: int = 3
    collect_personal_data: bool = False

class EthicalScraper:
    """Scraper respectant les bonnes pratiques éthiques"""
    
    def __init__(self, config: EthicalScrapingConfig):
        self.config = config
        self.robots_cache: dict[str, RobotFileParser] = {}
        self.user_agent = f"{config.bot_name}/{config.bot_version} (+{config.contact_url})"
    
    async def _get_robots_parser(self, base_url: str) -> RobotFileParser:
        """Récupère et parse le robots.txt"""
        if base_url in self.robots_cache:
            return self.robots_cache[base_url]
        
        robots_url = urljoin(base_url, '/robots.txt')
        parser = RobotFileParser()
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(robots_url, timeout=10)
                if response.status_code == 200:
                    parser.parse(response.text.splitlines())
        except Exception:
            pass  # Pas de robots.txt = tout autorisé
        
        self.robots_cache[base_url] = parser
        return parser
    
    async def can_fetch(self, url: str) -> bool:
        """Vérifie si on peut crawler cette URL selon robots.txt"""
        if not self.config.respect_robots_txt:
            return True
        
        parsed = urlparse(url)
        base_url = f"{parsed.scheme}://{parsed.netloc}"
        
        parser = await self._get_robots_parser(base_url)
        return parser.can_fetch(self.user_agent, url)
    
    def get_crawl_delay(self, url: str) -> float:
        """Retourne le Crawl-Delay du robots.txt ou la config par défaut"""
        parsed = urlparse(url)
        base_url = f"{parsed.scheme}://{parsed.netloc}"
        
        if base_url in self.robots_cache:
            delay = self.robots_cache[base_url].crawl_delay(self.user_agent)
            if delay:
                return max(delay, self.config.min_delay_between_requests)
        
        return self.config.min_delay_between_requests
    
    def _sanitize_data(self, data: dict) -> dict:
        """Supprime les données personnelles si configuré"""
        if self.config.collect_personal_data:
            return data
        
        # Patterns de données personnelles à supprimer
        personal_patterns = ['email', 'phone', 'address', 'name', 'ssn', 'credit_card']
        
        sanitized = {}
        for key, value in data.items():
            key_lower = key.lower()
            if any(pattern in key_lower for pattern in personal_patterns):
                continue  # Skip personal data
            sanitized[key] = value
        
        return sanitized
    
    async def fetch(self, url: str) -> Optional[dict]:
        """Effectue une requête éthique"""
        
        # 1. Vérifier robots.txt
        if not await self.can_fetch(url):
            print(f"⛔ Blocked by robots.txt: {url}")
            return None
        
        # 2. Respecter le délai
        delay = self.get_crawl_delay(url)
        await asyncio.sleep(delay)
        
        # 3. Requête avec User-Agent identifiable
        headers = {
            'User-Agent': self.user_agent,
            'From': self.config.contact_email,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, headers=headers, timeout=30)
                
                if response.status_code == 200:
                    return {
                        'url': url,
                        'status': response.status_code,
                        'content': response.text,
                        'scraped_ethically': True
                    }
                elif response.status_code == 429:
                    print(f"⚠️ Rate limited on {url}, backing off...")
                    await asyncio.sleep(60)
                    return None
                    
        except Exception as e:
            print(f"❌ Error fetching {url}: {e}")
            return None
    
    def generate_compliance_report(self, urls_scraped: List[str]) -> dict:
        """Génère un rapport de conformité"""
        return {
            'bot_identity': self.user_agent,
            'contact': self.config.contact_email,
            'robots_txt_respected': self.config.respect_robots_txt,
            'personal_data_collected': self.config.collect_personal_data,
            'urls_scraped_count': len(urls_scraped),
            'compliance_statement': (
                "This scraping operation was conducted following ethical guidelines: "
                "robots.txt was respected, rate limiting was applied, and our bot is identifiable."
            )
        }

# Usage
config = EthicalScrapingConfig(
    bot_name="CrawlersFR-Research",
    contact_url="https://crawlers.fr/bot-info",
    contact_email="tech@crawlers.fr",
    min_delay_between_requests=2.0
)

scraper = EthicalScraper(config)`,
        description: 'Framework complet de scraping éthique avec respect du robots.txt, User-Agent transparent et sanitization des données'
      },
      expertOpinion: 'L\'Ethical Scraping devient un avantage compétitif en 2026. Les entreprises qui documentent leurs pratiques responsables gagnent la confiance des sites cibles et réduisent leurs risques légaux. Le marché évolue vers des "data partnerships" où les deux parties bénéficient de l\'échange de données structurées.',
      relatedTerms: ['robots-txt-interpretation', 'crawl-budget', 'concurrency-control'],
      updatedAt: '2026-02-01'
    },
    {
      slug: 'robots-txt-interpretation',
      term: 'Robots.txt Interpretation',
      category: 'ethics',
      microDefinition: 'Lecture et application des règles du fichier robots.txt des sites web.',
      fullDefinition: 'L\'interprétation du robots.txt consiste à parser et appliquer les directives du fichier /robots.txt qui indique aux robots quelles pages crawler ou éviter. Les directives incluent Allow, Disallow, Crawl-delay, et Sitemap. Les crawlers responsables respectent ces règles, bien qu\'elles ne soient pas légalement contraignantes.',
      deepDive: `## Robots.txt : le contrat social du web

### Syntaxe et directives

\`\`\`
User-agent: *
Disallow: /admin/
Disallow: /private/
Allow: /public/

User-agent: GPTBot
Disallow: /

User-agent: Googlebot
Crawl-delay: 2
Sitemap: https://example.com/sitemap.xml
\`\`\`

### Directives clés

| Directive | Signification |
|-----------|---------------|
| User-agent | Bot concerné (* = tous) |
| Disallow | Chemin interdit |
| Allow | Exception à un Disallow parent |
| Crawl-delay | Délai en secondes entre requêtes |
| Sitemap | URL du sitemap XML |

### Subtilités d'interprétation

1. **Ordre des règles** : La règle la plus spécifique l'emporte
2. **Wildcards** : \`*\` (tout) et \`$\` (fin d'URL)
3. **Sensibilité à la casse** : Les chemins sont sensibles
4. **Absence = autorisation** : Pas de robots.txt = tout autorisé

### Différences entre crawlers

Chaque crawler peut interpréter différemment :
- **Googlebot** : Supporte \`*\` et \`$\`
- **GPTBot** : Respecte les règles mais ignore Crawl-delay
- **Certains bots** : Ignorent complètement le fichier`,
      codeExample: {
        language: 'python',
        code: `# Parser robots.txt complet avec support des wildcards
import re
from dataclasses import dataclass
from typing import List, Optional, Dict
from urllib.parse import urlparse, urljoin
import httpx

@dataclass
class RobotsRule:
    path_pattern: str
    allowed: bool
    
    def matches(self, path: str) -> bool:
        """Vérifie si le chemin matche le pattern"""
        # Convertir le pattern robots.txt en regex
        regex_pattern = self.path_pattern
        regex_pattern = regex_pattern.replace('*', '.*')
        regex_pattern = regex_pattern.replace('$', '$')
        if not regex_pattern.endswith('$'):
            regex_pattern = f"^{regex_pattern}"
        else:
            regex_pattern = f"^{regex_pattern}"
        
        try:
            return bool(re.match(regex_pattern, path, re.IGNORECASE))
        except re.error:
            return self.path_pattern in path

@dataclass
class RobotsDirectives:
    """Directives pour un User-Agent spécifique"""
    user_agent: str
    rules: List[RobotsRule]
    crawl_delay: Optional[float] = None
    sitemaps: List[str] = None
    
    def __post_init__(self):
        if self.sitemaps is None:
            self.sitemaps = []

class AdvancedRobotsTxtParser:
    """Parser robots.txt avancé avec support complet"""
    
    def __init__(self):
        self.directives: Dict[str, RobotsDirectives] = {}
        self.sitemaps: List[str] = []
    
    def parse(self, content: str):
        """Parse le contenu du robots.txt"""
        current_agents: List[str] = []
        current_rules: List[RobotsRule] = []
        current_crawl_delay: Optional[float] = None
        
        for line in content.split('\n'):
            line = line.split('#')[0].strip()  # Supprimer commentaires
            if not line:
                continue
            
            if ':' not in line:
                continue
            
            directive, value = line.split(':', 1)
            directive = directive.strip().lower()
            value = value.strip()
            
            if directive == 'user-agent':
                # Sauvegarder les règles précédentes
                if current_agents and current_rules:
                    for agent in current_agents:
                        self.directives[agent.lower()] = RobotsDirectives(
                            user_agent=agent,
                            rules=current_rules.copy(),
                            crawl_delay=current_crawl_delay,
                            sitemaps=self.sitemaps.copy()
                        )
                    current_rules = []
                    current_crawl_delay = None
                
                current_agents = [value]
                
            elif directive == 'disallow':
                if value:  # Disallow vide = tout autoriser
                    current_rules.append(RobotsRule(path_pattern=value, allowed=False))
                    
            elif directive == 'allow':
                current_rules.append(RobotsRule(path_pattern=value, allowed=True))
                
            elif directive == 'crawl-delay':
                try:
                    current_crawl_delay = float(value)
                except ValueError:
                    pass
                    
            elif directive == 'sitemap':
                self.sitemaps.append(value)
        
        # Sauvegarder les dernières règles
        if current_agents:
            for agent in current_agents:
                self.directives[agent.lower()] = RobotsDirectives(
                    user_agent=agent,
                    rules=current_rules,
                    crawl_delay=current_crawl_delay,
                    sitemaps=self.sitemaps
                )
    
    def can_fetch(self, user_agent: str, path: str) -> bool:
        """Détermine si l'URL peut être crawlée"""
        # Trouver les directives applicables
        agent_lower = user_agent.lower()
        directives = None
        
        # Chercher une correspondance exacte d'abord
        for key in self.directives:
            if key in agent_lower or agent_lower in key:
                directives = self.directives[key]
                break
        
        # Fallback sur * (wildcard)
        if not directives and '*' in self.directives:
            directives = self.directives['*']
        
        if not directives:
            return True  # Pas de règles = autorisé
        
        # Appliquer les règles (la plus spécifique gagne)
        matching_rules = [r for r in directives.rules if r.matches(path)]
        
        if not matching_rules:
            return True
        
        # Trier par longueur de pattern (plus long = plus spécifique)
        matching_rules.sort(key=lambda r: len(r.path_pattern), reverse=True)
        return matching_rules[0].allowed
    
    def get_crawl_delay(self, user_agent: str) -> Optional[float]:
        """Retourne le Crawl-delay pour un User-Agent"""
        agent_lower = user_agent.lower()
        
        for key, directives in self.directives.items():
            if key in agent_lower or agent_lower in key:
                return directives.crawl_delay
        
        if '*' in self.directives:
            return self.directives['*'].crawl_delay
        
        return None

# Exemple d'utilisation
async def check_robots(url: str, bot_name: str = "MyCrawler"):
    parsed = urlparse(url)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
    
    async with httpx.AsyncClient() as client:
        response = await client.get(robots_url)
        
        parser = AdvancedRobotsTxtParser()
        parser.parse(response.text)
        
        can_crawl = parser.can_fetch(bot_name, parsed.path)
        delay = parser.get_crawl_delay(bot_name)
        
        return {
            'url': url,
            'can_crawl': can_crawl,
            'crawl_delay': delay,
            'sitemaps': parser.sitemaps
        }`,
        description: 'Parser robots.txt avancé avec support des wildcards, priorité des règles et crawl-delay'
      },
      expertOpinion: 'L\'interprétation du robots.txt devient complexe en 2026 avec l\'arrivée des bots IA. Certains sites bloquent GPTBot et ClaudeBot pour protéger leur contenu de l\'entraînement IA, tout en autorisant Googlebot. Les scrapers responsables doivent mettre à jour régulièrement leur parsing pour supporter les nouvelles conventions comme le fichier llms.txt proposé par certains acteurs.',
      relatedTerms: ['ethical-scraping', 'crawl-budget', 'concurrency-control'],
      updatedAt: '2026-02-01'
    },
    {
      slug: 'aeo-answer-engine-optimization',
      term: 'AEO (Answer Engine Optimization)',
      category: 'data-ai',
      microDefinition: "Optimisation du contenu pour être cité par les IA et assistants vocaux.",
      fullDefinition: "Ensemble de techniques visant à structurer et formuler le contenu d'un site web pour qu'il soit sélectionné et lu directement par les assistants vocaux, ou cité comme source de référence par les intelligences artificielles génératives (ChatGPT, Google AI Overviews). Contrairement au SEO traditionnel qui vise le clic, l'AEO vise la citation directe et la Position Zéro.",
      deepDive: `## AEO : de la visibilité au clic vers la visibilité à la citation

### Pourquoi l'AEO est essentiel en 2026

Avec l'essor des moteurs de recherche génératifs (Google AI Overviews, Perplexity, ChatGPT Search), la bataille du référencement ne se joue plus uniquement sur les 10 liens bleus de Google. En 2026, **plus de 40% des recherches aboutissent à une réponse directe** sans clic vers un site tiers.

### Les 3 piliers de l'AEO

1. **Structure sémantique** : Utiliser des balises Schema.org (FAQPage, HowTo, Article), des titres interrogatifs et une pyramide inversée pour que les IA puissent extraire facilement vos réponses.

2. **Formats extractibles** : Privilégier les listes ordonnées, tableaux comparatifs et résumés (TL;DR) qui sont les formats de prédilection des moteurs de réponses.

3. **Signaux d'autorité (E-E-A-T)** : Démontrer l'expertise par des bios d'auteurs, des citations de sources fiables, des études de cas chiffrées.

### Différence entre SEO, GEO et AEO

- **SEO** : Optimiser pour les résultats organiques de Google (clics)
- **GEO** : Optimiser pour être cité par les moteurs génératifs (citations)
- **AEO** : Optimiser pour être la réponse directe des assistants vocaux et IA (Position Zéro)

L'AEO est un sous-ensemble stratégique du GEO, focalisé sur la formulation des réponses et la structure du contenu.`,
      codeExample: {
        language: 'javascript',
        code: `// Exemple de balisage Schema.org FAQPage optimisé AEO
const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Comment optimiser son site pour l'AEO en 2026 ?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Pour optimiser votre site pour l'AEO, structurez vos réponses en pyramide inversée (réponse directe en premier paragraphe de 40-60 mots), utilisez des balises Schema.org (FAQPage, HowTo), ajoutez des listes et tableaux comparatifs, et identifiez clairement vos auteurs pour renforcer l'E-E-A-T."
      }
    }
  ]
};

// Injection dans le <head>
const script = document.createElement('script');
script.type = 'application/ld+json';
script.textContent = JSON.stringify(faqSchema);
document.head.appendChild(script);`,
        description: "Balisage Schema.org FAQPage pour maximiser les chances d'être sélectionné comme réponse directe par les IA"
      },
      expertOpinion: "L'AEO représente la prochaine frontière du référencement. En 2026, les marques qui n'optimisent pas pour les moteurs de réponses perdent une part croissante de leur visibilité. La clé est de combiner structure technique (Schema.org, pyramide inversée) et autorité éditoriale (E-E-A-T) pour devenir la source de référence que les IA choisissent de citer.",
      relatedTerms: ['ethical-scraping', 'data-enrichment'],
      updatedAt: '2026-03-10'
    },
    // === GEO METRICS ===
    {
      slug: 'quotability-index',
      term: 'Quotability Index',
      category: 'data-ai',
      microDefinition: 'Score mesurant la probabilité qu\'un contenu soit cité par une IA.',
      fullDefinition: 'Le Quotability Index (indice de citabilité) est un score de 0 à 100 évaluant la capacité d\'un contenu web à être repris verbatim par les moteurs de recherche IA (ChatGPT, Perplexity, Gemini). Il analyse la présence de phrases concises, factuelles et auto-suffisantes — des "snippets naturels" que les LLM privilégient comme sources de citations directes dans leurs réponses.',
      deepDive: `## Quotability Index : la métrique clé du GEO en 2026

### Pourquoi les IA citent certains contenus et pas d'autres

Les modèles de langage (LLM) sélectionnent les passages à citer selon trois critères principaux :
1. **Auto-suffisance** : la phrase est compréhensible hors contexte
2. **Factualité** : elle contient une donnée vérifiable (chiffre, date, définition)
3. **Concision** : elle tient en 1-2 phrases maximum

### Comment le score est calculé

Le Quotability Index est évalué par un LLM qui analyse le contenu de la page et identifie jusqu'à 3 phrases "quotables". Le score reflète :
- La densité de phrases citables dans le contenu
- La qualité factuelle de ces phrases
- Leur positionnement dans la structure (titres, introductions, listes)

### Impact sur la visibilité GEO

Un score élevé (>70) corrèle fortement avec un taux de citation plus élevé dans les réponses des IA. Les pages avec un Quotability Index faible (<30) sont rarement citées, même si elles apparaissent dans les résultats de recherche traditionnels.

### Optimisation

- Placer des définitions claires en début de paragraphe
- Inclure des statistiques sourcées et datées
- Utiliser la structure "pyramide inversée" (conclusion d'abord)
- Rédiger des phrases de 15-25 mots maximum pour les passages clés`,
      codeExample: {
        language: 'typescript',
        code: `// Exemple de structure quotable optimisée
const quotableContent = {
  // ✅ Bon : phrase auto-suffisante, factuelle, concise
  good: "Le TLS Fingerprinting détecte 70% des bots en analysant le handshake SSL.",
  
  // ❌ Mauvais : dépend du contexte, vague
  bad: "Cette technique est très efficace pour détecter les bots.",
  
  // ✅ Bon : définition claire en ouverture
  definition: "Le GEO (Generative Engine Optimization) optimise le contenu " +
    "pour les moteurs de recherche IA comme ChatGPT et Perplexity."
};

// Structure HTML optimisée pour la citabilité
const optimizedHTML = \`
<p><strong>Le Quotability Index</strong> mesure la probabilité 
qu'un contenu soit cité par une IA générative, sur une échelle de 0 à 100.</p>
\`;`,
        description: 'Exemples de contenu optimisé pour maximiser la citabilité par les IA'
      },
      expertOpinion: 'En 2026, le Quotability Index devient un KPI incontournable du GEO. Les marques qui structurent leurs contenus avec des "citation-ready snippets" captent jusqu\'à 3x plus de mentions dans les réponses IA. C\'est le nouveau "featured snippet" de l\'ère générative.',
      relatedTerms: ['aeo-answer-engine-optimization', 'rag', 'llm-based-parsing'],
      updatedAt: '2026-04-15'
    },
    {
      slug: 'position-zero',
      term: 'Position Zéro',
      category: 'data-ai',
      microDefinition: 'Résultat affiché au-dessus du premier lien organique dans Google.',
      fullDefinition: 'La Position Zéro (Featured Snippet) désigne le bloc de réponse directe que Google affiche au-dessus des résultats organiques traditionnels. En 2026, ce concept s\'étend aux réponses générées par les AI Overviews de Google et aux citations des moteurs génératifs (Perplexity, ChatGPT Search). Obtenir la position zéro signifie que votre contenu est sélectionné comme LA réponse de référence.',
      deepDive: `## Position Zéro : du Featured Snippet aux AI Overviews

### Évolution du concept

La Position Zéro a connu trois ères :
1. **2014-2020** : Featured Snippets classiques (paragraphe, liste, tableau)
2. **2021-2024** : People Also Ask + Featured Snippets enrichis
3. **2025-2026** : AI Overviews (SGE) + citations dans les moteurs génératifs

### Types de Position Zéro en 2026

| Type | Source | Format |
|------|--------|--------|
| Featured Snippet | Google Search | Paragraphe, liste, tableau |
| AI Overview | Google SGE | Synthèse multi-sources |
| Citation directe | Perplexity, ChatGPT | Lien + extrait |
| Knowledge Panel | Google KG | Fiche structurée |

### Comment l'obtenir

1. **Répondre directement** à une question dans les 40-60 premiers mots
2. **Structurer en pyramide inversée** : réponse → détails → contexte
3. **Baliser avec Schema.org** : FAQPage, HowTo, Article
4. **Viser les requêtes informationnelles** avec un volume de recherche >500/mois

### Lien avec le GEO

En GEO, la "position zéro" n'est plus seulement Google : c'est être la source citée en premier par n'importe quel moteur IA. Le score AEO (Answer Engine Optimization) mesure directement cette capacité.`,
      codeExample: {
        language: 'typescript',
        code: `// Balisage Schema.org optimisé pour la Position Zéro
const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [{
    "@type": "Question",
    "name": "Qu'est-ce que la Position Zéro ?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "La Position Zéro est le résultat affiché au-dessus " +
        "du premier lien organique dans Google, sous forme de " +
        "Featured Snippet ou d'AI Overview."
    }
  }]
};

// Vérification de l'éligibilité Position Zéro
function checkP0Eligibility(content: string): boolean {
  const hasDirectAnswer = /^[A-Z].{20,80}\\.$/.test(content.split('\\n')[0]);
  const hasStructuredData = content.includes('schema.org');
  const wordCount = content.split(' ').length;
  return hasDirectAnswer && wordCount > 300 && wordCount < 2000;
}`,
        description: 'Balisage et vérification d\'éligibilité pour la Position Zéro'
      },
      expertOpinion: 'La Position Zéro évolue : en 2026, il ne s\'agit plus seulement d\'apparaître en haut de Google, mais d\'être LA source que tous les moteurs IA choisissent de citer. L\'optimisation croisée SEO + GEO (balisage Schema.org + contenu quotable + E-E-A-T) est la stratégie gagnante.',
      relatedTerms: ['aeo-answer-engine-optimization', 'quotability-index', 'schema-org-extraction'],
      updatedAt: '2026-04-15'
    },
    {
      slug: 'query-fan-out',
      term: 'Query Fan-Out',
      category: 'data-ai',
      microDefinition: 'Décomposition d\'une requête complexe en sous-requêtes par les moteurs RAG.',
      fullDefinition: 'Le Query Fan-Out est le mécanisme par lequel un moteur de recherche IA (Perplexity, ChatGPT, Google SGE) décompose une requête utilisateur complexe en plusieurs sous-requêtes thématiques avant de synthétiser une réponse. Comprendre ce phénomène permet d\'optimiser son contenu pour couvrir tous les axes sémantiques que l\'IA va explorer, maximisant ainsi les chances d\'être cité dans la réponse finale.',
      deepDive: `## Query Fan-Out : comment les IA décomposent vos requêtes

### Le mécanisme RAG en détail

Quand un utilisateur pose une question complexe à Perplexity ou ChatGPT Search, le moteur ne cherche pas une seule page. Il :
1. **Décompose** la requête en 3-8 sous-requêtes thématiques
2. **Recherche** des sources pour chaque sous-requête
3. **Synthétise** une réponse en citant les meilleures sources par axe

### Exemple concret

Requête : "Comment optimiser mon site e-commerce pour le SEO en 2026 ?"

Fan-out probable :
- "optimisation technique SEO e-commerce" (architecture, Core Web Vitals)
- "stratégie de contenu SEO e-commerce" (fiches produits, blog)
- "maillage interne e-commerce" (catégories, liens contextuels)
- "SEO local e-commerce" (Google Business, avis)
- "tendances SEO 2026" (IA, GEO, AEO)

### Mesure du Fan-Out Score

Crawlers.fr calcule un **Fan-Out Score** (0-100) en croisant :
- Les mots-clés à fort volume (DataForSEO) liés au domaine
- La couverture effective de ces mots-clés dans le contenu de la page
- Les requêtes manquantes qui représentent des opportunités de contenu

### Impact sur la stratégie de contenu

Un Fan-Out Score faible signifie que votre page ne couvre qu'une fraction des axes que l'IA va explorer. Les recommandations incluent :
- Ajouter des sections H2 dédiées aux requêtes manquantes
- Créer des pages satellites pour les axes non couverts
- Renforcer le maillage interne entre les axes thématiques`,
      codeExample: {
        language: 'typescript',
        code: `// Calcul du Fan-Out Score sans appel LLM
// Utilise les keywords DataForSEO existants

interface FanOutResult {
  score: number;        // 0-100
  coveredAxes: number;
  totalAxes: number;
  missingKeywords: { keyword: string; volume: number }[];
}

function computeFanOutScore(
  pageContent: string,
  marketKeywords: { keyword: string; volume: number }[]
): FanOutResult {
  const contentLower = pageContent.toLowerCase();
  const axes = marketKeywords
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 15);

  let covered = 0;
  const missing: { keyword: string; volume: number }[] = [];

  for (const kw of axes) {
    const terms = kw.keyword.toLowerCase()
      .split(/\\s+/).filter(w => w.length > 2);
    const matchRatio = terms.filter(t => contentLower.includes(t)).length / terms.length;
    
    if (matchRatio >= 0.6) {
      covered++;
    } else {
      missing.push(kw);
    }
  }

  return {
    score: Math.round((covered / axes.length) * 100),
    coveredAxes: covered,
    totalAxes: axes.length,
    missingKeywords: missing.slice(0, 5)
  };
}`,
        description: 'Calcul déterministe du Fan-Out Score basé sur les données DataForSEO'
      },
      expertOpinion: 'Le Query Fan-Out est le concept le plus sous-estimé du GEO en 2026. Les pages qui couvrent 80%+ des axes de fan-out d\'une requête cible ont 4x plus de chances d\'être citées. C\'est la différence entre être une source parmi d\'autres et devenir LA référence que l\'IA synthétise.',
      relatedTerms: ['rag', 'aeo-answer-engine-optimization', 'quotability-index'],
      updatedAt: '2026-04-15'
    },
    {
      slug: 'chunkability-score',
      term: 'Chunkability Score',
      category: 'data-ai',
      microDefinition: 'Score évaluant la capacité d\'une page à être découpée par un moteur RAG.',
      fullDefinition: 'Le Chunkability Score (score de découpabilité) mesure de 0 à 100 la facilité avec laquelle un contenu web peut être segmenté en "chunks" (fragments) exploitables par les moteurs RAG (Retrieval-Augmented Generation). Un score élevé indique une structure claire avec des titres hiérarchiques, des paragraphes distincts et une table des matières — des signaux qui permettent aux IA de découper, indexer et restituer le contenu avec précision.',
      deepDive: `## Chunkability Score : structurer pour les IA

### Pourquoi la "découpabilité" compte

Les moteurs RAG (Perplexity, Bing Chat, Google SGE) ne lisent pas une page entière. Ils :
1. **Découpent** le contenu en fragments de 200-500 tokens
2. **Indexent** chaque chunk avec un embedding vectoriel
3. **Récupèrent** les chunks les plus pertinents pour une requête donnée
4. **Synthétisent** une réponse à partir des chunks sélectionnés

### Comment le score est calculé

Le Chunkability Score analyse 4 signaux structurels (sans appel LLM) :

| Signal | Poids | Mesure |
|--------|-------|--------|
| Titres H2/H3 | 30% | Nombre et hiérarchie des sous-titres |
| Paragraphes distincts | 25% | Ratio paragraphes / longueur totale |
| Table des matières | 25% | Présence d'un sommaire ou TOC |
| Longueur moyenne | 20% | Paragraphes de 100-300 mots (optimal) |

### Score et interprétation

- **80-100** : Excellent — contenu parfaitement structuré pour le RAG
- **50-79** : Correct — quelques améliorations structurelles possibles
- **0-49** : Faible — contenu monolithique, difficile à exploiter par les IA

### Optimisation

- Ajouter des H2 tous les 200-400 mots
- Inclure une table des matières (TOC) en début de page
- Découper les longs paragraphes (>150 mots) en sections distinctes
- Utiliser des listes à puces pour les énumérations
- Placer un résumé (TL;DR) en introduction`,
      codeExample: {
        language: 'typescript',
        code: `// Calcul déterministe du Chunkability Score
interface ChunkabilityResult {
  score: number;
  paragraphCount: number;
  headingCount: number;
  hasToc: boolean;
  avgParagraphLength: number;
}

function computeChunkabilityScore(html: string): ChunkabilityResult {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  
  // Compter les titres H2/H3
  const headings = doc.querySelectorAll('h2, h3');
  const headingCount = headings.length;
  
  // Compter les paragraphes
  const paragraphs = doc.querySelectorAll('p');
  const paraTexts = Array.from(paragraphs).map(p => p.textContent || '');
  const paragraphCount = paraTexts.filter(t => t.length > 50).length;
  
  // Longueur moyenne des paragraphes
  const avgLen = paraTexts.reduce((s, t) => s + t.split(' ').length, 0) 
    / Math.max(paragraphCount, 1);
  
  // Détection TOC
  const hasToc = !!doc.querySelector('nav, [class*="toc"], [id*="toc"]')
    || doc.querySelectorAll('a[href^="#"]').length >= 3;
  
  // Scoring
  let score = 0;
  score += Math.min(30, headingCount * 5);           // max 30
  score += Math.min(25, paragraphCount * 2.5);        // max 25
  score += hasToc ? 25 : 0;                           // max 25
  score += avgLen >= 30 && avgLen <= 100 ? 20 : 10;   // max 20
  
  return {
    score: Math.min(100, Math.round(score)),
    paragraphCount, headingCount, hasToc,
    avgParagraphLength: Math.round(avgLen)
  };
}`,
        description: 'Calcul du Chunkability Score basé sur l\'analyse DOM de la page'
      },
      expertOpinion: 'Le Chunkability Score est le pont entre le SEO technique et le GEO. En 2026, une page parfaitement optimisée pour Google mais monolithique (un seul bloc de texte) sera invisible pour les moteurs RAG. La structuration du contenu en chunks est devenue aussi importante que les balises title et meta description.',
      relatedTerms: ['rag', 'query-fan-out', 'dom-parsing'],
      updatedAt: '2026-04-15'
    },
  ],
  en: [], // English translations would go here
  es: [], // Spanish translations would go here
};

// Category metadata
export const expertCategories = {
  'anti-bot': {
    label: { fr: 'Anti-Bot', en: 'Anti-Bot', es: 'Anti-Bot' },
    color: 'from-red-500 to-orange-500',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    textColor: 'text-red-400',
  },
  'data-ai': {
    label: { fr: 'Données & IA', en: 'Data & AI', es: 'Datos & IA' },
    color: 'from-purple-500 to-pink-500',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    textColor: 'text-purple-400',
  },
  'architecture': {
    label: { fr: 'Architecture', en: 'Architecture', es: 'Arquitectura' },
    color: 'from-blue-500 to-cyan-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    textColor: 'text-blue-400',
  },
  'ethics': {
    label: { fr: 'Éthique & Perf', en: 'Ethics & Perf', es: 'Ética & Perf' },
    color: 'from-green-500 to-emerald-500',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
    textColor: 'text-green-400',
  },
};

export function getExpertTermBySlug(slug: string, language: string = 'fr'): ExpertTerm | undefined {
  const terms = expertTermsData[language] || expertTermsData.fr;
  return terms.find(term => term.slug === slug);
}

export function getExpertTermsByCategory(category: ExpertTerm['category'], language: string = 'fr'): ExpertTerm[] {
  const terms = expertTermsData[language] || expertTermsData.fr;
  return terms.filter(term => term.category === category);
}
