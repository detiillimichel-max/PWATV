# IPTV Live — PWA de canais de TV

O IPTV Live é um Progressive Web App responsivo para descobrir e assistir canais de televisão ao vivo diretamente do navegador. A interface organiza os conteúdos em carrosséis e grade, com foco em navegação móvel, cards visuais, filtros, favoritos, histórico, programação EPG, clima e bibliotecas externas.

## Tecnologias

| Tecnologia | Uso no projeto |
| --- | --- |
| HTML5 | Estrutura semântica, player de vídeo, modal, filtros e navegação inferior. |
| CSS3 | Layout responsivo, glassmorphism, cards arredondados, carrosséis horizontais, grade, estados de foco e safe areas mobile. |
| JavaScript ES2022 | Estado da aplicação, renderização, filtros, player, histórico, favoritos, EPG, clima e integração com APIs. |
| PWA APIs | Service Worker, cache offline, instalação, notificações e Web Push. |
| HLS.js 1.5.13 | Reprodução de streams HLS `.m3u8` em navegadores sem HLS nativo. |
| HTMLVideoElement | Reprodução nativa de HLS em Safari/iOS e controles de vídeo. |
| Picture-in-Picture API | Player flutuante quando suportado pelo navegador. |
| Google Cast SDK | Transmissão para Chromecast quando o dispositivo e o navegador permitem. |
| Lucide Icons | Ícones vetoriais da barra inferior e ações de navegação. |
| iptv-org/api | Canais, logos, países, categorias e streams públicos mantidos pela comunidade. |
| Open-Meteo | Temperatura e condição meteorológica atual de São Paulo sem chave de API. |
| JSON EPG | Fonte opcional de programação configurável pelo usuário. |
| API de tradução opcional | Tradução dinâmica de descrições de canais e conteúdos EPG. |
| GitHub Pages | Hospedagem estática do frontend. |

## Funcionalidades

### Canais e player

- Lista de canais com logo, bandeira do país, categoria, gênero editorial e estado ao vivo.
- Carrosséis horizontais para “Ao vivo agora”, favoritos, histórico, mais assistidos e gêneros.
- Alternância entre carrossel e grade responsiva.
- Busca em tempo real por nome, país, categoria ou identificador.
- Filtros por país e categoria.
- Prévia silenciosa do stream em desktop e botão de prévia em dispositivos de toque.
- Player HLS integrado em modal, com fallback para HLS nativo.
- Picture-in-Picture e Chromecast.
- Descrição do canal exibida no cabeçalho do player quando fornecida pela API.
- Tratamento visual para streams indisponíveis, expirados ou bloqueados por CORS.

### Cards editoriais e bibliotecas

O primeiro carrossel apresenta a seção **Brasil em destaque**, com canais brasileiros encontrados na API e cards editoriais para:

- SBT.
- CNN Brasil.
- gnews.
- GloboNews.
- Record.
- Neural iA.
- Rádio América.
- Hub de Jogos.
- Meteorologia Open-Meteo.

Cards externos abrem inicialmente em um modal com `iframe`. Alguns sites enviam `X-Frame-Options` ou `Content-Security-Policy` e bloqueiam incorporação. Nessa situação, o modal mostra o fallback e o botão de abrir em nova aba preserva a navegação sem perder o contexto do PWA.

### Navegação inferior

A barra inferior inspirada em aplicativos de conteúdo usa Lucide Icons e organiza o app por biblioteca:

- **Canais:** retorna à área principal.
- **Meteorologia:** rola até o card Open-Meteo.
- **Rádio:** abre a Rádio América no modal incorporado ou em nova aba.
- **Neural IA:** abre o card Neural iA no modal incorporado ou em nova aba.

### Favoritos e histórico

- Favoritos persistentes no `localStorage`.
- Carrossel dedicado de favoritos.
- Histórico dos 60 canais mais recentes.
- Contagem de acessos para ordenar “Mais assistidos”.
- Sincronização dos favoritos com o backend Web Push quando configurado.

### EPG

O painel EPG aceita uma URL JSON configurada pelo usuário. São aceitos:

- Array JSON direto.
- Objeto com a propriedade `programmes`.
- Objeto com a propriedade `programs`.

Formato mínimo:

