# Evolução da central de clientes

Implementação de 04/10/2026. Publicação: rsmmarketing.com.br.

- Perfil 360º: cabeçalho com indicadores, saúde, responsável, financeiro conforme permissão, contato e próxima ação; atalhos; filtros de conteúdo; navegação por abas e por links de alertas.
- Experiência do cliente: início, conteúdo, aprovação, calendário, prévia do feed, relatórios, arquivos, reuniões, contrato, financeiro e suporte com mensagens.
- Saúde e retenção: sinais operacionais, financeiro conforme permissão, revisões, materiais, reuniões, reclamações e queda de engajamento. Pontuação explicada, ações e revisão diária. Não é uma previsão estatística de churn.
- Atenção hoje: contas ativas, pendências de produção, aprovação, demandas, cobrança, contrato, reunião, onboarding e solicitações sem resposta.
- Onboarding: novas contas ativas ganham checklist; assinatura, pagamento, briefing concluído, reunião concluída e calendário aprovado confirmam etapas. Acessos, identidade e estratégia exigem confirmação da equipe. Não inferimos conclusão apenas porque um arquivo ou credencial foi cadastrado. Conferência diária às 8h30 de Fortaleza e botão de conferência para registros anteriores.
- Comercial: oportunidades da RSM separadas do CRM de campanhas; proposta, registro do aceite, conversão atômica e idempotente; cadastro novo ou prospect existente; contrato financeiro, documento pendente de assinatura, primeira mensalidade, checklist e pastas. Recorrência optativa e revisável. Não cria login nem envia convite automaticamente.
- Relacionamento: suporte compartilhado e respostas, resumo de reunião com decisões e próximos passos no painel, histórico de atividades, detalhes internos de encerramento e chance de retorno.
- Versões: histórico do texto com comentários vinculados, projeção segura que exclui notas internas, respeito à opção de histórico do portal. Os anexos atuais continuam na galeria; snapshots antigos não reconstituem arquivos substituídos.

## Limites de integração

Os módulos internos compartilham os mesmos registros. Links e arquivos de contratos assinados aceitam a plataforma indicada pela equipe. Não existe sincronização automática nova com Instagram, WhatsApp, bancos, ZapSign ou Autentique: isso depende de escolher os provedores e configurar as respectivas contas e credenciais. Métricas e assinaturas usam os dados já registrados na plataforma. Nada envia mensagens externas durante a conversão ou revisão automática.

## Verificações

TypeScript, lint dos arquivos alterados e build de produção. Testes SQL com rollback: conversão repetida sem duplicação, geração das quatro pastas e oito etapas, pagamento e reunião sincronizados, alertas financeiros e reclamações, churn interrompendo recorrência, isolamento entre clientes, bloqueio de acesso ao comercial e score, projeção de versões sem notas internas, vínculo de comentário ao post correto e resumo visível ao cliente proprietário. Sem teste visual automatizado em navegador.

## Evolução funcional e visual (04/10/2026)

- Perfil reorganizado em seis áreas, com subseções que preservam as rotas e registros anteriores. Portal em cinco áreas; Financeiro condicionado à configuração da conta e à projeção no servidor.
- Paleta RSM clara, foco de teclado, navegação sem barra lateral interna para clientes, controles com quebra de linha e revisão adaptada ao celular. Aileron usa fallback Geist porque o arquivo licenciado não está no projeto.
- Revisão com arte/carrossel/vídeo, legenda, comentários internos/compartilhados, descrição obrigatória para ajustes, decisão atômica e registro de autor/data/revisão. Mudanças de texto ou anexos invalidam a decisão anterior. Publicação manual identificada e independente da aprovação.
- Aprovação em lote até 50 conteúdos com contagem e confirmação; divergência em uma versão cancela todo o lote. Links individuais associados à versão, validade de 1–30 dias e revogação. O destinatário precisa entrar com o usuário vinculado à conta; não são links anônimos.
- Novas decisões preservam cópia do texto e referências imutáveis aos arquivos. Conteúdos anteriores à implantação não ganham retroativamente uma mídia que já foi excluída. A visão segura de posts remove notas internas e respeita legendas, mídia, comentários e histórico autorizados.
- Calendário compartilhado em mês, semana, lista e grade. O quadro de produção existente foi preservado. Filtro de responsável usa as tarefas vinculadas ao conteúdo; conteúdos sem tarefa atribuída não têm responsável inferido.
- Dashboard operacional: cada indicador abre sua lista efetivamente filtrada; agenda semanal, andamento das contas e marcos recentes usam registros reais e clientes ativos.
- Entrada em seis etapas com respostas persistidas no onboarding existente e leitura no Perfil 360º. Contato atualiza o cadastro. Materiais são enviados para a biblioteca da mesma conta. Indicar um aprovador não concede um login automaticamente: a equipe valida o vínculo existente.
- Entregas por formato usam a distribuição vigente do contrato, sem reescrever os saldos históricos. Extras reutilizam solicitações, com orçamento, versão, aceite registrado e vínculo ao conteúdo. Editar o orçamento exige novo aceite.
- Relatórios têm análise, aprendizados, próximos passos, comparação e origem das métricas. Financeiro inclui competência editável e link real de pagamento opcional. Competências anteriores foram inicializadas pelo mês do vencimento e podem ser corrigidas pela equipe.

### Validação desta evolução

`tests/functional-ux.sql` e `tests/functional-ux-links.sql` executam transações revertidas, sem manter dados fictícios: isolamento da projeção, bloqueio de notas internas, comentários, feedback obrigatório, aprovação e histórico, invalidação por legenda e mídia, lote atômico, identidade/validade/revogação do link, onboarding, aceite e revalidação de orçamento, histórico de mídia e permissão financeira. TypeScript e build de produção verificados. Não foi realizada uma sessão manual autenticada no navegador; isso permanece como limite da validação visual, não como teste aprovado.

As integrações externas listadas acima continuam dependentes dos provedores. Os controles não simulam conexão, agendamento automático, pagamento ou assinatura. Configuração do domínio e regras existentes de churn foram preservadas.

A checagem final também restringiu as rotinas financeiras antigas: chamadas anônimas bloqueadas, acesso autenticado condicionado à edição financeira, implementações privilegiadas fora do schema exposto e renovação limitada a contas ativas sem churn. Os nomes das rotinas agendadas foram mantidos.
