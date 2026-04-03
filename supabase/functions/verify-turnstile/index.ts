import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

Deno.serve(handleRequest(async (req) => {
  try {
    const { token } = await req.json();

    if (!token) {
      return jsonError('Error', 400);
    }

    // Fail open if Turnstile was unavailable client-side
    if (token === 'TURNSTILE_UNAVAILABLE') {
      return jsonOk({ success: true });
    }

    const secretKey = Deno.env.get('TURNSTILE_SECRET_KEY');
    if (!secretKey) {
      // If secret not configured, fail open
      return jsonOk({ success: true });
    }

    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', token);

    const result = await fetch('https://challenges.cloudflare.com/turnstile/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });

    const outcome = await result.json();

    return jsonOk({ success: outcome.success });
  } catch (_error) {
    // Fail open on unexpected errors
    return jsonOk({ success: true });
  }
}));