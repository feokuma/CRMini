---
name: lgpd-privacy
description: Reduz riscos de privacidade e exposição de dados pessoais ao desenvolver o CRM.
---

# Privacidade e dados pessoais

Use ao coletar, armazenar, consultar, exibir, registrar em logs, exportar ou remover dados de clientes e contatos.

## Princípios práticos

- Trate nomes, e-mails, telefones, aniversários, notas e identificadores como dados potencialmente pessoais ou confidenciais.
- Colete e exponha somente os campos necessários ao fluxo solicitado. Antes de ampliar uma resposta de API, verifique quem a consome e se todos os campos são necessários.
- Não inclua dados pessoais, tokens, credenciais ou conteúdo de notas em logs, mensagens de erro, exemplos, fixtures ou dados de demonstração.
- Use consultas parametrizadas (como `pool.query` com parâmetros); nunca concatene entrada do usuário em SQL.
- Valide entradas no servidor e restrinja campos graváveis para evitar atribuição arbitrária de propriedades.
- Não prometa anonimização, consentimento, retenção, exclusão legal ou conformidade integral com a LGPD sem requisitos e implementação comprováveis. Encaminhe decisões legais/de produto para responsáveis apropriados.
- Não crie coleta de consentimento, analytics ou transmissão a terceiros como suposição.
- Ao implementar exportação, correção ou exclusão, considere dados relacionados, cópias e impactos de integridade; documente limitações em vez de alegar remoção total sem verificá-la.

## Revisão

Para cada mudança, identifique dados afetados, finalidade funcional, acesso/exposição e retenção. Inclua testes para impedir vazamento de campos e valide erros sem conteúdo sensível. Esta skill é orientação de desenvolvimento, não aconselhamento jurídico.
