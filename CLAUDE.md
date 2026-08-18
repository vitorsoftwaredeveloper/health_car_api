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
docker compose up -d     # Mongo com replicaSet (transações)
npm install
npm run seed:catalog
npm run dev              # nodemon + serverless-offline
npm test
npm run typecheck
```
