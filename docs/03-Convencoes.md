# Convenções de código

> **Escopo:** implementação do repositório `health_car_api` — padrões que todo arquivo daqui segue.
> **Fonte da verdade do produto:** [`../../CLAUDE.md`](../../CLAUDE.md) para as convenções que valem nos dois repositórios, [`../../docs/03-Backend.md`](../../docs/03-Backend.md) para o contrato.

## Inegociáveis

- **Zero comentários.** Nenhum `//`, nenhum `/* */`, nenhum JSDoc. O nome da função, o nome da variável e o teste explicam.
- **Identificador em inglês, mensagem de erro em português.** Coleção, campo, enum, rota, função e variável em inglês; o que chega ao usuário, em português.
- **Camadas não se misturam.** Ver [01-Arquitetura.md](./01-Arquitetura.md).
- **Dinheiro em centavos inteiros.** Nunca `float`, nunca `Decimal128`.

## Validação de entrada

Uma rota, um schema, em `src/schemas/<domínio>/<operação>.schema.ts`, tipado com `JSONSchemaType<T>` do `ajv` a partir do payload que o service declara:

```ts
export const algumSchema: JSONSchemaType<AlgumPayload> = {
  type: "object",
  additionalProperties: false,
  properties: { ... },
  required: [...],
};
```

`additionalProperties: false` é padrão — campo desconhecido é erro, não silêncio. O handler chama `validateBody(schema, parseRequestBody(event.body))`; falha vira `400 VALIDATION_ERROR` com os erros do ajv em `details`.

Schema valida **formato**. Regra de negócio — se o valor faz sentido para aquele veículo, se o item pertence à conta — é do service.

## Erros

```ts
throw httpError(STATUS_CODE.NOT_FOUND, "PLAN_ITEM_NOT_FOUND", "Item do plano não encontrado.");
```

`httpError` monta o erro; `withErrorHandling` no handler captura, registra e devolve. O corpo sai sempre no mesmo formato:

```json
{ "error": { "code": "PLAN_ITEM_NOT_FOUND", "message": "Item do plano não encontrado.", "details": [] } }
```

O código é estável e o front pode ramificar por ele; a mensagem é para gente ler. Quando o erro não traz código, `sendErrorResponse` deriva um a partir do status.

Erro não tratado vira `500 INTERNAL_SERVER_ERROR` com mensagem genérica — nada de vazar `stack` ou detalhe de banco na resposta.

## Resposta de sucesso

`sendSuccessResponse(data, statusCode)` embrulha tudo em `{ "data": ... }` e aplica os cabeçalhos de segurança (`nosniff`, `no-store`, `Referrer-Policy`, HSTS). `204` sai com corpo vazio. Criação devolve `201`.

## Repositórios

Todo repositório é uma linha, criada por `createInstanceMongoose` em [`../src/repositories/base.ts`](../src/repositories/base.ts):

```ts
export const planItemRepository = createInstanceMongoose<PlanItemDocument>("PlanItem", planItemSchema);
```

A base garante três coisas: `db()` chamado antes de qualquer operação, leitura sempre `lean` e a mesma assinatura em todos os métodos (`filter`, `data`, `options`). Consulta que precisa entrar em transação recebe `{ session }` no `options`.

Não existe repositório com método de negócio. `findOverdueItemsForAccount` é regra; ela mora no service, montando o filtro.

## Transações

```ts
return withTransaction(async (session) => {
  await algumRepository.updateOne(filtro, dados, { session });
  await outroRepository.insertOne(dados, { session });
  return resultado;
});
```

Toda escrita que participa da operação precisa receber a `session` — repositório chamado sem ela grava fora da transação e quebra o "tudo ou nada" em silêncio.

## Datas

`src/utils/date.ts` concentra o fuso. `parseLocalDate("2026-08-15")` devolve o instante que corresponde à meia-noite local, e `today()` devolve o início do dia local. Nunca use `new Date(string)` direto para data enviada pelo cliente: o resultado muda de dia dependendo do fuso do servidor.

Comparação de vencimento é por dia local, nunca por milissegundo.

## Autorização de recurso

Papel é verificado no handler, com `requireRole("owner")`. Dono do recurso é verificado no service, com `assertVehicleAccess(requester, vehicleId, "read" | "write" | "manage")`, que devolve o veículo já carregado. Um service que recebe `vehicleId` sem passar por essa função é um vazamento de dados entre contas esperando para acontecer.

## Idioma dos testes

Nome de teste em português, descrevendo comportamento observável: `it("recusa item de plano de outro veículo")`. O teste é a documentação da regra — ver [04-Testes.md](./04-Testes.md).
