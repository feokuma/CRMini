# Instruções para agentes

## Projeto e estrutura

- Este repositório contém um CRM em Next.js 15, React 19 e TypeScript, com PostgreSQL acessado via `pg`.
- Páginas e rotas da aplicação ficam em `src/app`; componentes compartilhados em `src/components`; lógica reutilizável em `src/lib`.
- APIs ficam em `src/app/api`. O schema para bancos novos está em `database/init.sql`; alterações para bancos existentes são migrations manuais em `database/migrations`.
- Antes de alterar um fluxo, leia a página/componente, a rota de API e as constraints SQL relacionadas. Não presuma que a validação da interface protege a API.

## Regras de domínio observadas

- Um cliente representa uma empresa; contatos pertencem a um cliente por `client_id`. Nome da empresa e nome do contato são obrigatórios. Outros campos, incluindo aniversário, são opcionais.
- Clientes são desativados (`is_active = false`) em vez de excluídos pela aplicação. Isso preserva o histórico; oportunidades e tarefas também restringem exclusões por suas relações.
- Oportunidades devem apontar para um cliente e um contato daquele mesmo cliente. Os status válidos são `Em andamento`, `Desenvolvimento`, `Proposta`, `Aceite da proposta`, `Ganha` e `Perdida`. Uma oportunidade perdida exige motivo (`Preço`, `Prazo`, `Tecnologia` ou `Solução`); outros status não devem ter motivo de perda. Valores e horas de projeto não podem ser negativos.
- Moedas aceitas no schema são `BRL`, `USD`, `EUR` e `PES`.
- Tarefas devem apontar para cliente e contato correspondentes. Tipos aceitos: `email`, `telefone` e `compromisso`; status: `Aberto` e `Concluído`; assunto não pode ficar vazio.
- A duração de projeto é armazenada em horas: 8 horas por dia, 40 por semana e 160 por mês.
- Não invente regras de unicidade para CNPJ/e-mail, nem assuma que deve existir exatamente um contato principal. Confirme o requisito e avalie dados existentes antes de introduzir restrições.

## Dados, APIs e datas

- Valide entradas no servidor/API e mantenha a interface coerente. Use consultas SQL parametrizadas; não concatene dados recebidos do usuário em consultas.
- Preserve a associação entre cliente e contato em todas as operações. Mudanças que atualizem múltiplos registros relacionados devem usar transação e rollback em caso de falha.
- Em atualizações, não apague nem substitua dados existentes sem que o contrato do endpoint/formulário peça isso explicitamente. Trate campos opcionais e valores vazios de forma consistente com o fluxo existente.
- Datas civis (`DATE`, como aniversário e abertura de oportunidade) não representam instantes e não devem sofrer conversão de fuso. Instantes (`TIMESTAMPTZ`) são persistidos pelo PostgreSQL e apresentados na interface no fuso `America/Sao_Paulo`; preserve essa distinção.
- Não inclua dados pessoais reais em código, fixtures, logs ou testes. Evite expor dados desnecessários nas respostas das APIs.

## Banco de dados

- Para banco novo, `database/init.sql` é aplicado na criação inicial do volume. Migrations em `database/migrations` são manuais e devem ser aplicadas na ordem numérica, uma única vez, a bancos existentes compatíveis.
- Antes de modificar schema ou preparar instruções de migration, confira o schema atual, migrations anteriores e os consumidores da coluna/tabela. Considere os dados existentes e faça backup antes de migrations destrutivas.
- Não aplique comandos ao banco nem remova volumes como parte da tarefa sem autorização explícita. A remoção do volume apaga os dados locais.

## Testes e validação

- O projeto usa testes com o Node.js Test Runner em `tests/*.test.mjs`; execute `node --test tests/*.test.mjs`. Não há atualmente script `npm test` no `package.json`.
- Toda alteração de comportamento ou regra de negócio deve incluir ou atualizar testes automatizados para sucesso, validação e casos-limite relevantes.
- Quando aplicável, valide também com `npm run lint` e `npm run build`. Relate com precisão quais comandos foram executados e seus resultados.
- Para funcionalidades que dependam de banco, prefira testes isolados para a lógica de domínio; não assuma que os testes existentes iniciam serviços externos.

## Princípios de mudança

- Prefira mudanças locais, simples e consistentes com os padrões existentes; evite refatorações não relacionadas.
- Não instale dependências nem faça alterações no sistema fora do repositório sem autorização.
- Atualize `README.md` quando mudar comandos de execução, configuração, migrations ou procedimentos relevantes para quem desenvolve o projeto.