```json
[
  {
    "channelId": "canal-id-da-api",
    "title": "Nome do programa",
    "start": "2026-09-12T20:00:00Z",
    "end": "2026-09-12T21:00:00Z",
    "description": "Descrição opcional"
  }
]
```

A aplicação converte os horários para o fuso local, sanitiza o conteúdo exibido e mantém o último EPG válido em cache. XMLTV deve ser convertido para JSON ou servido por um proxy com CORS.

### Tradução e i18n

A interface está disponível em Português, Inglês e Espanhol. O idioma inicial é detectado por `navigator.languages` e `navigator.language`; uma escolha manual salva no navegador tem prioridade.

As traduções ficam centralizadas em:

```text
locales/pt-BR.json
locales/en.json
locales/es.json
```

O bundle consumido pelo navegador é gerado por:

```bash
node scripts/i18n.mjs validate
node scripts/i18n.mjs build
```

O comando `validate` garante que todos os idiomas tenham a mesma estrutura. O comando `list` lista os idiomas disponíveis.

Para tradução dinâmica de descrições de canais e títulos ou descrições EPG, configure em `config.js`:

```js
window.IPTV_CONFIG = {
  translationApiBase: 'https://seu-backend.example.com'
};
```

O frontend chama `POST /api/translate`:

```json
{
  "text": "Descrição original",
  "target": "en"
}
```

A resposta deve conter `translation` ou `translatedText`. Se a API não estiver configurada ou falhar, o texto original permanece visível.

### Clima

O card meteorológico usa a API Open-Meteo para obter condições atuais de São Paulo:

```text
https://api.open-meteo.com/v1/forecast
```

São utilizados `latitude`, `longitude`, `current`, `weather_code` e `timezone=auto`. Não é necessária chave de API para o uso previsto.

### Notificações e Web Push

O app oferece notificações locais e está preparado para Web Push com backend VAPID. Configure somente a URL pública do backend em `config.js`:

```js
window.IPTV_CONFIG = {
  pushApiBase: 'https://seu-backend.example.com'
};
```

Endpoints esperados:

```text
GET  /api/push/public-key
POST /api/push/subscribe
```

A chave privada VAPID nunca deve ser colocada no frontend, no GitHub ou em `config.js`. GitHub Pages não envia Push por conta própria; o backend deve armazenar inscrições e disparar as notificações.

### PWA e offline

- `manifest.json` permite instalação como aplicativo.
- `sw.js` mantém o app shell em cache.
- Cache versionado inclui HTML, CSS, JavaScript, configuração, traduções e Service Worker.
- O app continua abrindo offline com os recursos previamente armazenados; APIs externas dependem de conectividade.

## Configuração local

```bash
git clone https://github.com/detiillimichel-max/PWATV.git
cd PWATV
python3 -m http.server 4173
```

Abra `http://localhost:4173`. Para testar Service Worker, Push e instalação, use HTTPS ou um ambiente considerado seguro pelo navegador.

Validações:

```bash
node --check app.js
node --check sw.js
node scripts/i18n.mjs validate
git diff --check
```

## Privacidade e armazenamento

Os favoritos, modo de visualização, histórico, URL EPG, cache EPG, idioma, estado de notificações e canais vistos ficam no armazenamento local do navegador. O projeto não possui login nem envia esses dados para um servidor, exceto a assinatura Push e preferências quando um backend VAPID é configurado pelo usuário.

## Limitações e responsabilidade

- Streams públicos podem ficar offline, expirar ou não permitir CORS.
- Sites externos podem bloquear `iframe` por `X-Frame-Options` ou CSP; o fallback para nova aba é intencional.
- O projeto não hospeda nem garante a disponibilidade dos canais de terceiros.
- A API iptv-org é comunitária e seus dados podem mudar.
- PiP, Chromecast, Push e instalação PWA dependem do navegador, sistema operacional e permissões.
- A API de tradução dinâmica é opcional e deve ser fornecida pelo administrador do backend.

## Publicação

O projeto é publicado pelo GitHub Pages a partir da branch `main`:

```bash
git add .
git commit -m "descrição da alteração"
git push origin main
```

Aplicação publicada: <https://detiillimichel-max.github.io/PWATV/?v1>
