/* ================================================================
   IPTV LIVE — app.js
   Fonte de dados: API pública e aberta do projeto iptv-org
   (github.com/iptv-org/api) — listas de canais e streams .m3u8
   mantidas pela comunidade, sem necessidade de chave de API.
   ================================================================ */

const API = {
  channels: 'https://iptv-org.github.io/api/channels.json',
  streams: 'https://iptv-org.github.io/api/streams.json',
  countries: 'https://iptv-org.github.io/api/countries.json',
  categories: 'https://iptv-org.github.io/api/categories.json',
};

const FAV_KEY = 'iptv_live_favorites';
const HISTORY_KEY = 'iptv_live_watch_history';
const HISTORY_LIMIT = 60;
const FEATURED_LIMIT = 12;
const ROW_LIMIT = 40; // limite de canais exibidos por carrossel (performance mobile)
const GENRE_ORDER = ['Notícias', 'Esportes', 'Filmes', 'Infantil', 'Entretenimento', 'Documentários', 'Música', 'Geral'];
const GENRE_RULES = [
  { label: 'Notícias', terms: ['news', 'noticia', 'notícias', 'noticias', 'jornal', 'informação', 'informacao', 'business', 'finance', 'weather'] },
  { label: 'Esportes', terms: ['sport', 'esporte', 'esportes', 'futebol', 'football', 'soccer', 'basket', 'tennis', 'golf', 'motorsport', 'corrida'] },
  { label: 'Filmes', terms: ['movie', 'movies', 'filme', 'filmes', 'cinema', 'film', 'action', 'western', 'thriller', 'drama'] },
  { label: 'Infantil', terms: ['kids', 'kid', 'children', 'child', 'infantil', 'cartoon', 'animation', 'anime', 'junior', 'baby'] },
  { label: 'Documentários', terms: ['documentary', 'documentario', 'documentário', 'science', 'ciência', 'ciencia', 'history', 'historia', 'história', 'nature'] },
  { label: 'Música', terms: ['music', 'musica', 'música', 'radio', 'dance', 'hits', 'mtv'] },
  { label: 'Entretenimento', terms: ['entertainment', 'entretenimento', 'reality', 'series', 'série', 'serie', 'comedy', 'comedia', 'comédia', 'lifestyle'] },
];

/* ---------------------------------------------------------------
   ESTADO
   --------------------------------------------------------------- */
const state = {
  channels: [],       // canais já cruzados com sua stream principal
  countries: {},       // code -> nome
  categories: {},       // id -> nome
  favorites: new Set(JSON.parse(localStorage.getItem(FAV_KEY) || '[]')),
  history: loadWatchHistory(),
  filters: { search: '', country: '', category: '' },
  showFavoritesOnly: false,
  viewMode: localStorage.getItem('iptv_live_view_mode') || 'carousel',
  preview: { card: null, video: null, hls: null },
  hls: null,
  currentChannelId: null,
  castReady: false,
};

/* ---------------------------------------------------------------
   ELEMENTOS
   --------------------------------------------------------------- */
const el = {
  rows: document.getElementById('channelRows'),
  empty: document.getElementById('emptyState'),
  search: document.getElementById('searchInput'),
  countryFilter: document.getElementById('countryFilter'),
  categoryFilter: document.getElementById('categoryFilter'),
  status: document.getElementById('statusLine'),
  viewToggleBtn: document.getElementById('viewToggleBtn'),
  favToggleBtn: document.getElementById('favToggleBtn'),

  modal: document.getElementById('playerModal'),
  video: document.getElementById('videoEl'),
  playerLogo: document.getElementById('playerLogo'),
  playerName: document.getElementById('playerName'),
  playerMeta: document.getElementById('playerMeta'),
  playerPipBtn: document.getElementById('playerPipBtn'),
  playerCastBtn: document.getElementById('playerCastBtn'),
  playerFavBtn: document.getElementById('playerFavBtn'),
  playerCloseBtn: document.getElementById('playerCloseBtn'),
  overlay: document.getElementById('playerOverlay'),
  overlayText: document.getElementById('playerOverlayText'),
};

/* ---------------------------------------------------------------
   INIT
   --------------------------------------------------------------- */
init();

