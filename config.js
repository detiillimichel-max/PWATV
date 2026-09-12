/* Configuração pública do frontend. Nunca coloque a chave privada VAPID aqui. */
window.IPTV_CONFIG = {
  // Exemplo: 'https://seu-backend.example.com'
  pushApiBase: '',
  // Endpoint opcional com POST /api/translate { text, target }.
  translationApiBase: '',
  // API pública de notícias. O fallback usa links editoriais oficiais.
  newsApiUrl: 'https://hn.algolia.com/api/v1/search_by_date?query=Brazil&tags=story&hitsPerPage=12',
};
