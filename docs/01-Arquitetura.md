# Arquitetura

> **Escopo:** implementação do repositório `health_car_api` — organização do código e caminho de um request.
> **Fonte da verdade do produto:** [`../../docs/03-Backend.md`](../../docs/03-Backend.md) para contrato, regra de vencimento e ADRs.

## Caminho de um request

```
API Gateway (HTTP API)
  └── authorizer JWT do Cognito
        └── handler          orquestra: lê path/body, chama service, devolve resposta
              └── middleware  withErrorHandling · requireRole · validateBody
                    └── service      regra de negócio, autorização do recurso, transação
                          └── repository  acesso ao Mongo, nada além disso
                                └── domain      função pura, sem I/O
```

Cada seta é uma dependência de mão única. `service` nunca importa `handler`; `repository` nunca importa `service`; `domain` não importa nada de infraestrutura.

## O que cada camada pode fazer

| Camada | Pode | Não pode |
| --- | --- | --- |
| `src/handlers` | ler `pathParameters` e `body`, aplicar middleware, chamar **um** service, devolver `sendSuccessResponse` | conter `if` de regra, montar query, falar com Mongo |
| `src/services` | decidir, autorizar o recurso, abrir transação, orquestrar repositórios e domínio | montar resposta HTTP, ler `event` |
| `src/repositories` | consultar e gravar | decidir qualquer coisa |
| `src/domain` | calcular | qualquer I/O — banco, rede, relógio externo |
| `src/schemas` | descrever o formato aceito (`ajv`) | validar regra de negócio |

`src/domain` é o único diretório com cobertura obrigatória de 100% (ver [04-Testes.md](./04-Testes.md)).

## Mapa de diretórios

```
src/
├── handlers/      1 arquivo por operação + functions.yml por domínio
├── middlewares/   auth · roleGuard · validate · errorHandler
├── services/      regra por domínio (vehicles, plan, odometer, alerts,
│                  maintenance, notifications, users, purge, catalog, jobs)
├── repositories/  1 por coleção, todos criados por base.ts
├── models/        schemas do Mongoose
├── schemas/       JSONSchemaType do ajv, espelhando o payload de cada rota
├── domain/        due · health · alerts · odometer · money · planItem ·
│                  planTemplate · notification · preferences · plate · retention
├── libs/          mongo · ssm · s3 · sqs · cognito · webpush · crypto · awsConfig
├── types/         tipos compartilhados entre camadas
└── utils/         date · errors · http
```

Fora de `src/`:

| Diretório | Conteúdo |
| --- | --- |
| `__tests__/` | testes unitários, espelhando `src/services` e `src/domain` |
| `config/` | `local.json`, `dev.json`, `staging.json`, `prod.json` — variáveis por stage |
| `resources/` | CloudFormation dos recursos: `s3.yml`, `sqs.yml`, `httpApi.yml` |
| `scripts/` | seeds, migrations, jobs manuais e o bootstrap do LocalStack |

## Como uma função vira endpoint

`serverless.yml` não lista funções: ele importa um `functions.yml` por domínio.

```yaml
functions:
  - ${file(src/handlers/vehicles/functions.yml)}
  - ${file(src/handlers/plan/functions.yml)}
```

Cada entrada declara handler, rota, autorizador e as permissões IAM daquela função — `serverless-iam-roles-per-function` garante que uma Lambda só recebe o que ela mesma pede. `package.individually` com `serverless-esbuild` empacota uma por uma.

Endpoint novo, na ordem: schema em `src/schemas/<domínio>` → service em `src/services/<domínio>` → handler em `src/handlers/<domínio>` → entrada no `functions.yml` do domínio. A rota e o formato saem do contrato na spec, nunca de decisão local.

## Esqueleto de handler

```ts
export const execute = withErrorHandling(
  requireRole("owner")(
    async (event, auth): Promise<APIGatewayProxyResult> => {
      const requester = await resolveRequester(auth);
      const vehicleId = event.pathParameters?.vehicleId as string;
      const payload = validateBody(algumSchema, parseRequestBody(event.body));
      return sendSuccessResponse(await algumService(requester, vehicleId, payload));
    },
  ),
);
```

Todo handler segue esse formato. Se um handler está maior que isso, tem regra vazando para dentro dele.

## Jobs

Os jobs vivem em `src/handlers/jobs` e são declarados em `src/handlers/jobs/functions.yml` com o gatilho de cada um — `schedule` para os que rodam por horário, `sqs` para o consumidor da fila. O horário e a cadência são decisão de produto e estão na spec; aqui fica apenas o encanamento.

| Job | Papel |
| --- | --- |
| `recalculateHealthJob` | recalcula os veículos, cria os alertas dos marcos vencidos e publica na fila |
| `sendNotificationsJob` | consome a fila e dispara o push |
| `odometerReminderJob` | cobra leitura de odômetro parada |
| `purgeExpiredJob` | limpa o que passou da retenção |
| `anonymizeAccountsJob` | anonimiza conta que cumpriu o prazo de exclusão |

Local não tem gatilho: rode na mão pelos scripts de `scripts/jobs` (ver [02-Ambiente-Local.md](./02-Ambiente-Local.md)).

## Conexão com o banco

`src/libs/mongo.ts` guarda a conexão em escopo de módulo e reaproveita entre invocações da mesma Lambda quente. `db()` resolve a string de conexão de duas formas: se `DB` já começa com `mongodb`, usa direto; senão trata o valor como nome de parâmetro no SSM. Na primeira conexão do processo ele roda `syncIndexes()` em todos os models.

`withTransaction` abre sessão e envolve a operação — é o que garante o "tudo ou nada" das operações que a spec exige que sejam atômicas. Toda função de repositório aceita `{ session }` para participar da transação.
