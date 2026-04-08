/**
 * Image Generation Module — Multi-provider routing with 12 styles
 * 
 * Providers:
 *   - imagen3: Google Imagen 3 via Lovable AI Gateway (photo-réaliste, cinématique)
 *   - flux:    Black Forest Labs FLUX (artistique, illustration, sketch, etc.)
 *   - ideogram: Ideogram (typographie, logos, noir & blanc, peinture classique)
 */

export type ImageStyle =
  | 'photo'           // Photo réaliste → imagen3
  | 'cinematic'       // Cinématique → imagen3
  | 'flat'            // Illustration flat → flux
  | 'watercolor'      // Aquarelle → flux
  | 'isometric'       // Isométrique 3D → flux
  | 'sketch'          // Croquis / Sketch → flux
  | 'popart'          // Pop Art → flux
  | 'vintage'         // Vintage / Rétro → flux
  | 'typography'      // Typographique → ideogram
  | 'infographic'     // Infographie → ideogram
  | 'bw_photo'        // Noir & Blanc → ideogram
  | 'classic_painting'; // Peinture classique (gouache, huile, fauvisme) → ideogram

export type ImageProvider = 'imagen3' | 'flux' | 'ideogram';

export interface ImageStyleConfig {
  key: ImageStyle;
  label: string;
  emoji: string;
  provider: ImageProvider;
  promptPrefix: string;
  /** Which page types this style suits best */
  suitableFor: string[];
  /** Which sectors this style suits best (from identity card) */
  suitableSectors: string[];
}

export const IMAGE_STYLES: ImageStyleConfig[] = [
  {
    key: 'photo', label: 'Photo réaliste', emoji: '📸', provider: 'imagen3',
    promptPrefix: 'Generate a photorealistic high-quality photograph:',
    suitableFor: ['product', 'landing', 'homepage'],
    suitableSectors: ['ecommerce', 'immobilier', 'tourisme', 'restauration', 'mode'],
  },
  {
    key: 'cinematic', label: 'Cinématique', emoji: '🌙', provider: 'imagen3',
    promptPrefix: 'Generate a cinematic image with dramatic lighting, shallow depth of field, and film-like color grading:',
    suitableFor: ['landing', 'homepage', 'article'],
    suitableSectors: ['luxe', 'mode', 'culture', 'entertainment', 'tourisme'],
  },
  {
    key: 'flat', label: 'Illustration flat', emoji: '🎨', provider: 'flux',
    promptPrefix: 'Create a flat design vector-style illustration with clean shapes and bold colors:',
    suitableFor: ['article', 'landing', 'faq'],
    suitableSectors: ['tech', 'saas', 'startup', 'education', 'finance'],
  },
  {
    key: 'watercolor', label: 'Aquarelle', emoji: '🖌️', provider: 'flux',
    promptPrefix: 'Create a watercolor painting with soft textures, flowing colors and artistic brush strokes:',
    suitableFor: ['article', 'landing'],
    suitableSectors: ['art', 'bien-etre', 'nature', 'education', 'culture'],
  },
  {
    key: 'isometric', label: 'Isométrique 3D', emoji: '🏗️', provider: 'flux',
    promptPrefix: 'Create an isometric 3D illustration with stylized objects and clean perspective:',
    suitableFor: ['landing', 'article', 'product'],
    suitableSectors: ['tech', 'saas', 'immobilier', 'industrie', 'logistique'],
  },
  {
    key: 'sketch', label: 'Croquis / Sketch', emoji: '✏️', provider: 'flux',
    promptPrefix: 'Create a pencil sketch drawing with elegant hand-drawn lines and subtle shading:',
    suitableFor: ['article', 'faq'],
    suitableSectors: ['architecture', 'design', 'education', 'artisanat'],
  },
  {
    key: 'popart', label: 'Pop Art', emoji: '🌈', provider: 'flux',
    promptPrefix: 'Create a pop art style image with vivid colors, bold outlines, Ben-Day dots and Warhol-inspired aesthetic:',
    suitableFor: ['landing', 'article'],
    suitableSectors: ['culture', 'entertainment', 'mode', 'media'],
  },
  {
    key: 'vintage', label: 'Vintage / Rétro', emoji: '🪵', provider: 'flux',
    promptPrefix: 'Create a vintage retro style image with sepia tones, film grain, and 1970s aesthetic:',
    suitableFor: ['article', 'landing'],
    suitableSectors: ['artisanat', 'restauration', 'culture', 'mode', 'tourisme'],
  },
  {
    key: 'typography', label: 'Typographique', emoji: '🔤', provider: 'ideogram',
    promptPrefix: 'Create a typographic design with beautiful integrated text, poster-style layout:',
    suitableFor: ['landing', 'homepage', 'category'],
    suitableSectors: ['marketing', 'media', 'education', 'saas'],
  },
  {
    key: 'infographic', label: 'Infographie', emoji: '📊', provider: 'ideogram',
    promptPrefix: 'Create a clean infographic with visual data representation, icons and structured layout:',
    suitableFor: ['article', 'faq', 'landing'],
    suitableSectors: ['finance', 'sante', 'tech', 'education', 'b2b'],
  },
  {
    key: 'bw_photo', label: 'Noir & Blanc', emoji: '⚫', provider: 'ideogram',
    promptPrefix: 'Create a stunning black and white photograph with dramatic contrast, rich tones and artistic composition:',
    suitableFor: ['article', 'landing', 'homepage'],
    suitableSectors: ['luxe', 'architecture', 'art', 'mode', 'culture'],
  },
  {
    key: 'classic_painting', label: 'Peinture classique', emoji: '🖼️', provider: 'ideogram',
    promptPrefix: 'Create an oil painting in classical art style, inspired by fauvism with bold brushstrokes, vivid gouache-like colors and vintage poster aesthetic:',
    suitableFor: ['article', 'landing'],
    suitableSectors: ['art', 'culture', 'tourisme', 'restauration', 'luxe', 'vin'],
  },
];

