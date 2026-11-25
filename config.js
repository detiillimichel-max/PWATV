/* Configuração pública do frontend. Nunca coloque a chave privada VAPID aqui. */
window.IPTV_CONFIG = {
  // Backend público da Vercel. Não colocar segredos neste arquivo.
  apiBase: 'https://pwatv.vercel.app',
  // Endpoints opcionais de notificações e tradução.
  pushApiBase: '',
  // Endpoint opcional com POST /api/translate { text, target }.
  translationApiBase: '',
  // API pública de notícias. O fallback usa links editoriais oficiais.
  newsApiUrl: 'https://hn.algolia.com/api/v1/search_by_date?query=Brazil&tags=story&hitsPerPage=12',
};
