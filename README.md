PWA funcional de TV ao vivo, com todos os arquivos separados :
index.html — estrutura, grid de canais e modal do player
style.css — sua identidade visual (dark glass, cyan #00e5ff, Orbitron + DM Sans)
app.js — busca canais/streams da API pública iptv-org, filtros por país/categoria, 
busca, favoritos (localStorage) e player via hls.js (com fallback nativo pro Safari/iOS)
sw.js — cacheia o app shell (offline funciona pra abrir o app), mas nunca cacheia os streams de vídeo
manifest.json + ícones 192/512 (normal e maskable) — instalável no celular
Sobre a API: usei o iptv-org/api, que é público, gratuito, sem chave e mantido pela comunidade — 
tem milhares de canais reais de TV aberta do mundo todo (Globo, SBT, Record, RedeTV, canais de notícia internacionais, etc.),
já com país e categoria. Alguns canais ficam fora do ar de tempos em tempos porque dependem de listas de terceiros
então incluí a mensagem "sinal indisponível" pra esses casos.
Duas coisas que valem revisar antes de publicar:
Muitos streams m3u8 não enviam header CORS liberado — funciona na maioria, mas alguns canais podem falhar só por isso 
(não tem solução no client, seria preciso um proxy).
Os ícones que gerei são um placeholder simples (anel + play em ciano) — dá pra trocar por uma logo real depois, só substituindo os PNGs em icons/.