export function getStyleConfig(styleKey: ImageStyle): ImageStyleConfig {
  return IMAGE_STYLES.find(s => s.key === styleKey) || IMAGE_STYLES[0];
}

/**
 * Anti-text guard: appended to all prompts unless allowText is true.
 * Prevents models from rendering titles, labels or watermarks on images.
 */
const NO_TEXT_GUARD = ' Do NOT include any text, title, label, watermark, caption, heading or lettering in the image. The image must be purely visual with zero written words.';

export interface ImageGenerationRequest {
  prompt: string;
  style: ImageStyle;
  /** Override auto-routing */
  provider?: ImageProvider;
  /** Image dimensions */
  width?: number;
  height?: number;
  /** Aspect ratio for providers that support it */
  aspectRatio?: string;
  /** Negative prompt (FLUX) */
  negativePrompt?: string;
  /** Reference image URL for inspiration/edit mode */
  referenceImageUrl?: string;
  /** 'inspiration' = use as visual context, 'edit' = transform the reference */
  referenceMode?: 'inspiration' | 'edit';
  /** Allow text in the generated image (default false). Set true only when user explicitly requests text. */
  allowText?: boolean;
}

/** Build the final prompt with optional no-text guard */
function buildSafePrompt(prefix: string, userPrompt: string, allowText?: boolean): string {
  const base = `${prefix} ${userPrompt}`;
  return allowText ? base : base + NO_TEXT_GUARD;
}

export interface ImageGenerationResult {
  provider: ImageProvider;
  style: ImageStyle;
  /** base64-encoded image data (without data URI prefix) */
  imageBase64: string;
  /** MIME type */
  mimeType: string;
  /** Full data URI for direct display */
  dataUri: string;
  /** Provider-specific metadata */
  metadata?: Record<string, unknown>;
}

/** Route style → provider */
export function resolveProvider(style: ImageStyle, override?: ImageProvider): ImageProvider {
  if (override) return override;
  const config = getStyleConfig(style);
  return config.provider;
}

// ─── Imagen 3 (via Lovable AI Gateway) ───────────────────────────

