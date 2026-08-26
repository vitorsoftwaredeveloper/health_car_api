# CLAUDE.md — HealthCar · API (`health_car_api`)

> Este repositório é **só código**. A especificação vive um nível acima, no diretório compartilhado `HealthCar/`, e é a mesma para a API e para o front.

| Onde | O quê |
| --- | --- |
| [`../CLAUDE.md`](../CLAUDE.md) | Contexto do produto, stack, regra crítica de vencimento, decisões D1–D14 |
| [`../docs/03-Backend.md`](../docs/03-Backend.md) | Contrato da API, motor de regras, `healthScore`, jobs, ADRs |
| [`../docs/04-Banco-de-Dados.md`](../docs/04-Banco-de-Dados.md) | Coleções, catálogo de 47 itens, índices |
| [`../docs/06-Backlog.md`](../docs/06-Backlog.md) | Backlog, estimativas, sprints |
| [`../.agents/skills/`](../.agents/skills) | Skills do projeto (caveman, perfil `ultra`) |

**Leia `../CLAUDE.md` antes de codar.** Não duplique especificação aqui.

## Regras deste repositório

- Camadas: `handler` (só orquestra) → `service` (regra + autorização de recurso + transação) → `repository` (só dados). `domain/` é puro, sem I/O, cobertura **100%** exigida pelo Jest.
- Identificador técnico em **inglês**; mensagem de erro e comentário em português.
- Dinheiro em centavos inteiros, só em `maintenanceEvents`.
- Modo de resposta: caveman nível `ultra` (ver `../CLAUDE.md` §0).

## Rodar

```bash
npm install
npm run local:up         # Mongo (replicaSet auto) + LocalStack (S3, SQS, SSM)
npm run seed             # catálogo (47 itens) + template genérico
npm run dev              # nodemon + serverless-offline em http://localhost:4000
npm test                 # unitários (domínio 100%, services mockados)
npm run test:integration # fluxos críticos contra o Mongo do docker
npm run typecheck
```

`npm run local:reset` derruba os volumes, sobe tudo de novo e semeia. `npm run local:down` para o ambiente.

## Ambiente local (LocalStack)

`docker-compose.yml` sobe dois serviços:

| Serviço | Porta | O que entrega |
| --- | --- | --- |
| `mongo` | 27017 | Mongo 6 com `rs0` iniciado sozinho pelo healthcheck (transações) |
| `localstack` | 4566 | S3, SQS e SSM |

O provisionamento roda no `ready.d` do LocalStack (`scripts/localstack/01-bootstrap.sh`) a cada `up`:

- bucket `health-car-api-local-attachments` com CORS liberado para `http://localhost:3000` (o PWA faz `PUT` direto na URL pré-assinada);
- fila `health-car-api-local-notifications` com DLQ e `maxReceiveCount` 5;
- parâmetros `/health_car/local/*` no SSM (db, `encryption_key`, chaves VAPID).

`config/local.json` aponta `AWS_ENDPOINT_URL=http://localhost:4566` e credenciais `test/test`. Os clientes AWS leem isso em `src/libs/awsConfig.ts` — com endpoint local o S3 usa `forcePathStyle`, o que faz a URL pré-assinada sair como `http://localhost:4566/<bucket>/<key>`, alcançável pelo navegador. Sem `AWS_ENDPOINT_URL` (dev, staging, prod) nada muda: os clientes continuam usando o endpoint real da AWS.

O `S3Client` roda com `requestChecksumCalculation: "WHEN_REQUIRED"` em **todos** os ambientes. Sem isso o SDK v3 assina a URL com `x-amz-checksum-crc32` do corpo vazio e o `PUT` do navegador volta `400 InvalidRequest` — o front envia o arquivo direto para a URL pré-assinada, sem passar pelo SDK.

**Cognito não sobe no LocalStack** (é recurso Pro). Em `STAGE=local` a autenticação usa o fallback de desenvolvimento: `serverless-offline` roda com `noAuth: true` e `src/middlewares/auth.ts` aceita os cabeçalhos `x-dev-sub`, `x-dev-role` e `x-dev-email`, que o front envia quando `NEXT_PUBLIC_DEV_AUTH=true`.

Os jobs não têm gatilho local (o `serverless.local.yml` não carrega `handlers/jobs`). Rode na mão:

```bash
npm run job:recalculate   # recalcula saúde, cria alertas e publica na fila
npm run job:notify        # consome os alertas pendentes e dispara o push
```
