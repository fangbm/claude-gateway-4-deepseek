/**
 * claude-gateway-4-deepseek (cg4d)
 *
 * A Cloudflare Worker that:
 * 1. Serves a fake /v1/models list so Claude Desktop can start.
 * 2. Proxies /v1/messages to DeepSeek's anthropic-compatible endpoint.
 * 3. Reads the upstream API Key from the incoming Authorization header
 *    (no hard-coded key in the script).
 */

export interface Env {
  // Optional: bind a KV namespace if you want local-key → real-key mapping
  // API_KEY_MAP?: KVNamespace;
}

const ALLOWED_ORIGINS = ['*']; // tighten in production if needed

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, anthropic-version, Accept',
    'Access-Control-Max-Age': '86400',
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    const url = new URL(request.url);
    const headers = corsHeaders(request);
    headers['Content-Type'] = 'application/json';

    // ── 1. Fake model list ──────────────────────────────────────────────
    if (url.pathname === '/v1/models' && request.method === 'GET') {
      return new Response(
        JSON.stringify({
          data: [
            { id: 'deepseek-v4-pro', type: 'model', object: 'model' },
            { id: 'deepseek-v4-flash', type: 'model', object: 'model' },
          ],
          object: 'list',
        }),
        { status: 200, headers }
      );
    }

    // ── 2. Proxy /v1/messages to DeepSeek ───────────────────────────────
    if (url.pathname === '/v1/messages' && request.method === 'POST') {
      const auth = request.headers.get('Authorization');
      if (!auth || !auth.startsWith('Bearer ')) {
        return new Response(
          JSON.stringify({
            type: 'error',
            error: {
              type: 'authentication_error',
              message: 'Missing or invalid Authorization header. Expected: Bearer sk-...',
            },
          }),
          { status: 401, headers }
        );
      }

      // Optional KV mapping: local fake key → real DeepSeek key
      // let apiKey = auth.replace('Bearer ', '');
      // if (env.API_KEY_MAP) {
      //   const mapped = await env.API_KEY_MAP.get(apiKey);
      //   if (mapped) apiKey = mapped;
      // }
      // const upstreamAuth = `Bearer ${apiKey}`;
      const upstreamAuth = auth;

      const upstreamHeaders: Record<string, string> = {
        Authorization: upstreamAuth,
        'Content-Type': request.headers.get('content-type') || 'application/json',
        Accept: request.headers.get('accept') || 'application/json',
        'anthropic-version': request.headers.get('anthropic-version') || '2023-06-01',
      };

      // Forward x-api-key if present (some clients use both)
      const xApiKey = request.headers.get('x-api-key');
      if (xApiKey) upstreamHeaders['x-api-key'] = xApiKey;

      try {
        const upstream = await fetch('https://api.deepseek.com/anthropic/v1/messages', {
          method: 'POST',
          headers: upstreamHeaders,
          body: await request.text(),
        });

        // Pass through content-type so SSE streams work
        const respHeaders: Record<string, string> = {
          ...headers,
          'Content-Type': upstream.headers.get('content-type') || 'application/json',
          'Cache-Control': 'no-cache',
        };

        // Drop content-encoding to avoid double-compression issues in Workers
        // (fetch already decompresses; we re-stream raw)
        return new Response(upstream.body, {
          status: upstream.status,
          headers: respHeaders,
        });
      } catch (err: any) {
        return new Response(
          JSON.stringify({
            type: 'error',
            error: {
              type: 'api_error',
              message: err.message || 'Upstream request failed',
            },
          }),
          { status: 502, headers }
        );
      }
    }

    // ── 404 ─────────────────────────────────────────────────────────────
    return new Response(
      JSON.stringify({ type: 'error', error: { type: 'not_found_error', message: 'Not found' } }),
      { status: 404, headers }
    );
  },
};
