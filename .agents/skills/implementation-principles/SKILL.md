---
name: implementation-principles
description: Orienta implementações simples, concisas, reutilizáveis e alinhadas ao SOLID quando fizer sentido.
---

# Princípios de implementação

Use ao planejar, implementar ou refatorar código neste projeto.

## Simplicidade primeiro

- Prefira a solução mais simples que atenda aos requisitos atuais com clareza e segurança.
- Mantenha funções, módulos e mudanças focados; evite complexidade, camadas, abstrações e configuração sem benefício concreto.
- Não antecipe requisitos hipotéticos. Uma implementação pequena e explícita costuma ser melhor que uma estrutura genérica prematura.
- Escreva código conciso, mas não sacrifique legibilidade, tratamento correto de erros ou validação para reduzir linhas.

## Reutilização sem duplicação

- Antes de adicionar lógica, procure padrões e utilitários existentes que resolvam o mesmo problema.
- Reutilize código quando houver comportamento ou regra realmente compartilhados; mantenha uma única fonte para regras comuns.
- Evite copiar e colar lógica que possa divergir com o tempo, mas não force uma abstração para trechos apenas superficialmente parecidos ou que provavelmente evoluirão de formas distintas.
- Ao extrair uma abstração, dê-lhe nome e responsabilidade claros e mantenha-a no menor escopo compartilhado necessário.

## SOLID de forma pragmática

- **Responsabilidade única:** mantenha cada função ou módulo focado em uma razão principal para mudar.
- **Aberto/fechado:** estenda comportamento por composição ou pontos de extensão existentes quando isso reduzir mudanças repetidas; não crie extensibilidade sem necessidade real.
- **Substituição de Liskov:** implementações substitutas devem respeitar o contrato esperado; prefira composição quando hierarquias complicarem o comportamento.
- **Segregação de interfaces:** não obrigue consumidores a depender de operações que não usam; mantenha contratos pequenos e pertinentes.
- **Inversão de dependência:** desacople regras centrais de detalhes externos quando isso facilitar manutenção ou testes, sem introduzir contêineres ou camadas desnecessárias.

SOLID é orientação, não checklist: aplique um princípio quando resolver um problema concreto. Não crie classes/interfaces só para demonstrar adesão, nem transforme código simples em arquitetura excessiva.

## Ao alterar o projeto

- Inspecione o código vizinho e respeite convenções existentes antes de introduzir novos padrões.
- Prefira mudanças locais e compatíveis com os contratos existentes; evite refatoração não relacionada ao pedido.
- Considere legibilidade para a próxima pessoa que manterá o código, incluindo nomes claros e comentários apenas quando explicarem contexto não óbvio.
- Preserve ou adicione testes automatizados para comportamentos afetados, conforme a skill `test-coverage-required`.
- Ao final, resuma decisões relevantes e qualquer duplicação ou complexidade mantida intencionalmente.
