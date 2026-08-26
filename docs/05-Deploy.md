# Deploy e configuração

> **Escopo:** implementação do repositório `health_car_api` — stages, configuração, segredos e o que precisa existir na AWS.
> **Fonte da verdade do produto:** [`../../docs/03-Backend.md`](../../docs/03-Backend.md) para arquitetura de nuvem e ADRs.

## Comandos

```bash
npm run deploy:dev
npm run deploy:staging
npm run deploy:prod
npm run remove:staging
npm run remove:prod
```

Não existe `remove:dev` de propósito — dev é o ambiente que todo mundo usa e derrubar por engano custa caro.

## Configuração por stage

`serverless.yml` lê `config/${sls:stage}.json`. São quatro arquivos: `local`, `dev`, `staging`, `prod`. O que vai em cada campo:

| Campo | Conteúdo |
| --- | --- |
| `SERVICE`, `REGION` | identificação e região |
| `DB` | string de conexão **ou** o nome de um parâmetro do SSM |
| `ENCRYPTION_KEY` | chave usada por `src/libs/crypto.ts` |
| `USER_POOL_ID`, `CLIENT_ID`, `COGNITO_URL` | Cognito, também usados pelo autorizador JWT |
| `FRONTEND_URL` | origem liberada no CORS |
| `VAPID_*` | credenciais do Web Push |

O truque do `DB` vale para todo segredo: em `local` o valor é literal, nos ambientes de verdade é o **nome** de um parâmetro `SecureString` em `/health_car/<stage>/...`, que `src/libs/ssm.ts` resolve na primeira invocação e mantém em cache. Segredo não entra no repositório.

## Recursos criados pelo deploy

| Arquivo | Recurso |
| --- | --- |
| `resources/s3.yml` | bucket de anexos, com CORS e ciclo de vida |
| `resources/sqs.yml` | fila de notificações e a DLQ |
| `resources/httpApi.yml` | ajustes do HTTP API |

## Permissões

`serverless-iam-roles-per-function` dá a cada Lambda apenas o que ela declara no próprio `functions.yml`. O papel do provider carrega só o mínimo comum — leitura de parâmetro em `/health_car/*`. Função que precisa de S3 ou SQS pede na própria entrada; não adicione permissão no provider para resolver caso isolado.

## Empacotamento

`package.individually` com `serverless-esbuild`: cada função vira um bundle próprio, o que mantém o cold start baixo. `serverless-prune-plugin` guarda as três últimas versões e apaga o resto. Arquitetura `arm64`, runtime Node 24, timeout padrão de 29s — jobs pedem timeout maior na própria entrada.

## Antes do primeiro deploy de um ambiente novo

1. Criar o User Pool no Cognito, o app client e os grupos de papel.
2. Gravar os parâmetros em `/health_car/<stage>/...` no SSM (banco, chave de criptografia, chaves VAPID).
3. Gerar o par de chaves VAPID e usar a pública também no front.
4. Preencher `config/<stage>.json` com os identificadores e os nomes dos parâmetros.
5. Provisionar o cluster do Mongo com replicaSet — sem ele as transações falham.

Só então `npm run deploy:<stage>`.

## Depois do deploy

- `GET /v1/status` responde sem tocar no banco: serve de sonda rápida.
- A primeira invocação de cada função sincroniza os índices do Mongo; se o log mostrar `index sync failed`, o índice existente diverge do model e precisa ser resolvido à mão.
- Log fica 30 dias (`logRetentionInDays`).
