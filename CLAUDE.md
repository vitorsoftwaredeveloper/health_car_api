# CLAUDE.md — HealthCar · API (`health_car_api`)

> Este repositório é **só código**. A especificação do produto vive um nível acima, no diretório compartilhado `HealthCar/`, e é a mesma para a API e para o front. A documentação **de implementação** desta API vive aqui, em [`docs/`](./docs).

## Onde procurar cada coisa

| Onde | O quê |
| --- | --- |
| [`docs/`](./docs) | **Implementação desta API**: arquitetura, ambiente local, convenções, testes, deploy |
| [`../CLAUDE.md`](../CLAUDE.md) | Contexto do produto, stack, regra crítica de vencimento, decisões travadas |
| [`../docs/03-Backend.md`](../docs/03-Backend.md) | Contrato da API, motor de regras, jobs, ADRs |
| [`../docs/04-Banco-de-Dados.md`](../docs/04-Banco-de-Dados.md) | Coleções, catálogo, índices |
| [`../docs/06-Backlog.md`](../docs/06-Backlog.md) | Backlog, estimativas, sprints |
| [`../.agents/skills/`](../.agents/skills) | Skills do projeto (caveman, perfil `ultra`) |

**Leia `../CLAUDE.md` antes de codar.** Regra de negócio, contrato e decisão de produto moram na spec; nada disso se repete aqui. A fronteira entre os dois lados e o guarda que a mantém estão em [`docs/README.md`](./docs/README.md).

## Regras deste repositório

- **Zero comentários** em qualquer arquivo de código, em nenhuma hipótese.
- Camadas: `handler` (só orquestra) → `service` (regra + autorização de recurso + transação) → `repository` (só dados). `domain/` é puro, sem I/O, cobertura **100%** exigida pelo Jest.
- Identificador técnico em **inglês**; mensagem de erro em português.
- Dinheiro em centavos inteiros, só em `maintenanceEvents`.
- Modo de resposta: caveman nível `ultra` (ver `../CLAUDE.md` §0).

Detalhe de cada uma em [`docs/03-Convencoes.md`](./docs/03-Convencoes.md).

## Rodar

```bash
npm install
npm run local:up         # Mongo (replicaSet auto) + LocalStack (S3, SQS, SSM)
npm run seed             # catálogo + template genérico
npm run dev              # nodemon + serverless-offline em http://localhost:4000
npm test                 # unitários (domínio 100%, services mockados)
npm run test:integration # fluxos críticos contra o Mongo do docker
npm run typecheck
npm run docs:check       # consistência da documentação
```

Ambiente local em detalhe — LocalStack, autenticação de desenvolvimento, jobs na mão e problemas conhecidos — em [`docs/02-Ambiente-Local.md`](./docs/02-Ambiente-Local.md).