async function generateImagen3(req: ImageGenerationRequest): Promise<ImageGenerationResult> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) throw new Error('LOVABLE_API_KEY not configured');

  const styleConfig = getStyleConfig(req.style);

  // Build message content — multimodal if reference image provided
  let content: any;
  if (req.referenceImageUrl) {
    const textInstruction = req.referenceMode === 'edit'
      ? `Transform this image with the following style and instructions. Style: ${styleConfig.promptPrefix} Instructions: ${req.prompt}`
      : `Use this image as visual inspiration (style, composition, mood) to create a NEW original image. Style: ${styleConfig.promptPrefix} Instructions: ${req.prompt}`;
    content = [
      { type: 'text', text: textInstruction },
      { type: 'image_url', image_url: { url: req.referenceImageUrl } },
    ];
  } else {
    content = buildSafePrompt(styleConfig.promptPrefix, req.prompt, req.allowText);
  }

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-3-pro-image-preview',
      messages: [{ role: 'user', content }],
      modalities: ['image', 'text'],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('[imageGen:imagen3] Error:', response.status, errText.slice(0, 200));
    throw new Error(`Imagen3 error: ${response.status}`);
  }

  const data = await response.json();
  const imageData = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

  if (!imageData) {
    throw new Error('Imagen3: no image in response');
  }

  const match = imageData.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) throw new Error('Imagen3: unexpected image format');

  return {
    provider: 'imagen3',
    style: req.style,
    imageBase64: match[2],
    mimeType: match[1],
    dataUri: imageData,
  };
}

// ─── Black Forest Labs FLUX ──────────────────────────────────────

async function generateFlux(req: ImageGenerationRequest): Promise<ImageGenerationResult> {
  const apiKey = Deno.env.get('BFL_API_KEY');
  if (!apiKey) throw new Error('BFL_API_KEY not configured');

  const styleConfig = getStyleConfig(req.style);

  const submitResponse = await fetch('https://api.bfl.ml/v1/flux-pro-1.1', {
    method: 'POST',
    headers: {
      'X-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: buildSafePrompt(styleConfig.promptPrefix, req.prompt, req.allowText),
      width: req.width || 1024,
      height: req.height || 1024,
      ...(req.negativePrompt ? { negative_prompt: req.negativePrompt } : {}),
    }),
  });

  if (!submitResponse.ok) {
    const errText = await submitResponse.text();
    console.error('[imageGen:flux] Submit error:', submitResponse.status, errText.slice(0, 200));
    throw new Error(`FLUX submit error: ${submitResponse.status}`);
  }

  const { id: taskId } = await submitResponse.json();
  if (!taskId) throw new Error('FLUX: no task ID returned');

  const maxAttempts = 60;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 2000));

    const pollResponse = await fetch(`https://api.bfl.ml/v1/get_result?id=${taskId}`, {
      headers: { 'X-Key': apiKey },
    });

    if (!pollResponse.ok) continue;

    const result = await pollResponse.json();

    if (result.status === 'Ready' && result.result?.sample) {
      const imgResponse = await fetch(result.result.sample);
      const imgBuffer = await imgResponse.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(imgBuffer)));
      const mimeType = imgResponse.headers.get('content-type') || 'image/jpeg';

      return {
        provider: 'flux',
        style: req.style,
        imageBase64: base64,
        mimeType,
        dataUri: `data:${mimeType};base64,${base64}`,
        metadata: { taskId, seed: result.result.seed },
      };
    }

    if (result.status === 'Error') {
      throw new Error(`FLUX generation failed: ${result.error || 'unknown'}`);
    }
  }

  throw new Error('FLUX: generation timed out after 120s');
}

// ─── Ideogram ────────────────────────────────────────────────────

