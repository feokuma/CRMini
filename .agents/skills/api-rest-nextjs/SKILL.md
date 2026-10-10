---
name: api-rest-nextjs
description: Mantém endpoints Next.js deste CRM seguros, previsíveis e consistentes.
---

# APIs Next.js do CRM

Use ao criar ou alterar handlers em `src/app/api`.

## Padrões do projeto

- Use Route Handlers do App Router e `NextResponse.json`; os handlers que usam `pg` precisam do runtime Node.js.
- Acesso PostgreSQL passa por `pool` de `@/lib/db`; valores SQL devem ser parametrizados.
- Mantenha mensagens de erro voltadas ao usuário em português e não devolva detalhes internos do banco nem dados pessoais nos erros.

## Implementação

- Inspecione handlers semelhantes e seus consumidores antes de alterar contrato, nomes de campos ou códigos HTTP.
- Trate JSON inválido e corpo com formato inesperado sem deixar exceção não capturada. Valide tipos, comprimentos, formatos e limites no servidor; use lista explícita de campos aceitos.
- Use `400` para entrada inválida, `404` para recurso inexistente, `201` para criação e respostas de erro coerentes com os handlers existentes. Não exponha stack traces.
- Não assuma autenticação/autorização existente: verifique o contexto do projeto. Se adicionar dados sensíveis ou operações privilegiadas sem controles necessários, sinalize a lacuna em vez de sugerir proteção inexistente.
- Use transações para operações que gravem múltiplos registros; sempre faça rollback em falha e libere conexões em `finally`.
- Para listagens, selecione apenas os campos necessários. Evite mudança acidental no formato consumido pela interface.
- Evite logs de payloads. Registre somente contexto técnico mínimo e seguro.

## Verificação

Teste método, entrada inválida, recurso ausente, falhas de banco e formato de resposta, incluindo campos opcionais. Execute `npm run lint` e `npm run build` quando aplicável.
