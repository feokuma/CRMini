# PoC desktop com Electron

Esta prova de conceito abre o CRM numa janela Electron. A interface e as APIs continuam sendo servidas pelo Next.js localmente; o Electron não transforma o Next em código nativo nem substitui o banco.

## Executar

1. Instale as dependências do projeto com `npm install`.
2. Configure `DATABASE_URL` conforme `.env.example` e inicie o PostgreSQL (por exemplo, `npm run db:up`).
3. Gere a versão de produção com `npm run build`.
4. Execute `npm run desktop`.

O servidor fica limitado a `127.0.0.1:3174`. Esta PoC inicia e encerra o Next.js junto da janela, mas pressupõe que o PostgreSQL esteja disponível. Não empacota instalador, PostgreSQL, nem os dados.

## Limitações / próximos passos

- O banco continua sendo PostgreSQL; SQLite, escolha de local dos dados, backup e migração não fazem parte desta PoC.
- Os logos ainda são gravados em `tmp/assets`, relativo ao diretório de execução. Precisam ser movidos para uma pasta persistente do usuário antes de distribuir o aplicativo.
- A PoC pressupõe que `npm`/Node estejam disponíveis e que o app seja executado a partir do diretório do projeto. Um pacote distribuível requer empacotamento do Next.js e dos recursos, gerenciamento da instância do servidor, configuração do banco e tratamento de atualizações.
- Para uso desktop mais seguro, ainda é necessário revisar a política de segurança do `BrowserWindow`, isolamento/contexto e navegação externa.
