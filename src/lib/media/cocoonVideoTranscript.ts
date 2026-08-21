/**
 * Transcription de la démonstration vidéo du module Cocoon.
 *
 * La vidéo est une capture d'écran sans piste audio : la transcription décrit
 * ce qui est montré, horodaté sur les mêmes bornes que les pistes WebVTT
 * (`public/media/cocoon-3d.{fr,en,es}.vtt`). Elle est rendue en HTML sous le
 * lecteur — c'est ce texte que Google et les moteurs génératifs indexent, le
 * contenu visuel n'étant pas compris par les crawlers.
 */

export interface TranscriptSegment {
  /** Horodatage affiché, aligné sur les cues WebVTT. */
  time: string;
  text: string;
}

export type TranscriptLang = 'fr' | 'en' | 'es';

export const COCOON_VIDEO_TRANSCRIPT: Record<TranscriptLang, TranscriptSegment[]> = {
  fr: [
    { time: '00:00', text: 'Vue 3D du cocon sémantique : chaque nœud est une page du site, chaque arête un lien interne pondéré par similarité cosinus.' },
    { time: '00:12', text: 'Le code couleur des nœuds reprend le type de page : pilier, satellite, catégorie, conversion ou page technique. Ce code est identique à celui de la vue radiale.' },
    { time: '00:24', text: 'La taille du nœud dépend du trafic organique de la page ; la pulsation traduit son évolution récente dans Search Console.' },
    { time: '00:36', text: 'En rotation, les clusters thématiques apparaissent naturellement : la distance entre deux nœuds reflète leur distance sémantique, pas leur profondeur de clic.' },
    { time: '00:48', text: "Sélection d'un nœud : le panneau latéral affiche l'intention de la page (Know, Do, Buy), ses liens entrants et sortants, et son ROI annualisé prédit à partir du CPC et du volume." },
    { time: '01:00', text: 'Les paires en cannibalisation sont mises en évidence : deux pages ciblant la même intention se substituent en SERP. Tant que le conflit est ouvert, le moteur bloque les suggestions de maillage sur ces pages.' },
    { time: '01:12', text: 'Le mode X-Ray isole le flux de link juice : en or les liens descendants du pilier vers les satellites, en violet les liens de remontée vers le pilier.' },
    { time: '01:26', text: "Les prescriptions de maillage se déploient ensuite en un clic vers le CMS connecté, avec l'ancre sémantique de 2 à 5 mots proposée par le moteur — un seul lien par page source vers une même destination." },
  ],
  en: [
    { time: '00:00', text: '3D view of the semantic cocoon: each node is a page, each edge an internal link weighted by cosine similarity.' },
    { time: '00:12', text: 'Node colours match the page type: pillar, satellite, category, conversion or technical page — the same colour code as the radial view.' },
    { time: '00:24', text: "Node size reflects the page's organic traffic; the pulse shows its recent Search Console trend." },
    { time: '00:36', text: 'As the graph rotates, thematic clusters emerge: the distance between two nodes reflects semantic distance, not click depth.' },
    { time: '00:48', text: 'Selecting a node: the side panel shows page intent (Know, Do, Buy), inbound and outbound links, and annualised ROI predicted from CPC and search volume.' },
    { time: '01:00', text: 'Cannibalising pairs are highlighted: two pages targeting one intent replace each other in the SERP. While the conflict is open, the engine blocks linking suggestions on those pages.' },
    { time: '01:12', text: 'X-Ray mode isolates link juice flow: gold for links descending from the pillar to satellites, purple for links back to the pillar.' },
    { time: '01:26', text: 'Linking prescriptions then deploy in one click to the connected CMS, with the 2-to-5-word semantic anchor suggested by the engine — one link per source page to any given destination.' },
  ],
  es: [
    { time: '00:00', text: 'Vista 3D del cocoon semántico: cada nodo es una página y cada arista un enlace interno ponderado por similitud cosenoidal.' },
    { time: '00:12', text: 'El color de los nodos corresponde al tipo de página: pilar, satélite, categoría, conversión o página técnica, igual que en la vista radial.' },
    { time: '00:24', text: 'El tamaño del nodo depende del tráfico orgánico; la pulsación refleja su evolución reciente en Search Console.' },
    { time: '00:36', text: 'Al rotar el grafo aparecen los clústeres temáticos: la distancia entre nodos refleja la distancia semántica, no la profundidad de clic.' },
    { time: '00:48', text: 'Al seleccionar un nodo, el panel muestra la intención de la página (Know, Do, Buy), sus enlaces entrantes y salientes y su ROI anualizado previsto.' },
    { time: '01:00', text: 'Se resaltan los pares canibalizados: dos páginas con la misma intención se sustituyen en la SERP. Mientras el conflicto siga abierto, el motor bloquea las sugerencias de enlazado.' },
    { time: '01:12', text: 'El modo X-Ray aísla el flujo de link juice: en oro los enlaces descendentes del pilar a los satélites, en violeta los de retorno al pilar.' },
    { time: '01:26', text: 'Las prescripciones de enlazado se despliegan en un clic al CMS conectado, con el ancla semántica de 2 a 5 palabras sugerida por el motor.' },
  ],
};

/** Transcription à plat (FR) pour la propriété `transcript` du VideoObject. */
export const COCOON_VIDEO_TRANSCRIPT_TEXT = COCOON_VIDEO_TRANSCRIPT.fr
  .map((segment) => `${segment.time} — ${segment.text}`)
  .join(' ');
