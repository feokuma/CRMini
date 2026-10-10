---
name: test-coverage-required
description: Exige testes automatizados para todo comportamento novo ou alterado neste projeto.
---

# Cobertura obrigatória de implementação

Use em toda implementação, correção, refatoração que altere comportamento ou mudança em regras de negócio. Nenhuma alteração funcional está concluída sem testes automatizados que cubram o comportamento novo ou modificado.

## Requisito obrigatório

- Antes de implementar, identifique os comportamentos afetados e os cenários de sucesso, validação e falha relevantes. Transforme-os em testes automatizados reproduzíveis.
- Escreva ou atualize testes junto com cada alteração funcional. Não considere lint, build, revisão manual ou um teste apenas existente como substitutos para cobertura do comportamento alterado.
- Para correções de defeitos, adicione um teste de regressão que falhe antes da correção e passe depois dela, sempre que viável.
- Cubra regras de negócio e casos-limite importantes; priorize comportamento observável e evite testes frágeis presos a detalhes internos.
- Se uma alteração afetar API, banco e interface, teste as camadas relevantes e ao menos os fluxos de integração afetados. Isole testes de dependências externas e nunca use dados pessoais reais.
- Não reduza, remova ou enfraqueça testes existentes para fazer uma implementação passar sem justificativa explícita e validada.

## Fluxo de trabalho

1. Inspecione os testes, `package.json` e as convenções do repositório.
2. Defina critérios de aceitação testáveis para a mudança.
3. Implemente testes automatizados apropriados e a alteração funcional.
4. Execute os testes afetados e a suíte relevante; execute também lint/build quando aplicável.
5. Informe quais testes foram adicionados e quais comandos foram executados.

## Quando não houver infraestrutura adequada

- Não declare a implementação coberta nem concluída sem testes automatizados.
- Escolha uma abordagem compatível com o stack e com o escopo. Não instale dependências nem altere configuração de ferramentas sem autorização explícita.
- Se for necessária uma nova dependência ou decisão de infraestrutura, explique o bloqueio e solicite aprovação antes de prosseguir sem cobertura. Se o usuário autorizar uma implementação parcial, registre claramente os comportamentos ainda sem testes.
- Não invente que testes foram executados; diferencie testes escritos de testes efetivamente executados e reporte limitações do ambiente.

## Contexto deste repositório

O `package.json` atualmente declara `lint` e `build`, mas não um runner ou script de testes. Portanto, confirme a infraestrutura disponível antes de executar comandos de teste e proponha a configuração necessária quando apropriado. O skill `crm-testing` contém cenários de domínio úteis; use-o em conjunto com este requisito, que torna a cobertura obrigatória para todas as implementações.
