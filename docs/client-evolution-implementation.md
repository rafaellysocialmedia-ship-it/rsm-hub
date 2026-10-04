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
