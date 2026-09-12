# Prompt para integrar o IPTV Live com Vercel, Neon e APIs externas

Você é um engenheiro de software sênior especializado em **PWA, JavaScript, Node.js, Vercel Functions, PostgreSQL/Neon, Web Push, HLS, APIs públicas e segurança de aplicações web**.

Preciso integrar o projeto abaixo a um backend real:

- Repositório: `https://github.com/detiillimichel-max/PWATV`
- Aplicação publicada: `https://detiillimichel-max.github.io/PWATV/?v1`
- Frontend atual: HTML, CSS e JavaScript sem framework.
- Hospedagem atual do frontend: GitHub Pages.
- Backend desejado: Vercel Functions.
- Banco de dados desejado: Neon PostgreSQL.
- Agendamento inicial: GitHub Actions ou outra alternativa gratuita adequada.

Não altere arquivos diretamente sem antes analisar a estrutura existente. Primeiro faça um diagnóstico técnico do repositório e apresente um plano. Depois implemente por etapas pequenas, mantendo o PWA funcionando a cada etapa.

## Objetivo geral

Transformar o IPTV Live em uma aplicação mais confiável e resiliente, com:

1. Banco de canais e múltiplas URLs por canal.
2. Verificação automática de disponibilidade dos streams.
3. Fallback para site oficial, YouTube oficial ou outra fonte autorizada quando o canal não reproduzir dentro do app.
4. API backend na Vercel.
5. Banco PostgreSQL no Neon.
6. Inscrições Web Push com VAPID.
7. Alertas meteorológicos severos para capitais brasileiras.
8. Notícias públicas em cards.
9. Personalização regional com consentimento do usuário.
10. Diagnóstico visual para canais fora do ar.
11. Melhor experiência UX com ícones Lucide.

## Regras importantes

- Não remover funcionalidades existentes sem explicar o motivo.
- Não expor segredos no frontend, GitHub Pages ou arquivos públicos.
- Nunca colocar no repositório:
  - `DATABASE_URL`;
  - chave privada VAPID;
  - tokens de APIs;
  - credenciais da Vercel;
  - credenciais do Neon.
- Usar variáveis de ambiente na Vercel e nos GitHub Actions.
- Nunca criar um proxy aberto que aceite qualquer URL arbitrária. O proxy, se necessário, deve permitir somente domínios previamente cadastrados.
- Respeitar CORS, CSP, copyright, termos de uso e direitos das emissoras.
- Não tentar contornar bloqueios geográficos, autenticação, tokens privados ou proteções das emissoras.
- Usar somente fontes oficiais, públicas ou autorizadas.
- Não declarar um canal como “funcionando” apenas porque respondeu HTTP 200. Sempre distinguir resposta HTTP de reprodução HLS real.
- Criar logs úteis sem armazenar dados sensíveis.
- Implementar validação, timeout, limite de requisições e tratamento de erros.
- Todas as mudanças devem ser compatíveis com GitHub Pages.

## Arquitetura esperada

```text
GitHub Pages
  └── PWA IPTV Live
        ├── interface
        ├── player HLS
        ├── favoritos
        ├── histórico
        ├── EPG
        ├── notícias
        ├── meteorologia
        └── Web Push subscription

Vercel Functions
  ├── GET  /api/channels
  ├── GET  /api/channels/:id
  ├── GET  /api/streams/:channelId
  ├── POST /api/stream-checks
  ├── GET  /api/weather
  ├── GET  /api/news
  ├── GET  /api/push/public-key
  ├── POST /api/push/subscribe
  ├── DELETE /api/push/subscribe
  ├── POST /api/push/send-severe-weather
  └── GET  /api/health

Neon PostgreSQL
  ├── channels
  ├── streams
  ├── stream_checks
  ├── weather_cities
  ├── weather_alerts
  ├── news_sources
  ├── push_subscriptions
  └── user_preferences

GitHub Actions
  ├── verifica streams periodicamente
  ├── registra saúde dos canais
  ├── consulta clima severo
  └── chama endpoint protegido de alertas
```

## Banco de dados Neon

