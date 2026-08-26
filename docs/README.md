# Documentação da API

> **Escopo:** implementação do repositório `health_car_api` — como este código está organizado, como rodar, testar e publicar.
> **Fonte da verdade do produto:** [`../../docs/03-Backend.md`](../../docs/03-Backend.md) e os demais arquivos de [`../../docs/`](../../docs). Se algo aqui divergir da spec, a spec vence.

## Índice

| Arquivo | O que responde |
| --- | --- |
| [01-Arquitetura.md](./01-Arquitetura.md) | Como um request atravessa o código, o que cada camada pode fazer, como as funções são compostas |
| [02-Ambiente-Local.md](./02-Ambiente-Local.md) | Docker, LocalStack, autenticação de desenvolvimento, jobs na mão, problemas conhecidos |
| [03-Convencoes.md](./03-Convencoes.md) | Validação, erros, resposta HTTP, repositórios, transações, datas e dinheiro |
| [04-Testes.md](./04-Testes.md) | Unitário e integração, estilo de mock, o que exige cobertura total |
| [05-Deploy.md](./05-Deploy.md) | Stages, configuração, segredos, IAM, o que precisa existir antes do primeiro deploy |

## Fronteira: o que mora aqui e o que mora na spec

O produto tem dois repositórios de código (`health_car_api` e `health_car`) e um diretório de especificação compartilhada (`HealthCar/docs`). A regra que impede documentação dissonante é uma só:

**Regra de fonte única.** Cada fato tem um dono. Quem não é dono **cita**, nunca repete.

| Assunto | Dono | Exemplos |
| --- | --- | --- |
| Produto, personas, escopo, decisões | `../../docs/00-Visao-Produto-PRD.md` e `../../CLAUDE.md` | limite de veículos por conta, papéis, o que fica fora do MVP |
| Regra de negócio | `../../docs/03-Backend.md` | como um item vence, cálculo da saúde, marcos de alerta, ciclo |
| Contrato da API | `../../docs/03-Backend.md` | rotas, payloads, códigos de erro do domínio |
| Modelo de dados | `../../docs/04-Banco-de-Dados.md` | coleções, índices, retenção |
| Prioridade e prazo | `../../docs/06-Backlog.md` | épicos, estimativas, sprints |
| **Implementação desta API** | **este diretório** | camadas, nomes de arquivo, como rodar, como testar, como publicar |

Na prática: se a frase continuaria verdadeira caso a API fosse reescrita em outra linguagem, ela é da spec. Se ela morre junto com este código, é daqui.

## Como manter alinhado

```bash
npm run docs:check
```

O script [`scripts/docs-check.mjs`](../scripts/docs-check.mjs) reprova quando:

1. um documento não declara escopo e fonte da verdade no cabeçalho;
2. um link relativo aponta para arquivo que não existe — inclusive os que entram na spec compartilhada, o que pega renomeação do outro lado;
3. um documento deste repositório repete fato que pertence à spec, em vez de linkar;
4. o índice acima não lista algum arquivo de `docs/`.

Rode antes de abrir PR que mexe em documentação. Quando a spec muda uma regra, nada aqui precisa mudar — é justamente o objetivo de não repetir.