async function generateIdeogram(req: ImageGenerationRequest): Promise<ImageGenerationResult> {
  const apiKey = Deno.env.get('IDEOGRAM_API_KEY');
  if (!apiKey) throw new Error('IDEOGRAM_API_KEY not configured');

  const styleConfig = getStyleConfig(req.style);

  const response = await fetch('https://api.ideogram.ai/generate', {
    method: 'POST',
    headers: {
      'Api-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image_request: {
        prompt: buildSafePrompt(styleConfig.promptPrefix, req.prompt, req.allowText),
        model: 'V_2',
        aspect_ratio: req.aspectRatio || 'ASPECT_1_1',
        magic_prompt_option: 'AUTO',
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('[imageGen:ideogram] Error:', response.status, errText.slice(0, 200));
    throw new Error(`Ideogram error: ${response.status}`);
  }

  const data = await response.json();
  const imageUrl = data.data?.[0]?.url;

  if (!imageUrl) {
    throw new Error('Ideogram: no image URL in response');
  }

  const imgResponse = await fetch(imageUrl);
  const imgBuffer = await imgResponse.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(imgBuffer)));
  const mimeType = imgResponse.headers.get('content-type') || 'image/png';

  return {
    provider: 'ideogram',
    style: req.style,
    imageBase64: base64,
    mimeType,
    dataUri: `data:${mimeType};base64,${base64}`,
    metadata: { resolution: data.data?.[0]?.resolution },
  };
}

// ─── Main Router ─────────────────────────────────────────────────

const PROVIDER_MAP: Record<ImageProvider, (req: ImageGenerationRequest) => Promise<ImageGenerationResult>> = {
  imagen3: generateImagen3,
  flux: generateFlux,
  ideogram: generateIdeogram,
};

export async function generateImage(req: ImageGenerationRequest): Promise<ImageGenerationResult> {
  let provider = resolveProvider(req.style, req.provider);

  // If reference image is provided, force Imagen3 (Gemini) since it supports multimodal
  if (req.referenceImageUrl && provider !== 'imagen3') {
    console.log(`[imageGen] Reference image provided, rerouting ${provider} → imagen3 for multimodal support`);
    provider = 'imagen3';
  }

  const handler = PROVIDER_MAP[provider];

  console.log(`[imageGen] Routing style="${req.style}" → provider="${provider}"${req.referenceImageUrl ? ` (with reference, mode=${req.referenceMode})` : ''}`);

  const startMs = Date.now();
  const result = await handler(req);
  const durationMs = Date.now() - startMs;

  console.log(`[imageGen] ${provider} completed in ${durationMs}ms, image size: ${Math.round(result.imageBase64.length / 1024)}KB`);

  return result;
}

/** Check which providers are available based on configured secrets */
export function getAvailableProviders(): { provider: ImageProvider; available: boolean }[] {
  return [
    { provider: 'imagen3', available: !!Deno.env.get('LOVABLE_API_KEY') },
    { provider: 'flux', available: !!Deno.env.get('BFL_API_KEY') },
    { provider: 'ideogram', available: !!Deno.env.get('IDEOGRAM_API_KEY') },
  ];
}

/** Suggest 3 styles based on page type, sector, and user history */
export function suggestStyles(
  pageType: string,
  sector: string | null,
  userHistory: { style_key: string; usage_count: number }[] = [],
): ImageStyle[] {
  const normalizedSector = (sector || '').toLowerCase();
  const normalizedPageType = (pageType || 'article').toLowerCase();

  // Score each style
  const scored = IMAGE_STYLES.map(style => {
    let score = 0;
    // Page type match
    if (style.suitableFor.includes(normalizedPageType)) score += 3;
    // Sector match
    if (normalizedSector && style.suitableSectors.some(s => normalizedSector.includes(s))) score += 2;
    // Usage history bonus
    const history = userHistory.find(h => h.style_key === style.key);
    if (history) score += Math.min(5, history.usage_count);
    return { style: style.key, score };
  });

  // Sort by score desc, take top 3
  scored.sort((a, b) => b.score - a.score);

  // Always include the user's most-used style if they have history
  const suggestions = scored.slice(0, 3).map(s => s.style);

  if (userHistory.length > 0) {
    const topUsed = userHistory.sort((a, b) => b.usage_count - a.usage_count)[0];
    if (topUsed && !suggestions.includes(topUsed.style_key as ImageStyle)) {
      suggestions[2] = topUsed.style_key as ImageStyle;
    }
  }

  return suggestions;
}