Proponha e crie migrations SQL versionadas para as tabelas abaixo.

### `channels`

Campos mínimos:

- `id` — identificador externo do canal.
- `name`.
- `country`.
- `language`.
- `category`.
- `logo_url`.
- `official_url`.
- `youtube_url`.
- `description`.
- `enabled`.
- `created_at`.
- `updated_at`.

### `streams`

Campos mínimos:

- `id`.
- `channel_id`.
- `url`.
- `format` — `hls`, `dash`, `youtube`, `external`.
- `source`.
- `priority`.
- `enabled`.
- `last_status` — `working`, `unstable`, `offline`, `blocked`, `unknown`.
- `last_checked_at`.
- `response_time_ms`.
- `failure_count`.
- `created_at`.
- `updated_at`.

### `stream_checks`

Campos mínimos:

- `id`.
- `stream_id`.
- `checked_at`.
- `http_status`.
- `response_time_ms`.
- `content_type`.
- `manifest_valid`.
- `playable`.
- `error_type`.
- `details`.

### `weather_cities`

Campos mínimos:

- `code` — UF.
- `name`.
- `latitude`.
- `longitude`.
- `enabled`.

### `weather_alerts`

Campos mínimos:

- `id`.
- `city_code`.
- `alert_type`.
- `severity`.
- `temperature`.
- `weather_code`.
- `wind_speed`.
- `starts_at`.
- `ends_at`.
- `fingerprint`.
- `sent_at`.
- `created_at`.

### `push_subscriptions`

Campos mínimos:

- `id`.
- `endpoint` único.
- `subscription_json` JSONB.
- `weather_cities` array de UFs.
- `severe_weather_alerts` boolean.
- `favorite_channel_ids` array.
- `timezone`.
- `created_at`.
- `updated_at`.

Criar índices para:

- `channels.country`;
- `channels.category`;
- `streams.channel_id`;
- `streams.last_status`;
- `streams.last_checked_at`;
- `stream_checks.checked_at`;
- `weather_alerts.fingerprint`;
- `push_subscriptions.endpoint`.

## API Vercel

Use Node.js/TypeScript ou JavaScript moderno, conforme a estrutura mais adequada ao repositório. Se escolher TypeScript, explique como configurar o projeto.

### Requisitos gerais das rotas

Cada rota deve ter:

- validação de método HTTP;
- validação de entrada;
- respostas JSON padronizadas;
- códigos HTTP corretos;
- timeout para APIs externas;
- tratamento de exceções;
- logs sem segredos;
- CORS restrito ao domínio do GitHub Pages;
- proteção contra abuso e chamadas ilimitadas;
- nenhum SQL construído por concatenação insegura.

Formato de erro sugerido:

```json
{
  "error": {
    "code": "STREAM_NOT_FOUND",
    "message": "Stream não encontrado",
    "requestId": "..."
  }
}
```

### `/api/channels`

Retornar canais ativos com suas URLs ordenadas por prioridade e status de saúde.

A resposta deve informar:

- nome;
- logo;
- país;
- categoria;
- descrição;
- URL oficial;
- URL do YouTube oficial, quando existir;
- streams disponíveis;
- última verificação;
- status de cada stream.

### `/api/stream-checks`

Criar endpoint para registrar verificações feitas por um job autorizado.

Não permitir que qualquer pessoa escreva verificações livremente. Usar um segredo de job em variável de ambiente, por exemplo:

```text
STREAM_CHECK_JOB_SECRET
```

Comparar o segredo usando uma abordagem segura.

### `/api/push/public-key`

Retornar somente a chave pública VAPID.

Nunca retornar a chave privada.

### `/api/push/subscribe`

Receber:

```json
{
  "subscription": {
    "endpoint": "...",
    "keys": {
      "p256dh": "...",
      "auth": "..."
    }
  },
  "favoriteChannelIds": [],
  "weatherCities": ["SP", "RJ"],
  "severeWeatherAlerts": true,
  "timezone": "America/Sao_Paulo"
}
```

Validar o payload, fazer upsert pelo `endpoint` e não armazenar dados desnecessários.

