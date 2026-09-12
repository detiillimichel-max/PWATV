const DEFAULTS = {
  channels: 'https://iptv-org.github.io/api/channels.json',
  streams: 'https://iptv-org.github.io/api/streams.json',
  countries: 'https://iptv-org.github.io/api/countries.json',
  categories: 'https://iptv-org.github.io/api/categories.json',
};

let cache = { expiresAt: 0, payload: null };
const CACHE_SECONDS = 900;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Cache-Control', `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=3600`);
  if (cache.payload && cache.expiresAt > Date.now()) {
    return res.status(200).json({ ...cache.payload, cached: true });
  }

  const urls = {
    channels: process.env.CHANNELS_SOURCE_URL || DEFAULTS.channels,
    streams: process.env.STREAMS_SOURCE_URL || DEFAULTS.streams,
    countries: process.env.COUNTRIES_SOURCE_URL || DEFAULTS.countries,
    categories: process.env.CATEGORIES_SOURCE_URL || DEFAULTS.categories,
  };

  try {
    const responses = await Promise.all(Object.values(urls).map(url => fetch(url, { headers: { Accept: 'application/json' } })));
    if (responses.some(response => !response.ok)) throw new Error('One or more IPTV sources failed');
    const [channelsRaw, streamsRaw, countriesRaw, categoriesRaw] = await Promise.all(responses.map(response => response.json()));

    const streamMap = new Map();
    for (const stream of streamsRaw) {
      if (!stream.channel || !stream.url) continue;
      const list = streamMap.get(stream.channel) || [];
      if (!list.some(item => item.url === stream.url)) list.push({ url: stream.url, ref: stream.ref || '', title: stream.title || '' });
      streamMap.set(stream.channel, list);
    }

    const channels = channelsRaw
      .filter(channel => channel.id && channel.name && streamMap.has(channel.id))
      .map(channel => ({
        id: channel.id,
        name: channel.name,
        logo: channel.logo || '',
        country: channel.country || '',
        categories: Array.isArray(channel.categories) ? channel.categories : [],
        description: channel.description || '',
        streams: streamMap.get(channel.id) || [],
      }));

    const payload = {
      channels,
      countries: countriesRaw,
      categories: categoriesRaw,
      generatedAt: new Date().toISOString(),
      source: 'iptv-org',
    };
    cache = { expiresAt: Date.now() + CACHE_SECONDS * 1000, payload };
    return res.status(200).json({ ...payload, cached: false });
  } catch (error) {
    console.error('Channels API failed:', error);
    if (cache.payload) return res.status(200).json({ ...cache.payload, cached: true, stale: true });
    return res.status(502).json({ error: 'Unable to load channel catalog' });
  }
}
