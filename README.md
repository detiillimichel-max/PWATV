# IPTV Live — PWA de canais de TV

PWA responsivo para descobrir e assistir canais de televisão ao vivo diretamente do navegador. A aplicação usa a API pública e comunitária [iptv-org/api](https://github.com/iptv-org/api) para cruzar canais, logos, países, categorias e streams disponíveis.

## Recursos

| Recurso | Descrição |
| --- | --- |
| Player ao vivo | Reprodução de streams HLS `.m3u8` com HLS.js e fallback HLS nativo para Safari/iOS. |
| Carrosséis | Navegação horizontal por gênero, favoritos, canais recentes, mais assistidos e “Ao vivo agora”. |
| Grade | Alternância entre carrossel e grade responsiva, com preferência salva no dispositivo. |
| Busca em tempo real | Pesquisa instantânea por nome, país, categoria ou identificador do canal. |
| Filtros | Filtros por país e categoria original da fonte. |
| Gêneros editoriais | Notícias, Esportes, Filmes, Infantil, Entretenimento, Documentários, Música e Geral. |
| Cards | Logo, país, gênero, estado ao vivo, favorito e prévia de vídeo silenciosa. |
| Prévia | Reprodução ao passar o mouse ou pelo botão de toque “Prévia”. |
| Favoritos | Favoritos persistentes no `localStorage`, acessíveis pelo botão de estrela. |
| Histórico | “Recentemente assistidos” e “Mais assistidos”, com contagem local de acessos. |
| Picture-in-Picture | Mantém o player flutuante durante a navegação quando o navegador suporta a API. |
| Chromecast | Botão de transmissão usando o Google Cast SDK quando disponível. |
| Notificações | Permissão acionada pelo usuário para avisar novos canais, programação EPG favorita e atualizações enquanto o app está ativo. |
| Push service worker | O service worker trata eventos push recebidos por um backend compatível com VAPID. |
| EPG | Painel de grade horária com fonte JSON configurável e cache local. |
| PWA/offline | Manifesto instalável e cache do app shell pelo service worker. |

## Uso

Abra [a aplicação publicada](https://detiillimichel-max.github.io/PWATV/?v1). Use o campo de busca para filtrar os canais enquanto digita. O botão `▦` alterna para grade, `★` mostra favoritos, `♢` solicita notificações e `▤` abre a programação.

Clique no card para abrir o player completo. Em desktop, passe o mouse sobre o card para iniciar uma prévia; em dispositivos de toque, use o botão `Prévia`. Os botões PiP e Chromecast ficam no cabeçalho do player quando são suportados pelo ambiente.

## Notificações

As notificações são opcionais e só são solicitadas após o clique no botão de notificações. O app pode avisar sobre novos canais detectados, programas EPG próximos para canais favoritos e mensagens recebidas por push.

A hospedagem estática no GitHub Pages **não possui um servidor de envio**. Portanto, o comportamento local funciona enquanto a página/app estiver em execução. Para receber Web Push genuíno com o navegador fechado, é necessário um backend próprio que mantenha uma assinatura Push, use chaves VAPID e envie payloads para o service worker. O service worker já aceita payload JSON no formato:

```json
{
  "title": "Esporte ao vivo",
  "body": "A programação do seu canal favorito começa agora.",
  "tag": "programacao-canal",
  "url": "./"
}
```

## EPG

A API básica de canais/streams não fornece a grade horária. O painel EPG é opcional: abra `▤`, escolha **Configurar fonte EPG** e informe uma URL JSON acessível por CORS.

O formato mínimo aceito é um array ou um objeto com `programmes`/`programs`:

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

A aplicação converte os horários para o fuso local, sanitiza os textos exibidos e mantém o último EPG válido em cache. Para XMLTV, recomenda-se converter o XML em um endpoint JSON ou usar um proxy/backend, pois o navegador pode bloquear CORS.

## Armazenamento local e privacidade

Os favoritos, o modo de visualização, o histórico, a URL EPG, o cache EPG, o estado de notificações e os IDs de canais já vistos ficam apenas no armazenamento local do navegador. O histórico é limitado aos 60 canais mais recentes. Limpar os dados do site remove essas informações.

## Fontes e limitações

- Canais, países, categorias e streams: [iptv-org/api](https://github.com/iptv-org/api).
- HLS.js: CDN público da Cloudflare.
- Chromecast: Google Cast Sender SDK.
- Alguns streams podem estar offline, expirar ou não permitir CORS; nesse caso o player informa que o sinal está indisponível.
- A disponibilidade real dos canais é mantida por terceiros e não é garantida pelo projeto.
- PiP depende do navegador e de políticas de reprodução.
- Chromecast exige um navegador/dispositivo compatível e normalmente uma conexão na mesma rede.
- Notificações dependem de HTTPS, permissão do navegador e, para push em segundo plano, de um backend VAPID.

## Desenvolvimento local

```bash
python3 -m http.server 4173
```

Depois, acesse `http://localhost:4173`. Para testar service worker, notificações e instalação PWA, use HTTPS ou um ambiente de desenvolvimento seguro. Validações básicas:

```bash
node --check app.js
git diff --check
```

## Publicação

O projeto é publicado pelo GitHub Pages a partir da branch `main`:

```bash
git add .
git commit -m "mensagem da alteração"
git push origin main
```

_______________
_______________
_______________

Implementações concluídas e publicadas no repositório.

### Melhorias realizadas

- **Nomes dos canais com melhor contraste**
  - Texto branco de alta legibilidade.
  - Sombra sutil para facilitar visualização sobre diferentes fundos.
  - Mantida a identificação visual por país, gênero e status.

- **Notificações**
  - Botão para ativar notificações após consentimento do usuário.
  - Avisos para:
    - Novos canais detectados.
    - Programas EPG próximos em canais favoritos.
    - Atualizações recebidas via Push API.
  - Service Worker preparado para receber notificações push com payload JSON.
  - Ícone e clique da notificação configurados para reabrir o PWA.

- **EPG / grade horária**
  - Novo painel de programação.
  - Fonte JSON configurável pelo usuário.
  - Cache local da última programação válida.
  - Conversão para horário local.
  - Sanitização dos dados antes da renderização.
  - Suporte aos formatos:
    - Array direto.
    - Objeto com `programmes`.
    - Objeto com `programs`.

- **Documentação**
  - README reescrito com todos os recursos:
    - Player HLS.
    - Carrossel.
    - Grade.
    - Busca em tempo real.
    - Filtros.
    - Gêneros.
    - Prévia dos cards.
    - Favoritos.
    - Histórico.
    - Picture-in-Picture.
    - Chromecast.
    - Notificações.
    - EPG.
    - PWA/offline.
    - Privacidade e armazenamento local.
    - Limitações de CORS, EPG e Web Push.
    - Formato JSON esperado para EPG.
    - Instruções de desenvolvimento e publicação.

### Observação importante sobre Push

O GitHub Pages permite que o PWA receba notificações enquanto estiver aberto, mas **push real com o navegador fechado exige um backend próprio com VAPID**. O Service Worker já está preparado para receber esse tipo de evento quando o backend for conectado.

### Skill reutilizável criada

A skill foi criada, validada com sucesso pelo `quick_validate.py` e documenta padrões reutilizáveis para evolução de PWAs de TV:

[pwa-tv-streaming/SKILL.md](/home/ubuntu/skills/pwa-tv-streaming/SKILL.md)

### Commit publicado

**Commit:** `0e5d994 — feat: add notifications and EPG documentation`

Arquivos atualizados:

- [README.md](/home/ubuntu/PWATV/README.md)
- [index.html](/home/ubuntu/PWATV/index.html)
- [app.js](/home/ubuntu/PWATV/app.js)
- [style.css](/home/ubuntu/PWATV/style.css)
- [sw.js](/home/ubuntu/PWATV/sw.js)

Aplicação:

[https://detiillimichel-max.github.io/PWATV/?v1](https://detiillimichel-max.github.io/PWATV/?v1)
