---
name: crm-testing
description: Planeja e executa testes para fluxos e regras centrais de clientes e contatos.
---

# Testes do CRM

Use ao implementar ou alterar funcionalidades, correções e regras de negócio.

## Contexto

Inspecione `package.json` e testes existentes antes de escolher ferramentas. Atualmente, os scripts incluem `lint` e `build`, mas não declaram uma estrutura de testes dedicada. Não instale dependências sem autorização.

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
- Informe claramente o que foi executado e o que não pôde ser verificado. No estado atual, use `npm run lint` e `npm run build` como verificações disponíveis.