### `/api/push/send-severe-weather`

Criar endpoint protegido por `ALERT_JOB_SECRET`.

O endpoint deve:

1. Receber alertas novos já avaliados.
2. Evitar duplicidade usando `fingerprint`.
3. Buscar inscrições das capitais afetadas.
4. Enviar Push com Web Push/VAPID.
5. Remover inscrições inválidas ou expiradas.
6. Registrar `sent_at`.

Payload de notificação:

```json
{
  "title": "Alerta meteorológico",
  "body": "Condição severa detectada em São Paulo.",
  "tag": "weather-SP-2026-09-12T10:00",
  "data": {
    "type": "severe-weather",
    "cityCode": "SP"
  }
}
```

## Verificação de streams

Criar um worker ou script executado pelo GitHub Actions.

Para cada stream ativo:

1. Fazer requisição com timeout.
2. Verificar status HTTP.
3. Verificar `Content-Type`.
4. Confirmar que o manifesto possui estrutura HLS válida.
5. Verificar pelo menos um segmento quando isso for seguro e permitido.
6. Registrar tempo de resposta.
7. Classificar como:
   - `working`;
   - `unstable`;
   - `offline`;
   - `blocked`;
   - `unknown`.
8. Atualizar `failure_count`.
9. Desativar temporariamente somente após várias falhas consecutivas.
10. Reativar automaticamente após verificações bem-sucedidas.

Não baixar vídeos inteiros. Usar HEAD/GET limitado, timeouts e limites de tamanho.

Para canais sem URL reproduzível, o frontend deve mostrar:

- botão `external-link` para o site oficial;
- botão `youtube` para o YouTube oficial;
- botão `refresh-cw` para tentar novamente;
- botão `circle-alert` para exibir diagnóstico;
- mensagem clara: “Fora do ar no app — abra a fonte oficial”.

## Meteorologia e alertas

Usar Open-Meteo para as capitais brasileiras.

Condições iniciais de alerta:

- códigos WMO de tempestade severa;
- vento igual ou superior a 60 km/h;
- temperatura igual ou superior a 38 °C;
- temperatura igual ou inferior a 5 °C.

Esses limites devem ficar configuráveis, não espalhados pelo código.

Exigir deduplicação para não enviar a mesma notificação repetidamente.

Explicar a diferença entre:

- alerta local enquanto o PWA está aberto;
- Push em segundo plano com backend ativo;
- impossibilidade de o GitHub Pages executar verificações com o navegador fechado.

## Notícias

Criar uma rota `/api/news` ou manter a consulta direta no frontend, explicando o trade-off.

A fonte precisa ser pública e respeitar os limites de uso. O frontend deve exibir:

- título;
- fonte;
- data;
- resumo quando disponível;
- ícone Lucide `newspaper`;
- ação para abrir no modal ou em nova aba.

Não copiar artigos protegidos. Mostrar apenas título, resumo permitido e link para a fonte original.

## Personalização regional

Implementar com consentimento:

1. Não pedir geolocalização automaticamente ao abrir o app.
2. Exibir botão “Usar minha localização”.
3. Pedir permissão somente após o clique.
4. Usar as coordenadas para buscar clima regional.
5. Não enviar coordenadas precisas para um servidor próprio sem necessidade.
6. Arredondar ou transformar em cidade/UF quando precisar persistir a preferência.
7. Permitir trocar a região manualmente.
8. Permitir apagar a região salva.

Conteúdos personalizados possíveis:

- rádios da região;
- canais locais;
- notícias regionais;
- meteorologia local;
- alertas para a capital ou cidade escolhida.

## UX e Lucide

Melhorar a experiência sem quebrar o layout atual.

Usar Lucide para:

- `play-circle` no botão de assistir;
- `external-link` para site externo;
- `youtube` para YouTube oficial;
- `refresh-cw` para tentar novamente;
- `circle-alert` para diagnóstico;
- `radio-tower` para estação ao vivo;
- `newspaper` para notícias;
- `cloud-alert` para alerta meteorológico;
- `locate-fixed` para localização;
- `heart` para favoritos;
- `clock-3` para histórico;
- `cast` para Chromecast;
- `picture-in-picture-2` para PiP;
- `x` para fechar;
- `loader-circle` durante carregamento.

