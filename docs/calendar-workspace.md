# Calendário: editor persistente e reagendamento

Implementação de 12/10/2026 no projeto RSM existente. Mesmas tabelas `posts`, `post_files`, comentários, aprovações e projeção segura `portal_posts`.

## Implementado

- Densidade compacta/padrão/ampliada e recolhimento dos filtros em `navigation_preferences`, por usuário e com RLS. Chips dos filtros permanecem visíveis; filtros e período são preservados na sessão, separados por usuário/conta. Sidebar mantém a preferência existente.
- Calendário mensal/semanal, lista e grade existentes. Limite por célula e lista completa do dia; miniaturas, horário e status textual. Grade adapta à largura útil, inclusive com o editor aberto.
- Editor existente montado no AppShell, independente da rota. Edição do calendário e ação Editar dos detalhes usam esse editor. Pode minimizar, restaurar e fechar; campos e DOM do editor permanecem montados ao minimizar. Publicação e conta originais são fixas.
- Confirmação Salvar / Descartar alterações / Continuar editando para campos não salvos. Comentários ainda não enviados precisam ser enviados ou limpos antes de fechar/trocar. Fechar a aba com rascunho solicita confirmação do navegador; não há salvamento automático ou persistência do rascunho após fechar a aba.
- Salvar usa bloqueio de linha e versão `updated_at`; conflito conserva os campos e oferece carregar a versão atual mediante descarte explícito. Sem sobrescrita silenciosa.
- Mídias são salvas imediatamente, com retorno da versão atual. Adicionar/substituir/remover/reordenar utiliza os mesmos registros; arquivos das versões anteriores não são excluídos. Ordem e horário entram nos novos snapshots de aprovação.
- Arraste no desktop e ação Mover data para teclado/celular, com horário explícito. Mês e semana atuais não têm grade de horas: arraste preserva o horário, no fuso existente de `workspace_settings`. Não existe configuração de fuso por cliente no modelo atual.
- Atualização pessimista: a posição só muda quando o servidor confirma. Desfazer exige a versão resultante da mudança; alterações posteriores impedem sobrescrita. Reagendamento de um post aberto mescla data/status/versão e mantém os outros campos do rascunho.
- Publicados e datas passadas são bloqueados no servidor. Agendamentos com origem externa são bloqueados até haver integração de reagendamento; não é apresentado sucesso externo fictício. A rotina legada de cron que publicava ou movia datas apenas pelo relógio foi desativada.
- Permissão existente `social.calendar/edit`, fallback legado e regras de visibilidade aplicados via RLS e RPC. Clientes mantêm a revisão segura existente com comentários/aprovação autorizados. Revogação de edição não descarta o rascunho.
- Histórico de alteração de data em `post_schedule_events`, com ator autenticado, valores anteriores/novos, fuso e momento. Regras existentes de nova aprovação continuam ativas.
- Responsável continua vinculado pelas tarefas existentes; não foi inventado um novo campo de atribuição no post. Há ação de criar tarefa vinculada, conforme a permissão existente.

## Validação realizada

- `npx tsc --noEmit` e build de produção.
- `node tests/calendar-draft.ts`: preservação de legenda/título/conta e horário em edição ao reconciliar arraste, mídia e nova aprovação.
- `tests/calendar-workspace.sql`, em transação revertida: administrador, equipe autorizada e equipe bloqueada, cliente sem escrita, RLS entre contas, reagendamento, preservação do horário, desfazer, conflito, data passada, publicado, origem externa, auditoria, nova aprovação, mídias/ordem/snapshot e preferências.
- Regressão `tests/functional-ux.sql`, em transação revertida: aprovação individual/em lote, comentários, links revogados, versão, isolamento, portal, onboarding e aceite de extras.
- Advisor de segurança: nenhuma nova ocorrência para as tabelas/funções adicionadas. Avisos existentes de extensão no schema public e proteção contra senhas vazadas permanecem fora deste escopo.

## Dependências e verificação pendente

- Validação visual/interativa em desktop, celular e teclado não executada: não há navegador de QA disponível neste ambiente. Compilação e testes SQL não substituem esse fluxo.
- Integração de reagendamento externo não existe no projeto; operações externas permanecem bloqueadas.
- A publicação no domínio oficial depende do pipeline Cloudflare já existente. Não foram alterados DNS, domínio, autenticação ou configuração do Worker. Conferir a revisão efetivamente servida pelo domínio após o push; a versão anterior não acionou o pipeline.
