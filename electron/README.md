# PoC desktop com Electron

Esta prova de conceito abre o CRM numa janela Electron. A interface e as APIs continuam sendo servidas pelo Next.js localmente; o Electron não transforma o Next em código nativo nem substitui o banco.

## Desenvolvimento

Execute o CRM em modo desktop com o servidor de desenvolvimento do Next.js:

```bash
npm run desktop:dev
```

O Electron inicia `next dev`; alterações no código são refletidas sem gerar um novo build. Encerre outras instâncias do CRM antes de iniciar, pois a aplicação usa a porta `3174`.

## Executar a versão de produção

1. Instale as dependências do projeto com `npm install`.
2. Gere a versão de produção com `npm run build`.
3. Execute `npm run desktop`.

O servidor fica limitado a `127.0.0.1:3174`. Esta PoC inicia e encerra o Next.js junto da janela. Ao iniciar, escolha usar o banco padrão (`app.getPath('userData')/crm.sqlite`), abrir banco existente ou criar/selecionar um arquivo. Arquivos não vazios precisam conter as tabelas do CRM; arquivos novos recebem o schema automaticamente. Para trocar o banco, encerre e reabra o aplicativo. O banco antigo `database/crm.sqlite` é copiado por backup SQLite para o padrão apenas se ele ainda não existir; a origem é preservada. Para backup, encerre o app antes de copiar o arquivo, ou use a API SQLite de backup.

## Limitações / próximos passos

- Os logos ainda são gravados em `tmp/assets`, relativo ao diretório de execução. Precisam ser movidos para uma pasta persistente do usuário antes de distribuir o aplicativo.
- A PoC pressupõe que `npm`/Node estejam disponíveis e que o app seja executado a partir do diretório do projeto. Um pacote distribuível requer empacotamento do Next.js e dos recursos, gerenciamento da instância do servidor e tratamento de atualizações.
- Para uso desktop mais seguro, ainda é necessário revisar a política de segurança do `BrowserWindow`, isolamento/contexto e navegação externa.