async function init() {
  registerServiceWorker();
  bindEvents();

  try {
    const [channelsRaw, streamsRaw, countriesRaw, categoriesRaw] = await Promise.all([
      fetchJSON(API.channels),
      fetchJSON(API.streams),
      fetchJSON(API.countries),
      fetchJSON(API.categories),
    ]);

    state.countries = Object.fromEntries(countriesRaw.map(c => [c.code, c.name]));
    state.categories = Object.fromEntries(categoriesRaw.map(c => [c.id, c.name]));

    // mapa: channel id -> primeira stream utilizável
    const streamMap = new Map();
    for (const s of streamsRaw) {
      if (!s.channel || !s.url) continue;
      if (!streamMap.has(s.channel)) streamMap.set(s.channel, s.url);
    }

    state.channels = channelsRaw
      .filter(c => streamMap.has(c.id) && c.name)
      .map(c => ({
        id: c.id,
        name: c.name,
        logo: c.logo || '',
        country: c.country || '',
        category: (c.categories && c.categories[0]) || '',
        url: streamMap.get(c.id),
      }));

    populateFilterOptions();
    el.status.textContent = `${state.channels.length} canais disponíveis`;
    renderGrid();
  } catch (err) {
    console.error(err);
    el.status.textContent = 'Falha ao carregar canais. Verifique sua conexão.';
  }
}

function fetchJSON(url) {
  return fetch(url).then(r => {
    if (!r.ok) throw new Error('Falha ao buscar ' + url);
    return r.json();
  });
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
}

/* ---------------------------------------------------------------
   FILTROS (dropdowns)
   --------------------------------------------------------------- */
