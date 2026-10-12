---
name: test-coverage-required
description: Exige testes automatizados para todo comportamento novo ou alterado, incluindo testes Vitest para regras de negócio.
---

# Cobertura obrigatória de implementação

Use em toda implementação, correção, refatoração que altere comportamento ou mudança em regras de negócio. Nenhuma alteração funcional está concluída sem testes automatizados que cubram o comportamento novo ou modificado.

## Requisito obrigatório

- Antes de implementar, identifique os comportamentos afetados e os cenários de sucesso, validação e falha relevantes. Transforme-os em testes automatizados reproduzíveis.
- Escreva ou atualize testes junto com cada alteração funcional. Não considere lint, build, revisão manual ou um teste apenas existente como substitutos para cobertura do comportamento alterado.
- Sempre que adicionar ou alterar uma regra de negócio, escreva ou atualize testes unitários Vitest na mesma mudança, próximos ao módulo que implementa a regra. Cubra sucesso, validação/falha e limites relevantes. Testes de outro runner não substituem os testes Vitest exigidos para essas regras.
- Para componentes React, prefira testes Vitest + React Testing Library em arquivos próximos ao componente ou página. Preserve e atualize testes existentes em outros runners quando continuarem relevantes.
- Para correções de defeitos, adicione um teste de regressão que falhe antes da correção e passe depois dela, sempre que viável.
- Cubra regras de negócio e casos-limite importantes; priorize comportamento observável e evite testes frágeis presos a detalhes internos.
- Em código de validação coberto pelos testes, mantenha padrões regex em constantes nomeadas pelo conteúdo validado/filtrado e formate chamadas encadeadas com uma chamada por linha.
- Se uma alteração afetar API, banco e interface, teste as camadas relevantes e ao menos os fluxos de integração afetados. Isole testes de dependências externas e nunca use dados pessoais reais.
- Não reduza, remova ou enfraqueça testes existentes para fazer uma implementação passar sem justificativa explícita e validada.

## Fluxo de trabalho

1. Inspecione os testes, `package.json` e as convenções do repositório.
2. Defina critérios de aceitação testáveis para a mudança.
3. Implemente testes automatizados apropriados e a alteração funcional.
4. Execute os testes afetados e `npm test`; execute também lint/build quando aplicável.
5. Informe quais testes foram adicionados e quais comandos foram executados.

## Quando não houver infraestrutura adequada

- Não declare a implementação coberta nem concluída sem testes automatizados.
- Escolha uma abordagem compatível com o stack e com o escopo. Não instale dependências nem altere configuração de ferramentas sem autorização explícita.
- Se for necessária uma nova dependência ou decisão de infraestrutura, explique o bloqueio e solicite aprovação antes de prosseguir sem cobertura. Se o usuário autorizar uma implementação parcial, registre claramente os comportamentos ainda sem testes.
- Não invente que testes foram executados; diferencie testes escritos de testes efetivamente executados e reporte limitações do ambiente.

## Contexto deste repositório

O projeto usa Vitest + React Testing Library para testes de lógica e componentes. `npm test` executa a suíte completa, e `npm run test:components` mantém um alias para Vitest. O skill `crm-testing` contém cenários de domínio úteis e detalha a cobertura específica obrigatória para regras de negócio.
