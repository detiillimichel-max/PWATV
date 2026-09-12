import { neon } from '@neondatabase/serverless';

const DEFAULT_RADIO_BROWSER_URL = 'https://de1.api.radio-browser.info/json/stations/topclick/20';
const DEFAULT_JAMENDO_URL = 'https://api.jamendo.com/v3.0/tracks/';
const CACHE_MINUTES = Math.max(5, Number(process.env.RADIO_CINEMA_CACHE_MINUTES || 1440));
const MAX_ITEMS = Math.max(1, Math.min(100, Number(process.env.RADIO_CINEMA_MAX_ITEMS || 20)));
const RATE_LIMIT_PERCENT = Math.max(1, Math.min(100, Number(process.env.RADIO_CINEMA_RATE_LIMIT_PERCENT || 25)));

let memoryCache = { expiresAt: 0, items: [] };

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Cache-Control', `public, s-maxage=${CACHE_MINUTES * 60}, stale-while-revalidate=3600`);
  res.setHeader('X-Radio-Cinema-Cache-Minutes', String(CACHE_MINUTES));
  res.setHeader('X-Radio-Cinema-Rate-Limit-Percent', String(RATE_LIMIT_PERCENT));

  if (memoryCache.expiresAt > Date.now() && memoryCache.items.length) {
    return res.status(200).json({ items: memoryCache.items, cached: true, source: 'memory' });
  }

  const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
  if (sql) {
    try {
      await sql(`CREATE TABLE IF NOT EXISTS radio_cinema_cache (cache_key TEXT PRIMARY KEY, items JSONB NOT NULL, fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
      const rows = await sql(`SELECT items, fetched_at FROM radio_cinema_cache WHERE cache_key = 'default' AND fetched_at > NOW() - ($1 * INTERVAL '1 minute')`, [CACHE_MINUTES]);
      if (rows.length && Array.isArray(rows[0].items)) {
        memoryCache = { expiresAt: Date.now() + CACHE_MINUTES * 60_000, items: rows[0].items.slice(0, MAX_ITEMS) };
        return res.status(200).json({ items: memoryCache.items, cached: true, source: 'neon' });
      }
    } catch (error) {
      console.error('Neon radio cache read failed:', error);
    }
  }

  const items = [];
  const radioBrowserUrl = process.env.RADIO_BROWSER_API_URL || DEFAULT_RADIO_BROWSER_URL;
  try {
    const response = await fetch(radioBrowserUrl, { headers: { Accept: 'application/json' } });
    if (response.ok) {
      const stations = await response.json();
      for (const station of stations.slice(0, MAX_ITEMS)) {
        const streamUrl = station.url_resolved || station.url;
        if (!streamUrl || !station.name) continue;
        items.push({
          id: `rb:${station.stationuuid || streamUrl}`,
          title: station.name,
          subtitle: [station.country, station.language].filter(Boolean).join(' · ') || 'Rádio ao vivo',
          streamUrl,
          homepage: station.homepage || '',
          favicon: station.favicon || '',
          source: 'radio-browser',
        });
      }
    }
  } catch (error) {
    console.error('Radio Browser request failed:', error);
  }

  const jamendoClientId = process.env.JAMENDO_CLIENT_ID;
  if (jamendoClientId && items.length < MAX_ITEMS) {
    try {
      const url = new URL(DEFAULT_JAMENDO_URL);
      url.searchParams.set('client_id', jamendoClientId);
      url.searchParams.set('format', 'json');
      url.searchParams.set('limit', String(Math.min(MAX_ITEMS - items.length, 10)));
      url.searchParams.set('order', 'popularity_total');
      url.searchParams.set('audioformat', 'mp31');
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (response.ok) {
        const data = await response.json();
        for (const track of data.results || []) {
          if (!track.audio || !track.name) continue;
          items.push({
            id: `jamendo:${track.id}`,
            title: track.name,
            subtitle: [track.artist_name, 'Jamendo'].filter(Boolean).join(' · '),
            streamUrl: track.audio,
            homepage: track.shareurl || '',
            favicon: '',
            source: 'jamendo',
          });
        }
      }
    } catch (error) {
      console.error('Jamendo request failed:', error);
    }
  }

  const unique = [...new Map(items.map(item => [item.streamUrl, item])).values()].slice(0, MAX_ITEMS);
  memoryCache = { expiresAt: Date.now() + CACHE_MINUTES * 60_000, items: unique };

  if (sql && unique.length) {
    try {
      await sql(`INSERT INTO radio_cinema_cache (cache_key, items, fetched_at) VALUES ('default', $1::jsonb, NOW()) ON CONFLICT (cache_key) DO UPDATE SET items = EXCLUDED.items, fetched_at = EXCLUDED.fetched_at`, [JSON.stringify(unique)]);
    } catch (error) {
      console.error('Neon radio cache write failed:', error);
    }
  }

  return res.status(200).json({ items: unique, cached: false, source: 'external' });
}