function populateFilterOptions() {
  const usedCountries = new Set(state.channels.map(c => c.country).filter(Boolean));
  const usedCategories = new Set(state.channels.map(c => c.category).filter(Boolean));

  const countryOptions = [...usedCountries]
    .map(code => ({ code, name: state.countries[code] || code }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const categoryOptions = [...usedCategories]
    .map(id => ({ id, name: state.categories[id] || id }))
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const c of countryOptions) {
    const opt = document.createElement('option');
    opt.value = c.code;
    opt.textContent = c.name;
    el.countryFilter.appendChild(opt);
  }
  for (const c of categoryOptions) {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    el.categoryFilter.appendChild(opt);
  }
}

/* ---------------------------------------------------------------
   RENDER DA GRADE
   --------------------------------------------------------------- */
function getFilteredChannels() {
  const { search, country, category } = state.filters;
  const searchTerms = search.split(/\s+/).filter(Boolean);
  return state.channels.filter(c => {
    if (state.showFavoritesOnly && !state.favorites.has(c.id)) return false;
    if (country && c.country !== country) return false;
    if (category && c.category !== category) return false;
    if (searchTerms.length) {
      const haystack = [
        c.name,
        c.id,
        c.country,
        state.countries[c.country],
        c.category,
        state.categories[c.category],
      ].filter(Boolean).join(' ').toLowerCase();
      if (!searchTerms.every(term => haystack.includes(term))) return false;
    }
    return true;
  });
}

function renderGrid() {
  const filtered = getFilteredChannels();
  el.rows.innerHTML = '';
  el.empty.classList.toggle('hidden', filtered.length > 0);
  const hasActiveFilter = state.filters.search || state.filters.country || state.filters.category || state.showFavoritesOnly;
  if (hasActiveFilter) {
    el.status.textContent = `${filtered.length} ${filtered.length === 1 ? 'canal encontrado' : 'canais encontrados'}`;
  } else {
    el.status.textContent = `${state.channels.length} canais disponíveis`;
  }
  el.rows.classList.toggle('grid-mode', state.viewMode === 'grid');
  el.viewToggleBtn.classList.toggle('active', state.viewMode === 'grid');
  el.viewToggleBtn.textContent = state.viewMode === 'grid' ? '☰' : '▦';
  el.viewToggleBtn.title = state.viewMode === 'grid' ? 'Alternar para carrossel' : 'Alternar para grade';
  el.viewToggleBtn.setAttribute('aria-label', el.viewToggleBtn.title);
  if (filtered.length === 0) return;

  const frag = document.createDocumentFragment();

  if (!state.showFavoritesOnly && !state.filters.search && !state.filters.country && !state.filters.category) {
    const byId = new Map(state.channels.map(channel => [channel.id, channel]));
    const featured = state.channels.slice().sort((a, b) => streamScore(b) - streamScore(a)).slice(0, FEATURED_LIMIT);
    if (featured.length) frag.appendChild(buildCarouselRow('Ao vivo agora', featured));
    const recent = state.history
      .slice().sort((a, b) => b.lastWatched - a.lastWatched)
      .map(item => byId.get(item.id)).filter(Boolean).slice(0, 12);
    const mostWatched = state.history
      .slice().sort((a, b) => b.plays - a.plays || b.lastWatched - a.lastWatched)
      .map(item => byId.get(item.id)).filter(Boolean).slice(0, 12);
    if (recent.length) frag.appendChild(buildCarouselRow('Recentemente assistidos', recent));
    if (mostWatched.length) frag.appendChild(buildCarouselRow('Mais assistidos', mostWatched));
  }

  // Linha de favoritos no topo (só quando não estamos já filtrando "só favoritos")
  if (!state.showFavoritesOnly) {
    const favs = filtered.filter(c => state.favorites.has(c.id));
    if (favs.length) {
      frag.appendChild(buildCarouselRow('★ Favoritos', favs));
    }
  }

  // Demais canais agrupados por gênero editorial
  const groups = new Map();
  for (const c of filtered) {
    const key = genreForChannel(c);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }

  const sortedKeys = [...groups.keys()].sort((a, b) =>
    GENRE_ORDER.indexOf(a) - GENRE_ORDER.indexOf(b)
  );

  for (const key of sortedKeys) {
    frag.appendChild(buildCarouselRow(key, groups.get(key)));
  }

  el.rows.appendChild(frag);
}

function buildCarouselRow(title, channels) {
  const row = document.createElement('section');
  row.className = 'carousel-row';

  const head = document.createElement('div');
  head.className = 'carousel-head';
  const h2 = document.createElement('h2');
  h2.className = 'carousel-title';
  h2.innerHTML = `<span class="accent">›</span> ${escapeHtml(title)}`;
  const count = document.createElement('span');
  count.className = 'carousel-count';
  count.textContent = channels.length;
  head.append(h2, count);

  const track = document.createElement('div');
  track.className = 'carousel-track';
  for (const c of channels.slice(0, ROW_LIMIT)) {
    track.appendChild(buildChannelCard(c));
  }

  row.append(head, track);
  return row;
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function genreForChannel(channel) {
  const source = [channel.name, channel.category, state.categories[channel.category]]
    .filter(Boolean).join(' ').toLowerCase();
  const match = GENRE_RULES.find(rule => rule.terms.some(term => source.includes(term)));
  return match ? match.label : 'Geral';
}

function streamScore(channel) {
  const url = (channel.url || '').toLowerCase();
  let score = 0;
  if (url.startsWith('https://')) score += 3;
  if (url.includes('.m3u8')) score += 4;
  if (!url.includes('youtube.com') && !url.includes('youtu.be')) score += 2;
  if (channel.logo) score += 1;
  return score;
}

function buildChannelCard(c) {
  const card = document.createElement('button');
  card.className = 'channel-card';
  card.setAttribute('type', 'button');
  card.dataset.id = c.id;

  const cover = document.createElement('div');
  cover.className = 'channel-cover';
  cover.style.setProperty('--cover-hue', hueForChannel(c.name));

  const previewVideo = document.createElement('video');
  previewVideo.className = 'channel-preview';
  previewVideo.muted = true;
  previewVideo.loop = true;
  previewVideo.playsInline = true;
  previewVideo.setAttribute('aria-hidden', 'true');
  previewVideo.preload = 'none';

  const category = document.createElement('span');
  category.className = 'cover-badge';
  category.textContent = genreForChannel(c);

  const live = document.createElement('span');
  live.className = 'live-badge';
  live.innerHTML = '<i></i> AO VIVO';

  const previewButton = document.createElement('span');
  previewButton.className = 'preview-button';
  previewButton.textContent = '▶ Prévia';
  previewButton.setAttribute('role', 'button');
  previewButton.setAttribute('tabindex', '0');
  previewButton.setAttribute('aria-label', `Assistir prévia de ${c.name}`);

  const logoWrap = document.createElement('div');
  logoWrap.className = 'channel-logo-wrap';
  if (c.logo) {
    const img = document.createElement('img');
    img.className = 'channel-logo';
    img.loading = 'lazy';
    img.src = c.logo;
    img.alt = '';
    img.onerror = () => {
      img.style.display = 'none';
      logoWrap.classList.add('fallback-wrap');
      logoWrap.textContent = initials(c.name);
    };
    logoWrap.appendChild(img);
  } else {
    const fb = document.createElement('div');
    fb.className = 'channel-logo fallback';
    fb.textContent = initials(c.name);
    logoWrap.appendChild(fb);
  }

  const favorite = document.createElement('span');
  favorite.className = 'card-favorite';
  favorite.textContent = state.favorites.has(c.id) ? '★' : '☆';
  if (state.favorites.has(c.id)) favorite.classList.add('is-favorite');

  cover.append(previewVideo, category, live, logoWrap, favorite, previewButton);

  const info = document.createElement('div');
  info.className = 'channel-info';
  const name = document.createElement('div');
  name.className = 'channel-name';
  name.textContent = c.name;

  const tag = document.createElement('div');
  tag.className = 'channel-tag';
  tag.innerHTML = `<span class="country-flag">${flagForCountry(c.country)}</span>${escapeHtml(state.countries[c.country] || c.country || 'Internacional')}`;

  info.append(name, tag);
  card.append(cover, info);
  const startPreview = (event) => {
    if (event) event.stopPropagation();
    if (state.preview.card === card) return;
    stopPreview();
    state.preview.card = card;
    state.preview.video = previewVideo;
    card.classList.add('preview-active');
    previewButton.textContent = '■ Parar';
    previewVideo.src = c.url;
    previewVideo.play().catch(() => attachPreviewHls(previewVideo, c.url));
  };
  const stopCardPreview = (event) => {
    if (event) event.stopPropagation();
    if (state.preview.card === card) stopPreview();
  };
  previewButton.addEventListener('click', (event) => {
    if (state.preview.card === card) stopCardPreview(event);
    else startPreview(event);
  });
  previewButton.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      previewButton.click();
    }
  });
  card.addEventListener('pointerenter', () => { if (window.matchMedia('(hover: hover)').matches) startPreview(); });
  card.addEventListener('pointerleave', () => { if (window.matchMedia('(hover: hover)').matches) stopCardPreview(); });
  card.addEventListener('click', () => openPlayer(c));
  return card;
}

