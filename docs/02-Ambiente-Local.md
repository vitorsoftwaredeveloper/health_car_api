# Ambiente local

> **Escopo:** implementação do repositório `health_car_api` — como levantar, semear e depurar a API na máquina.
> **Fonte da verdade do produto:** [`../../docs/03-Backend.md`](../../docs/03-Backend.md); o catálogo semeado está descrito em [`../../docs/04-Banco-de-Dados.md`](../../docs/04-Banco-de-Dados.md).

## Subir

```bash
npm install
npm run local:up    # Mongo com replicaSet + LocalStack (S3, SQS, SSM)
npm run seed        # catálogo e template genérico
npm run dev         # nodemon + serverless-offline em http://localhost:4000
```

| Script | O que faz |
| --- | --- |
| `local:up` | `docker compose up -d --wait` — só volta quando os healthchecks passam |
| `local:down` | para os containers, preserva os volumes |
| `local:reset` | derruba **com volumes**, sobe de novo e semeia — banco zerado |
| `local:bootstrap` | `local:up` seguido de `seed` |

## O que sobe no docker

| Serviço | Porta | Entrega |
| --- | --- | --- |
| `mongo` | 27017 | Mongo 6 com o replicaSet `rs0` iniciado pelo próprio healthcheck |
| `localstack` | 4566 | S3, SQS e SSM |

O replicaSet não é capricho: sem ele o Mongo recusa transação, e a API usa transação nas operações que precisam ser atômicas.

O provisionamento do LocalStack roda a cada `up`, pelo `ready.d`, em [`../scripts/localstack/01-bootstrap.sh`](../scripts/localstack/01-bootstrap.sh):

- bucket de anexos com CORS liberado para o front local, porque o navegador faz `PUT` direto na URL pré-assinada;
- fila de notificações com DLQ;
- parâmetros `/health_car/local/*` no SSM (banco, chave de criptografia, chaves VAPID).

## Como os clientes AWS acham o LocalStack

`config/local.json` define `AWS_ENDPOINT_URL=http://localhost:4566` e credenciais de teste. Todos os clientes AWS passam por [`../src/libs/awsConfig.ts`](../src/libs/awsConfig.ts):

- **com** `AWS_ENDPOINT_URL`: o endpoint é redirecionado e o S3 liga `forcePathStyle`, o que faz a URL pré-assinada sair como `http://localhost:4566/<bucket>/<key>` — alcançável pelo navegador;
- **sem** a variável (dev, staging, prod): nada muda, os clientes falam com a AWS real.

O `S3Client` roda com `requestChecksumCalculation: "WHEN_REQUIRED"` em **todos** os ambientes. Sem isso o SDK v3 assina a URL com o checksum de um corpo vazio e o `PUT` do navegador volta `400 InvalidRequest`, porque quem envia o arquivo é o front, direto na URL, sem passar pelo SDK.

## Autenticação em desenvolvimento

Cognito não sobe no LocalStack — é recurso pago. Em `STAGE=local` o `serverless-offline` roda com `noAuth: true` e [`../src/middlewares/auth.ts`](../src/middlewares/auth.ts) aceita um fallback por cabeçalho:

| Cabeçalho | Conteúdo |
| --- | --- |
| `x-dev-sub` | identificador estável do usuário |
| `x-dev-role` | `owner` ou `admin` |
| `x-dev-email` | e-mail, usado na criação da conta no primeiro acesso |

O fallback só é aceito quando `STAGE` é `local`, `dev` ou vazio. Em staging e produção o único caminho é o JWT do Cognito.

Chamada manual:

```bash
curl -H "x-dev-sub: dev-fulano@exemplo.test" -H "x-dev-role: owner" -H "x-dev-email: fulano@exemplo.test" http://localhost:4000/v1/vehicles
```

O front manda esses mesmos cabeçalhos quando está em modo de desenvolvimento — o contrato dos dois lados está descrito em [`../../health_car/docs/04-Auth-e-Ambiente.md`](../../health_car/docs/04-Auth-e-Ambiente.md).

## Jobs na mão

`serverless.local.yml` não carrega `handlers/jobs`, então nada dispara sozinho:

```bash
npm run job:recalculate   # recalcula saúde, cria alertas, publica na fila
npm run job:notify        # consome a fila e dispara o push
npm run job:reminder      # cobra leitura de odômetro parada
npm run job:purge         # aplica a retenção
```

## Seeds e migrations

```bash
npm run seed:catalog      # itens do catálogo
npm run seed:templates    # template de plano
npm run seed              # os dois
npm run migrate scripts/migrations/<arquivo>.ts
```

Os seeds são idempotentes: rodar de novo atualiza o que mudou em vez de duplicar.

## Problemas conhecidos

**Primeira chamada depois de `local:reset` volta `504 Lambda timeout`.** O processo do `serverless-offline` continua com a conexão do container antigo em cache; a segunda chamada reconecta e passa. Se incomodar, reinicie o `npm run dev` junto com o reset.

**`PUT` do navegador na URL pré-assinada volta `400`.** Confira se o `S3Client` continua com `requestChecksumCalculation: "WHEN_REQUIRED"` e se o bootstrap do bucket rodou — `awslocal s3api get-bucket-cors` mostra a política aplicada.

**Transação falha com "Transaction numbers are only allowed on a replica set".** O Mongo subiu sem o `rs0`. `docker compose ps` deve mostrar o container como `healthy`; se estiver só `running`, o healthcheck ainda não iniciou o replicaSet.
