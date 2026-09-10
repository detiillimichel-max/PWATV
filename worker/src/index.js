/**
 * PWA TV — Cloudflare Worker HLS proxy
 *
 * Purpose: proxy only the public HLS resources that need browser CORS
 * mediation. The PWA can continue using direct URLs for streams that
 * already work.
 *
 * Endpoint:
 *   GET /?url=<encoded-https-m3u8-url>
 *
 * Optional Cloudflare Worker environment variable:
 *   ALLOWED_HOSTS = comma-separated hostnames allowed as upstreams.
 *   If omitted, the Worker uses basic public-host validation only.
 *
 * Security notes:
 * - HTTPS upstreams only.
 * - Blocks localhost/private/link-local IP literals.
 * - Only GET/HEAD/OPTIONS are accepted.
 * - Does not accept arbitrary request bodies.
 * - CORS is limited to the PWA origin when configured with ALLOWED_ORIGIN.
 */

const DEFAULT_ALLOWED_ORIGIN = 'https://detiillimichel-max.github.io';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return json({ error: 'Method not allowed' }, 405, request, env);
    }

    const target = url.searchParams.get('url');
    if (!target) {
      return json({ error: 'Missing url parameter' }, 400, request, env);
    }

    let upstream;
    try {
      upstream = new URL(target);
    } catch {
      return json({ error: 'Invalid upstream URL' }, 400, request, env);
    }

    if (upstream.protocol !== 'https:') {
      return json({ error: 'Only HTTPS upstreams are allowed' }, 400, request, env);
    }

    if (isPrivateHost(upstream.hostname)) {
      return json({ error: 'Upstream host is not allowed' }, 403, request, env);
    }

    if (!isAllowedHost(upstream.hostname, env.ALLOWED_HOSTS)) {
      return json({ error: 'Upstream host is not in the allowlist' }, 403, request, env);
    }

    const upstreamResponse = await fetch(upstream.toString(), {
      method: request.method,
      headers: buildUpstreamHeaders(request),
      redirect: 'follow',
      cf: {
        cacheEverything: false,
      },
    });

    if (!upstreamResponse.ok) {
      return new Response(upstreamResponse.body, {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        headers: corsHeaders(request, env, upstreamResponse.headers),
      });
    }

    const contentType = upstreamResponse.headers.get('content-type') || '';
    const isManifest = isHlsManifest(upstream.pathname, contentType);

    if (!isManifest) {
      return new Response(upstreamResponse.body, {
        status: upstreamResponse.status,
        headers: corsHeaders(request, env, upstreamResponse.headers),
      });
    }

    const text = await upstreamResponse.text();
    const rewritten = rewriteManifest(text, upstream, url.origin);
    const headers = corsHeaders(request, env, upstreamResponse.headers);
    headers.set('content-type', contentType || 'application/vnd.apple.mpegurl');
    headers.delete('content-length');
    headers.set('cache-control', 'no-store');

    return new Response(rewritten, {
      status: upstreamResponse.status,
      headers,
    });
  },
};

function rewriteManifest(manifest, baseUrl, proxyOrigin) {
  return manifest
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        // URI attributes such as EXT-X-KEY and EXT-X-MAP can contain URLs.
        return rewriteUriAttributes(line, baseUrl, proxyOrigin);
      }

      try {
        const absolute = new URL(trimmed, baseUrl).toString();
        return `${proxyOrigin}/?url=${encodeURIComponent(absolute)}`;
      } catch {
        return line;
      }
    })
    .join('\n');
}

function rewriteUriAttributes(line, baseUrl, proxyOrigin) {
  return line.replace(/URI="([^"]+)"/gi, (_, value) => {
    try {
      const absolute = new URL(value, baseUrl).toString();
      return `URI="${proxyOrigin}/?url=${encodeURIComponent(absolute)}"`;
    } catch {
      return `URI="${value}"`;
    }
  });
}

function isHlsManifest(pathname, contentType) {
  return /\.m3u8?$/i.test(pathname) || /mpegurl|vnd\.apple\.mpegurl/i.test(contentType);
}

function buildUpstreamHeaders(request) {
  const headers = new Headers();
  const range = request.headers.get('range');
  if (range) headers.set('range', range);

  const userAgent = request.headers.get('user-agent');
  if (userAgent) headers.set('user-agent', userAgent);

  return headers;
}

function corsHeaders(request, env, sourceHeaders) {
  const headers = new Headers(sourceHeaders || undefined);
  const origin = request.headers.get('origin');
  const allowedOrigin = env.ALLOWED_ORIGIN || DEFAULT_ALLOWED_ORIGIN;

  if (origin === allowedOrigin) {
    headers.set('access-control-allow-origin', allowedOrigin);
  }

  headers.set('access-control-allow-methods', 'GET, HEAD, OPTIONS');
  headers.set('access-control-allow-headers', 'Range, Content-Type');
  headers.set('access-control-expose-headers', 'Content-Length, Content-Range, Accept-Ranges');
  headers.set('access-control-max-age', '86400');
  headers.set('vary', 'Origin');

  return headers;
}

function json(data, status, request, env) {
  const headers = corsHeaders(request, env);
  headers.set('content-type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(data), { status, headers });
}

function isAllowedHost(hostname, rawAllowlist) {
  // For safety, production should define ALLOWED_HOSTS in Cloudflare.
  // The fallback permits public hostnames only; private/link-local targets
  // remain blocked below.
  if (!rawAllowlist) return true;

  const hosts = rawAllowlist
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);

  const host = hostname.toLowerCase();
  return hosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

function isPrivateHost(hostname) {
  const host = hostname.toLowerCase();

  if (host === 'localhost' || host.endsWith('.localhost') || host === '127.0.0.1' || host === '::1') {
    return true;
  }

  // IPv4 literals: private, loopback, link-local, multicast/reserved.
  const parts = host.split('.').map(Number);
  if (parts.length === 4 && parts.every(Number.isInteger)) {
    const [a, b] = parts;
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a >= 224) return true;
  }

  return false;
}
