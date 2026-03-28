/**
 * Image Generation Module — Multi-provider routing
 * 
 * Providers:
 *   - imagen3: Google Imagen 3 via Lovable AI Gateway (photo-réaliste)
 *   - flux:    Black Forest Labs FLUX (artistique, illustration)
 *   - ideogram: Ideogram (typographie, logos, texte sur image)
 * 
 * Usage:
 *   import { generateImage, ImageStyle } from '../_shared/imageGeneration.ts';
 */

export type ImageStyle = 'photo' | 'artistic' | 'typography';
export type ImageProvider = 'imagen3' | 'flux' | 'ideogram';

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
}

export interface ImageGenerationResult {
  provider: ImageProvider;
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
  switch (style) {
    case 'photo': return 'imagen3';
    case 'artistic': return 'flux';
    case 'typography': return 'ideogram';
    default: return 'imagen3';
  }
}

// ─── Imagen 3 (via Lovable AI Gateway) ───────────────────────────

async function generateImagen3(req: ImageGenerationRequest): Promise<ImageGenerationResult> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) throw new Error('LOVABLE_API_KEY not configured');

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-3-pro-image-preview',
      messages: [
        {
          role: 'user',
          content: `Generate a photorealistic image: ${req.prompt}`,
        },
      ],
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

  // Parse data URI → base64
  const match = imageData.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) throw new Error('Imagen3: unexpected image format');

  return {
    provider: 'imagen3',
    imageBase64: match[2],
    mimeType: match[1],
    dataUri: imageData,
  };
}

// ─── Black Forest Labs FLUX ──────────────────────────────────────

async function generateFlux(req: ImageGenerationRequest): Promise<ImageGenerationResult> {
  const apiKey = Deno.env.get('BFL_API_KEY');
  if (!apiKey) throw new Error('BFL_API_KEY not configured');

  // Step 1: Submit generation request
  const submitResponse = await fetch('https://api.bfl.ml/v1/flux-pro-1.1', {
    method: 'POST',
    headers: {
      'X-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: req.prompt,
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

  // Step 2: Poll for result (max 120s)
  const maxAttempts = 60;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 2000));

    const pollResponse = await fetch(`https://api.bfl.ml/v1/get_result?id=${taskId}`, {
      headers: { 'X-Key': apiKey },
    });

    if (!pollResponse.ok) continue;

    const result = await pollResponse.json();

    if (result.status === 'Ready' && result.result?.sample) {
      // FLUX returns a URL — fetch and convert to base64
      const imgResponse = await fetch(result.result.sample);
      const imgBuffer = await imgResponse.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(imgBuffer)));
      const mimeType = imgResponse.headers.get('content-type') || 'image/jpeg';

      return {
        provider: 'flux',
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
  if (!apiKey) throw new Error('IDEOGRAM_API_KEY not configured — module prêt, clé requise');

  const response = await fetch('https://api.ideogram.ai/generate', {
    method: 'POST',
    headers: {
      'Api-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image_request: {
        prompt: req.prompt,
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

  // Fetch image and convert to base64
  const imgResponse = await fetch(imageUrl);
  const imgBuffer = await imgResponse.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(imgBuffer)));
  const mimeType = imgResponse.headers.get('content-type') || 'image/png';

  return {
    provider: 'ideogram',
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
  const provider = resolveProvider(req.style, req.provider);
  const handler = PROVIDER_MAP[provider];

  console.log(`[imageGen] Routing style="${req.style}" → provider="${provider}"`);

  const startMs = Date.now();
  const result = await handler(req);
  const durationMs = Date.now() - startMs;

  console.log(`[imageGen] ${provider} completed in ${durationMs}ms, image size: ${Math.round(result.imageBase64.length / 1024)}KB`);

  return result;
}

/** Check which providers are available based on configured secrets */
export function getAvailableProviders(): { provider: ImageProvider; available: boolean; style: ImageStyle }[] {
  return [
    { provider: 'imagen3', available: !!Deno.env.get('LOVABLE_API_KEY'), style: 'photo' },
    { provider: 'flux', available: !!Deno.env.get('BFL_API_KEY'), style: 'artistic' },
    { provider: 'ideogram', available: !!Deno.env.get('IDEOGRAM_API_KEY'), style: 'typography' },
  ];
}
