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
const ROW_LIMIT = 40; // limite de canais exibidos por carrossel (performance mobile)

/* ---------------------------------------------------------------
   ESTADO
   --------------------------------------------------------------- */
const state = {
  channels: [],       // canais já cruzados com sua stream principal
  countries: {},       // code -> nome
  categories: {},       // id -> nome
  favorites: new Set(JSON.parse(localStorage.getItem(FAV_KEY) || '[]')),
  filters: { search: '', country: '', category: '' },
  showFavoritesOnly: false,
  hls: null,
  currentChannelId: null,
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
  favToggleBtn: document.getElementById('favToggleBtn'),

  modal: document.getElementById('playerModal'),
  video: document.getElementById('videoEl'),
  playerLogo: document.getElementById('playerLogo'),
  playerName: document.getElementById('playerName'),
  playerMeta: document.getElementById('playerMeta'),
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
  return state.channels.filter(c => {
    if (state.showFavoritesOnly && !state.favorites.has(c.id)) return false;
    if (country && c.country !== country) return false;
    if (category && c.category !== category) return false;
    if (search) {
      const haystack = (c.name + ' ' + (state.countries[c.country] || '')).toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

function renderGrid() {
  const filtered = getFilteredChannels();
  el.rows.innerHTML = '';
  el.empty.classList.toggle('hidden', filtered.length > 0);
  if (filtered.length === 0) return;

  const frag = document.createDocumentFragment();

  // Linha de favoritos no topo (só quando não estamos já filtrando "só favoritos")
  if (!state.showFavoritesOnly) {
    const favs = filtered.filter(c => state.favorites.has(c.id));
    if (favs.length) {
      frag.appendChild(buildCarouselRow('★ Favoritos', favs));
    }
  }

  // Demais canais agrupados por categoria
  const groups = new Map();
  for (const c of filtered) {
    const key = c.category || 'outros';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }

  const sortedKeys = [...groups.keys()].sort((a, b) =>
    (state.categories[a] || a).localeCompare(state.categories[b] || b)
  );

  for (const key of sortedKeys) {
    const label = state.categories[key] || key;
    frag.appendChild(buildCarouselRow(label, groups.get(key)));
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

function buildChannelCard(c) {
  const card = document.createElement('button');
  card.className = 'channel-card';
  card.setAttribute('type', 'button');
  card.dataset.id = c.id;

  const logoWrap = document.createElement('div');
  if (c.logo) {
    const img = document.createElement('img');
    img.className = 'channel-logo';
    img.loading = 'lazy';
    img.src = c.logo;
    img.alt = '';
    img.onerror = () => { img.style.display = 'none'; };
    logoWrap.appendChild(img);
  } else {
    const fb = document.createElement('div');
    fb.className = 'channel-logo fallback';
    fb.textContent = c.name.slice(0, 2).toUpperCase();
    logoWrap.appendChild(fb);
  }

  const name = document.createElement('div');
  name.className = 'channel-name';
  name.textContent = c.name;

  const tag = document.createElement('div');
  tag.className = 'channel-tag';
  tag.textContent = [state.countries[c.country], state.categories[c.category]].filter(Boolean).join(' · ');

  card.append(logoWrap, name, tag);
  card.addEventListener('click', () => openPlayer(c));
  return card;
}

/* ---------------------------------------------------------------
   EVENTOS DE UI
   --------------------------------------------------------------- */
function bindEvents() {
  let searchDebounce;
  el.search.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      state.filters.search = el.search.value.trim().toLowerCase();
      renderGrid();
    }, 200);
  });

  el.countryFilter.addEventListener('change', () => {
    state.filters.country = el.countryFilter.value;
    renderGrid();
  });

  el.categoryFilter.addEventListener('change', () => {
    state.filters.category = el.categoryFilter.value;
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

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePlayer();
  });
}

/* ---------------------------------------------------------------
   PLAYER (HLS)
   --------------------------------------------------------------- */
function openPlayer(channel) {
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

function updateFavButton() {
  const active = state.favorites.has(state.currentChannelId);
  el.playerFavBtn.textContent = active ? '★' : '☆';
  el.playerFavBtn.classList.toggle('active', active);
}