Todos os botões devem ter:

- `title`;
- `aria-label`;
- foco visível;
- estado `disabled` quando aplicável;
- feedback visual de carregamento;
- mensagem de erro compreensível.

## Variáveis de ambiente

Criar `.env.example` sem valores reais:

```text
DATABASE_URL=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:seu-email@example.com
STREAM_CHECK_JOB_SECRET=
ALERT_JOB_SECRET=
ALLOWED_ORIGIN=https://detiillimichel-max.github.io
NEWS_API_KEY=
```

Explicar onde configurar cada variável:

- ambiente local;
- Vercel Preview;
- Vercel Production;
- GitHub Actions Secrets.

Nunca pedir que o usuário cole segredos no chat ou no repositório.

## GitHub Actions

Criar workflow protegido, por exemplo:

```text
.github/workflows/check-streams.yml
```

O workflow deve:

- executar em intervalo razoável;
- usar `STREAM_CHECK_JOB_SECRET`;
- usar `DATABASE_URL` ou chamar endpoint protegido da Vercel;
- limitar concorrência;
- usar timeout;
- não imprimir secrets;
- gerar logs resumidos;
- não falhar todo o processo por causa de um canal individual.

Antes de escolher intervalo, explique as limitações do plano e apresente uma opção de menor frequência.

## Plano de implementação obrigatório

Trabalhe nesta ordem:

### Fase 1 — Diagnóstico

- Inspecionar o repositório.
- Identificar como o frontend atual carrega canais, streams, clima, notícias e Push.
- Apresentar riscos e arquivos que serão alterados.

### Fase 2 — Banco

- Criar migrations Neon.
- Criar seed inicial das capitais.
- Criar seed de fontes oficiais e rádios.
- Criar instruções de conexão.

### Fase 3 — API

- Criar Vercel Functions.
- Implementar `/api/health`.
- Implementar canais e streams.
- Implementar Push.
- Implementar clima e notícias.

### Fase 4 — Verificação

- Criar worker ou GitHub Action.
- Adicionar health checks.
- Implementar classificação de falhas.
- Criar fallback no frontend.

### Fase 5 — Frontend

- Integrar o PWA à API.
- Adicionar badges de status.
- Adicionar botões Lucide.
- Adicionar diagnóstico de canal.
- Integrar localização regional.
- Integrar cards de notícias.

### Fase 6 — Segurança e testes

- Testar autorização dos endpoints.
- Testar CORS.
- Testar payloads inválidos.
- Testar stream offline.
- Testar URL sem CORS.
- Testar canal com YouTube oficial.
- Testar inscrição e remoção Push.
- Testar deduplicação de alertas.
- Testar Service Worker.
- Testar mobile.

### Fase 7 — Deploy

- Explicar como criar o projeto Vercel.
- Explicar como conectar o repositório.
- Explicar como criar o banco Neon.
- Explicar como configurar variáveis de ambiente.
- Explicar como executar migrations.
- Explicar como configurar secrets do GitHub Actions.
- Explicar como atualizar `config.js` do frontend.
- Fornecer checklist de produção.

## Formato da resposta desejada

Responda sempre em português e siga este formato:

1. Diagnóstico atual.
2. Arquitetura recomendada.
3. Comparação de alternativas quando houver dúvida.
4. Plano da fase atual.
5. Arquivos criados ou alterados.
6. Código completo dos arquivos novos.
7. Migrations SQL completas.
8. Variáveis de ambiente necessárias.
9. Comandos exatos para instalar, testar e publicar.
10. Testes executados.
11. Riscos e limitações.
12. Próxima fase.

Não invente que uma API ou deploy foi concluído. Se faltar uma credencial, pare nessa etapa e explique exatamente qual configuração o usuário precisa fazer, sem solicitar que ele envie segredos pelo chat.

Comece agora pela **Fase 1 — Diagnóstico**, analisando o repositório e propondo a arquitetura detalhada antes de escrever código.