function attachPreviewHls(video, url) {
  if (state.preview.card && state.preview.video === video && window.Hls && Hls.isSupported()) {
    if (state.preview.hls) state.preview.hls.destroy();
    const hls = new Hls({ maxBufferLength: 8, maxMaxBufferLength: 16 });
    state.preview.hls = hls;
    hls.loadSource(url);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
  }
}

function stopPreview() {
  const { card, video, hls } = state.preview;
  if (hls) hls.destroy();
  if (video) {
    video.pause();
    video.removeAttribute('src');
    video.load();
  }
  if (card) {
    card.classList.remove('preview-active');
    const button = card.querySelector('.preview-button');
    if (button) button.textContent = '▶ Prévia';
  }
  state.preview = { card: null, video: null, hls: null };
}

function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase();
}

function hueForChannel(name) {
  let hash = 0;
  for (const char of name) hash = ((hash << 5) - hash) + char.charCodeAt(0);
  return Math.abs(hash) % 360;
}

function flagForCountry(code) {
  if (!code || code.length !== 2) return '◉';
  return [...code.toUpperCase()].map(char => String.fromCodePoint(127397 + char.charCodeAt(0))).join('');
}

/* ---------------------------------------------------------------
   EVENTOS DE UI
   --------------------------------------------------------------- */
function bindEvents() {
  el.search.addEventListener('input', () => {
    state.filters.search = el.search.value.trim().toLowerCase();
    renderGrid();
  });

  el.countryFilter.addEventListener('change', () => {
    state.filters.country = el.countryFilter.value;
    renderGrid();
  });

  el.categoryFilter.addEventListener('change', () => {
    state.filters.category = el.categoryFilter.value;
    renderGrid();
  });

  el.viewToggleBtn.addEventListener('click', () => {
    state.viewMode = state.viewMode === 'grid' ? 'carousel' : 'grid';
    localStorage.setItem('iptv_live_view_mode', state.viewMode);
    renderGrid();
  });

  el.favToggleBtn.addEventListener('click', () => {
    state.showFavoritesOnly = !state.showFavoritesOnly;
    el.favToggleBtn.classList.toggle('active', state.showFavoritesOnly);
    renderGrid();
  });

  el.playerCloseBtn.addEventListener('click', closePlayer);
  el.modal.addEventListener('click', (e) => { if (e.target === el.modal) closePlayer(); });
  el.playerFavBtn.addEventListener('click', toggleCurrentFavorite);
  el.playerPipBtn.addEventListener('click', togglePictureInPicture);
  el.playerCastBtn.addEventListener('click', castCurrentChannel);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePlayer();
  });
}

window.__onGCastApiAvailable = (available) => {
  state.castReady = Boolean(available);
  if (!el.playerCastBtn) return;
  el.playerCastBtn.disabled = !state.castReady;
  el.playerCastBtn.title = state.castReady ? 'Transmitir para Chromecast' : 'Chromecast indisponível neste navegador';
};
if (window.cast && window.cast.framework) window.__onGCastApiAvailable(true);

/* ---------------------------------------------------------------
   PLAYER (HLS)
   --------------------------------------------------------------- */
