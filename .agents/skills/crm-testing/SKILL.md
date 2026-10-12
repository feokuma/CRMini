---
name: crm-testing
description: Exige testes automatizados e testes Vitest para toda regra de negócio nova ou alterada neste CRM.
---

# Testes do CRM

Use em toda implementação, correção, refatoração ou mudança de comportamento neste projeto. Testes automatizados são critério obrigatório de conclusão, não uma etapa opcional nem substituível por lint, build ou revisão manual.

## Contexto

Inspecione `package.json` e os testes existentes antes de escolher ferramentas. O projeto usa Vitest e React Testing Library para testes automatizados. `npm test` executa a suíte completa; `npm run test:components` mantém um alias para Vitest.

## Regra de cobertura obrigatória

- Antes de implementar, identifique os comportamentos alterados e registre cenários verificáveis de sucesso, erro/validação e limites relevantes.
- Crie ou atualize testes automatizados que verifiquem o comportamento observável junto com cada mudança funcional. Não encerre a tarefa com comportamento alterado sem cobertura correspondente.
- Sempre que uma regra de negócio for adicionada ou alterada, crie ou atualize obrigatoriamente testes unitários com Vitest, junto ao módulo correspondente (por exemplo, `src/lib/nome-da-regra.test.ts`). Faça isso na mesma alteração do código. Testes Node.js existentes não substituem essa cobertura Vitest; atualize-os também quando necessário para manter a suíte legada coerente.
- Cubra o comportamento normal, entradas inválidas e casos-limite relevantes da regra, incluindo resultados de sucesso e falha. Prefira testar a lógica pela interface pública do módulo.
- Em testes que verificam formatos com regex, use constantes nomeadas pelo conteúdo que o padrão aceita ou filtra; mantenha as chamadas encadeadas em linhas separadas para facilitar leitura.
- Para defeitos, inclua teste de regressão que reproduza o problema; confirme que falha antes da correção quando possível.
- Se não for possível testar por limitação concreta, não alegue cobertura nem conclusão plena: explique o bloqueio e peça decisão ao usuário antes de entregar trabalho parcial.

## Cobertura orientada a risco

- Clientes: listar/pesquisar, criar, editar e excluir; nome obrigatório e dados opcionais.
- Contatos: associar ao cliente correto, listar/pesquisar, aniversário opcional e contato principal.
- API: JSON inválido, entrada incompleta, valores malformados, recurso ausente, falha de banco, status e formato de resposta.
- Banco: transações em gravações relacionadas, rollback em erro e integridade da relação cliente-contato.
- Interface: validação, preservação dos valores após falha, estados de carregamento/erro e acessibilidade básica.
- Privacidade: respostas e logs não devem expor campos desnecessários ou segredos.

## Boas práticas

- Escreva testes determinísticos, isolados e sem dados reais. Não dependa de serviços externos nem de um banco compartilhado sem configuração explícita.
- Prefira reproduzir a falha com um teste antes de corrigir. Cubra o comportamento observável, não detalhes de implementação frágeis.
- Não altere scripts ou adicione ferramentas de teste como efeito colateral sem necessidade e aprovação quando exigir instalação.
- Execute `npm test` após mudanças cobertas; execute também lint/build quando aplicável. Informe testes adicionados/atualizados, comandos executados e falhas ou limitações sem alegar execução que não ocorreu.
