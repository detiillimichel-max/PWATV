# PWA TV — HLS Proxy

Cloudflare Worker used only for public HLS streams that cannot be consumed directly by the browser because of CORS restrictions.

## Endpoint

```text
https://SEU-WORKER.workers.dev/?url=URL_ENCODED_DO_M3U8
```

Example:

```text
https://SEU-WORKER.workers.dev/?url=https%3A%2F%2Fexample.com%2Flive%2Fplaylist.m3u8
```

## Deployment

1. Create a Cloudflare Worker named `pwa-tv-hls-proxy`.
2. Deploy `worker/src/index.js` as the Worker entry point.
3. Set `ALLOWED_ORIGIN` to `https://detiillimichel-max.github.io`.
4. Set `ALLOWED_HOSTS` to the upstream hostnames actually used by the PWA TV streams, separated by commas.
5. Do not deploy with an unrestricted host allowlist in production.
6. Test a known public stream that currently fails in the browser because of CORS.

## Important

The Worker rewrites HLS manifest URLs so nested playlists, segments and URI attributes can continue through the proxy. Directly playable channels should remain direct in the PWA; the proxy should be used only for streams that need it.

The Worker does not bypass DRM, authentication, paywalls or an offline stream.
