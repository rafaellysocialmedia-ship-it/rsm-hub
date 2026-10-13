# Calendário: dia atual e preservação funcional — 13/10/2026

## Alterações

- Mesmo calendário, editor, banco e rotas. Os RPCs de reagendamento, revisão e conflito não foram substituídos.
- Dia atual calculado no fuso de workspace_settings, atualizado a cada segundo e ao retornar à aba. Círculo #42145d, texto Hoje e fundo lilás suave. Seleção de data usa contorno separado.
- Botão Hoje mantém filtros e retorna ao período atual em mês/semana/dia/lista. Sem navegação anterior, o período inicial usa o fuso configurado; a preferência anterior permanece válida.
- Visão diária adicionada às visualizações existentes. Dias adjacentes à grade mensal também mostram os registros correspondentes.
- Clientes identificados por etiquetas com cores estáveis nos posts e tarefas. As etiquetas não capturam ponteiro; miniaturas não iniciam arraste de imagem isolada.
- Cartão completo mantém o arraste, com a data e horário persistidos pelo RPC existente. Soltar nas setas move ao mesmo dia no período anterior/seguinte. Datas inválidas e conflitos continuam sujeitos às proteções existentes. No fim de um mês, a operação usa o último dia válido do mês seguinte, conforme date-fns.
- Seleção simultânea de clientes; busca, responsável, canal, formato e status preservados. Preferências antigas com um único cliente continuam funcionando.
- Botão + por dia reutiliza o editor global, preenchendo data e cliente quando o contexto é inequívoco. A nova publicação também pode ser minimizada e mantida ao navegar; após salvar, passa a editar o registro criado, evitando duplicatas em salvamentos seguintes.
- Criação verifica a ação existente social.calendar/create na interface e em uma política RLS restritiva. Sem nova hierarquia de cargos.
- Tarefas: apenas etiqueta visual compartilhada alterada; sensores, arraste do quadro, edição, filtros e recorrências existentes foram preservados.

## Verificação

- TypeScript: passou.
- `node tests/calendar-period.ts`: passou. Virada de meia-noite em Fortaleza, outro fuso, período Hoje em quatro visões, mudanças de semana/mês/ano, fevereiro bissexto, filtro multicliente e compatibilidade da seleção salva.
- `node tests/calendar-draft.ts`: passou. Mesclagem de reagendamento mantém os campos do rascunho e respeita nova revisão.
- Transações SQL revertidas: criação com data atual, mudança para amanhã e outro mês, leitura da data persistida e manutenção do horário; criação por cliente bloqueada no servidor. A função/política de criação foi aplicada e sua existência confirmada.
- O script SQL combinado encontrou erro `Invalid or expired requestState` no conector. Os casos principais acima foram executados em transações menores. Não considerar o script combinado integralmente executado.
- Advisor sem novos alertas relativos à mudança.

## Verificação manual obrigatória ainda pendente

Não houve navegador de QA disponível pelo fluxo da skill Sites nesta sessão. Portanto, testes de lógica, compilação e banco não são prova de execução dos gestos de interface. Conferir: arrastar hoje→amanhã; soltar nas setas entre períodos; abrir, editar e navegar mantendo o painel; voltar por Hoje; alternar mês/semana/dia/lista; selecionar clientes juntos; atualizar e conferir dados/preferências; teclado/celular.