function openPlayer(channel) {
  stopPreview();
  recordWatch(channel.id);
  state.currentChannelId = channel.id;
  el.playerName.textContent = channel.name;
  el.playerMeta.textContent = [state.countries[channel.country], state.categories[channel.category]].filter(Boolean).join(' · ') || '—';
  el.playerLogo.src = channel.logo || '';
  el.playerLogo.onerror = () => { el.playerLogo.style.visibility = 'hidden'; };
  el.playerLogo.style.visibility = channel.logo ? 'visible' : 'hidden';
  updateFavButton();

  el.modal.classList.remove('hidden');
  showOverlay('Conectando ao sinal...');
  loadStream(channel.url);
}

function loadStream(url) {
  destroyHls();
  const video = el.video;

  if (video.canPlayType('application/vnd.apple.mpegurl')) {
    // Safari / iOS: suporte nativo a HLS
    video.src = url;
    video.addEventListener('loadedmetadata', hideOverlay, { once: true });
    video.addEventListener('error', () => showOverlay('Sinal indisponível para este canal.'), { once: true });
    video.play().catch(() => {});
  } else if (window.Hls && Hls.isSupported()) {
    const hls = new Hls({ maxBufferLength: 20 });
    state.hls = hls;
    hls.loadSource(url);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      hideOverlay();
      video.play().catch(() => {});
    });
    hls.on(Hls.Events.ERROR, (_, data) => {
      if (data.fatal) showOverlay('Sinal indisponível para este canal.');
    });
  } else {
    showOverlay('Seu navegador não suporta reprodução deste sinal.');
  }
}

function destroyHls() {
  if (state.hls) {
    state.hls.destroy();
    state.hls = null;
  }
  el.video.removeAttribute('src');
  el.video.load();
}

function closePlayer() {
  destroyHls();
  el.modal.classList.add('hidden');
  state.currentChannelId = null;
  if (state.channels.length) renderGrid();
}

async function togglePictureInPicture() {
  if (!document.pictureInPictureEnabled || (!el.video.src && !el.video.srcObject)) return;
  try {
    if (document.pictureInPictureElement) await document.exitPictureInPicture();
    else await el.video.requestPictureInPicture();
  } catch (error) {
    console.warn('Picture-in-Picture indisponível', error);
  }
}

function castCurrentChannel() {
  if (!state.castReady || !window.cast || !window.cast.framework) return;
  const context = cast.framework.CastContext.getInstance();
  context.setOptions({
    receiverApplicationId: chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
    autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
  });
  context.requestSession().then(() => {
    const channel = state.channels.find(item => item.id === state.currentChannelId);
    if (!channel) return;
    const mediaInfo = new chrome.cast.media.MediaInfo(channel.url, 'application/x-mpegURL');
    mediaInfo.metadata = new chrome.cast.media.GenericMediaMetadata();
    mediaInfo.metadata.title = channel.name;
    mediaInfo.metadata.subtitle = [state.countries[channel.country], state.categories[channel.category]].filter(Boolean).join(' · ');
    return cast.framework.CastContext.getInstance().getCurrentSession()
      .loadMedia(new chrome.cast.media.LoadRequest(mediaInfo));
  }).catch(error => console.warn('Chromecast não conectado', error));
}

function showOverlay(text) {
  el.overlayText.textContent = text;
  el.overlay.classList.remove('hidden');
}
function hideOverlay() {
  el.overlay.classList.add('hidden');
}

/* ---------------------------------------------------------------
   FAVORITOS
   --------------------------------------------------------------- */
function toggleCurrentFavorite() {
  const id = state.currentChannelId;
  if (!id) return;
  if (state.favorites.has(id)) state.favorites.delete(id);
  else state.favorites.add(id);
  localStorage.setItem(FAV_KEY, JSON.stringify([...state.favorites]));
  updateFavButton();
}

function loadWatchHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    return Array.isArray(saved) ? saved.filter(item => item && item.id) : [];
  } catch {
    return [];
  }
}

function recordWatch(id) {
  const now = Date.now();
  const existing = state.history.find(item => item.id === id);
  if (existing) {
    existing.lastWatched = now;
    existing.plays = (existing.plays || 0) + 1;
  } else {
    state.history.push({ id, lastWatched: now, plays: 1 });
  }
  state.history = state.history
    .sort((a, b) => b.lastWatched - a.lastWatched)
    .slice(0, HISTORY_LIMIT);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history));
}

function updateFavButton() {
  const active = state.favorites.has(state.currentChannelId);
  el.playerFavBtn.textContent = active ? '★' : '☆';
  el.playerFavBtn.classList.toggle('active', active);
}
