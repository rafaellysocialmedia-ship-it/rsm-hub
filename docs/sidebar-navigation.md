# Navegação RSM — 5 de outubro de 2026

Implementada no projeto existente rsm-hub, preservando rsmmarketing.com.br, Supabase, registros, rotas e regras de churn. Nenhum módulo ou registro foi excluído.

## Mapa anterior → nova localização

| Menu anterior | Nova localização | Destino preservado |
|---|---|---|
| Operação / Início | Rotina / Início | /dashboard |
| Operação / Tarefas | Rotina / Minhas tarefas; Mais / Todas as tarefas | /tasks?scope=mine; /tasks?scope=all; /tasks continua todas |
| Operação / Calendário | Rotina / Calendário | /posts?view=calendar |
| Visualizações da produção | Operação / Conteúdos, com alternâncias internas | /posts?view=kanban; list, table e timeline continuam na mesma página |
| Operação / Aprovações | Rotina / Aprovações | /portal |
| Operação / Clientes | Operação / Clientes | /management/clients; links /clients preservados |
| Operação / Comercial | Mais / Comercial | /commercial |
| Operação / Retenção | Mais / Retenção | /retention |
| Clientes e conteúdo / Reuniões | Mais / Reuniões | /meetings |
| Clientes e conteúdo / Biblioteca | Mais / Biblioteca | /library |
| Clientes e conteúdo / Briefings | Mais / Briefings | /library/briefings; /briefings e detalhes preservados |
| Modelos de briefing | Mais / Modelos de briefing | /briefings/template |
| Clientes e conteúdo / Acessos | Mais / Acessos | /vault |
| Clientes e conteúdo / Assistente de IA | Mais / Assistente de IA; Ferramentas de IA | /ai; /ai/tools; conversas preservadas |
| Clientes e conteúdo / Resultados | Gestão / Resultados | /analytics |
| Tráfego pago / Visão geral | Mais / Tráfego pago | /traffic |
| Campanhas de tráfego | Mais / Campanhas de tráfego | /traffic/campaigns e detalhes |
| Tráfego pago / CRM | Mais / CRM de tráfego | /traffic/crm |
| Tráfego pago / Métricas | Mais / Métricas de tráfego | /traffic/analytics |
| Landing pages | Mais / Landing pages | /traffic/landing-pages |
| Gestão financeira / Visão geral | Gestão / Financeiro | /finance |
| Gestão financeira / Contas a receber | Mais / Contas a receber | /finance/receivables |
| Gestão financeira / Carteira financeira | Mais / Carteira financeira | /finance/clients |
| Contratos, formas de pagamento e ajustes financeiros | Mais / respectivos itens | /finance/contracts; /finance/payment-methods; /finance/settings |
| Recursos / Cursos | Mais / Cursos | /courses e detalhes |
| Recursos / Marketplace | Mais / Marketplace | /marketplace |
| Administração / Equipe | Mais / Equipe, administrador | /team |
| Administração / Permissões | Mais / Permissões, administrador | /admin/permissions |
| Administração / Gerenciar cursos | Mais / Gerenciar cursos, administrador | /admin/courses |
| Perfil / Gerenciar visualizações | Mais e menu do perfil, administrador | /admin/visibility |
| Perfil / Controle de posts | Mais e menu do perfil, administrador | /admin/posts-control |
| Administração / Configurações | Rodapé / Configurações | /settings |
| Cabeçalho / Notificações e perfil | Rodapé | Mesmas ações e registros |
| Portal sem sidebar | Sidebar própria: Início, Conteúdos, Solicitações, Resultados, Documentos e Financeiro autorizado | /portal?tab=home, contents, support, reports, files, finance |
| Portal / Revisão e calendário | Conteúdos / Para aprovar, Calendário e Todos | /portal?tab=approvals, calendar, contents; /portal/calendar e /review/$token preservados |
| Recursos antigos do cliente | Mais / Reuniões, Biblioteca, Resultados, Cursos e Marketplace | Destinos originais, sujeitos às permissões |

## Comportamentos

- Sidebar de 248 px, recolhida de 72 px; nomes por padrão; tooltips por foco e mouse, grupos discretos e um nível em Mais. Gaveta móvel usa Dialog modal do Radix, bloqueio de fundo, Escape, fechamento explícito e após navegação, devolvendo foco ao acionador.
- Busca de clientes e conteúdos reais, com tipo e conta, limites de resultado, erros e carregamento. Ctrl/Cmd+K não intercepta formulários. Usa a projeção segura portal_posts, não uma base duplicada.
- Criar reutiliza os formulários reais de conteúdo, tarefa, reunião e cliente, respeita create e preenche a conta ativa do Perfil 360º para conferência. Diálogos vivem fora da gaveta para não desaparecerem no celular.
- Favoritos por usuário para clientes e URLs de visualizações, cinco inicialmente e Ver todos. Preferência de recolhimento no mesmo registro, com RLS. Não substituem a carteira.
- Perfil 360º preserva suas seis áreas, adiciona caminho e seletor pesquisável, mantém aba ao trocar e remonta o estado dos formulários por conta. Carteira mantém filtros ao retornar; histórico de encerrados permanece separado.
- Minhas tarefas usa assignee_id do usuário. Contagem considera vencidas, não concluídas, de contas ativas ou sem cliente. Botão Somente vencidas permite conferir a lista. Contagem de notificações usa count exact de todas as não lidas, independente da paginação da lista, com atualização e tratamento de erro.
- Portal prioriza a revisão quando há pendências acionáveis; o contador depende de can_approve/can_request_changes. Não inventa contador de decisões atribuídas à equipe: o modelo atual não possui atribuição de aprovador interno e o painel da equipe acompanha a fila do cliente.
- Solicitar conteúdo abre o fluxo existente de extra/orçamento para conferência antes de salvar. Concluir cadastro aparece apenas com etapas reais pendentes do cliente. Financeiro segue can_view_finance. Não há seletor de contas no portal porque o acesso existente resolve uma conta vinculada.
- Guardas de rota usam papel e catálogo de módulos; falha ao carregar permissões bloqueia a área com erro. RLS e RPCs existentes mantêm isolamento e permissões financeiras/de aprovação no servidor. Não foram reescritas as regras legadas de acesso entre membros da equipe. Cache de consultas é limpo quando a identidade autenticada muda.

## Verificado

- TypeScript sem erros e build de produção.
- tests/navigation.mjs: destinos presentes na árvore de rotas, seleção por URL/visualização, aliases e limites de URLs para favoritos.
- tests/navigation-preferences.sql, executado com rollback no banco real: persistência própria, bloqueio de leitura/edição/exclusão de outro usuário, bloqueio de inserção em nome de outro e acesso anônimo.
- Regressão SQL funcional-ux e funcional-ux-links, com rollback: isolamento de contas, campos seguros, comentários, aprovação versionada e em lote, revisão desatualizada, alterações de mídia, onboarding, aceite de extra, permissões financeiras, expiração/revogação e identidade incorreta de links.

## Limites de validação

Navegador automatizado compatível indisponível neste ambiente. Inspeção visual em desktop/celular e interação real por teclado, sessão de equipe e sessão de cliente não foram executadas e precisam de homologação. Os testes de dados não substituem essa homologação. As regras existentes de equipe são baseadas em papel no banco; esta alteração não redefine o modelo de autorização de cada módulo legado.
