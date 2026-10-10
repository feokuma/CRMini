---
name: crm-ui-accessibility
description: Mantém as telas e formulários do CRM acessíveis, responsivos e consistentes.
---

# Interface acessível do CRM

Use ao criar ou modificar telas, componentes e formulários.

## Orientações

- Inspecione os componentes e estilos existentes antes de editar; reutilize padrões visuais e componentes já usados no projeto.
- Associe cada campo a um `label` programático; não use placeholder como único rótulo. Indique campos obrigatórios e erros em texto, associados ao controle (`aria-describedby` quando adequado).
- Garanta operação por teclado, foco visível, ordem de foco lógica e nomes acessíveis para botões e ícones. Não dependa apenas de cor para comunicar estado.
- Use elementos HTML semânticos; mantenha contraste legível, zoom e layout utilizável em telas estreitas.
- Para ações assíncronas, comunique carregamento, sucesso e falha; evite enviar formulários repetidamente e preserve dados preenchidos após erros quando possível.
- Confirme antes de ações destrutivas. Não altere campos ou fluxo de dados pessoais além do necessário à tarefa.
- Preserve linguagem clara em português e formato compreensível para datas, telefones e demais dados locais, respeitando os dados existentes.

## Verificação

Revise navegação por teclado, rótulos, erros, estados de carregamento e comportamento responsivo. Execute lint/build e testes disponíveis; verifique manualmente os fluxos importantes.
