# Testes

> **Escopo:** implementação do repositório `health_car_api` — como os testes são escritos e o que eles precisam cobrir.
> **Fonte da verdade do produto:** [`../../docs/03-Backend.md`](../../docs/03-Backend.md) para as regras que os testes verificam e [`../../docs/06-Backlog.md`](../../docs/06-Backlog.md) para a definição de pronto.

## Comandos

```bash
npm test                  # unitários, com cobertura
npm run test:integration  # fluxos críticos contra o Mongo do docker
npm run test:all          # os dois
npm run typecheck
```

`npm test` usa `jest.config.js`; a integração usa `jest.integration.config.js` com `--runInBand`, porque os testes compartilham o mesmo banco e não podem correr em paralelo. A integração exige `npm run local:up` antes.

## Duas suítes, dois objetivos

| Suíte | Onde | Fala com o banco | Serve para |
| --- | --- | --- | --- |
| Unitária | `__tests__/services`, `__tests__/domain` | não, tudo mockado | prender a regra: o que decide, o que recusa, o que grava |
| Integração | `__tests__/integration` | sim | provar que transação, índice e concorrência se comportam de verdade |

## Cobertura

`src/domain` tem `coverageThreshold` de 100% no Jest — linha, branch, função e statement. É proposital: domínio é função pura, não tem desculpa para caminho não testado, e é ali que mora o cálculo que o produto inteiro depende.

O resto do código não tem piso numérico, mas service novo sem teste não passa em revisão.

## Estilo de teste unitário

Os mocks vêm antes dos imports, porque o Jest iça as chamadas de `jest.mock`:

```ts
jest.mock("../../src/repositories/planItem.repository", () => ({
  planItemRepository: { find: jest.fn(), updateOne: jest.fn() },
}));
jest.mock("../../src/services/vehicles/access.service", () => ({
  assertVehicleAccess: jest.fn(),
}));

import { planItemRepository } from "../../src/repositories/planItem.repository";
```

Três hábitos que valem para todos os arquivos:

1. **Mocke a fronteira, não o alvo.** Testando um service, mocke repositórios, `withTransaction` e outros services — nunca o próprio service.
2. **Fixture como função.** `const event = (overrides = {}) => ({ ...padrão, ...overrides })` deixa cada teste declarar só o que importa para ele.
3. **Verifique o argumento, não só o retorno.** Boa parte dos bugs de regra aparece no filtro ou no `$set` que foi para o repositório, e não no valor devolvido.

`withTransaction` é mockado executando a operação com uma sessão de mentira:

```ts
jest.mock("../../src/libs/mongo", () => ({
  withTransaction: jest.fn((operation: any) => operation({ id: "session" })),
}));
```

Isso mantém o teste rápido, mas **não** prova atomicidade — quem prova é a suíte de integração.

## O que sempre merece teste

- Recusa: item de outro veículo, data no futuro, papel sem permissão, duplicidade.
- Efeito colateral: o que mais foi gravado além do óbvio — leitura de odômetro vinculada, alerta fechado, anexo religado.
- Idempotência e ciclo: operação que não pode disparar duas vezes no mesmo ciclo.
- O caminho de reversão: o que acontece quando o registro é desfeito.

## Antes de abrir PR

```bash
npm run typecheck && npm test && npm run docs:check
```

Mexeu em transação, índice ou concorrência, rode também `npm run test:integration`.
