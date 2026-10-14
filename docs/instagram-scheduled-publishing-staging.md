# Publicação automática Instagram — homologação (primeira entrega)

## Comportamento

- O status **Agendado** do calendário é editorial. Quando o post pertence a um cliente com **exatamente uma conta profissional Instagram conectada**, escolhe **Feed**, tem **uma imagem JPEG**, **legenda**, **data e hora futuras** e não possui revisão pendente, a migração cria um job `queued` no banco de homologação.
- O calendário mantém seus filtros, drag-and-drop, datas, horários, edição, aprovações e recorrência. Qualquer mudança em mídia, data, legenda ou status cancela/revalida a fila via trigger.
- O editor exibe o estado real: `queued` (na fila do RSM), `blocked` (não enviará), `processing`, `prepared`, `publishing`, `published`, `failed`, `uncertain` (não repetir automaticamente), `cancelled`.
- Isso **não é um agendamento armazenado no Instagram**. O Worker precisa estar em execução e credenciado para publicar no horário. O atraso normal pode chegar a ~1 minuto além do horário programado; indisponibilidades da Meta ou do Worker podem atrasar ou impedir envio.
- Fuso horário: **America/Sao_Paulo** (horário de Brasília).
- Apenas Feed com uma imagem JPEG é elegível nesta fase. Reels, Stories, carrossel, vídeos, PNG e contas múltiplas são explicitamente bloqueados para envio automático até implementação específica.
- A aprovação precisa ser da mesma revisão quando houver processo de aprovação. Se não houver registro de aprovação e a equipe programou o post, ele pode ser agendado.

## Segurança

- Toda fila fica em `public.instagram_publish_jobs` com RLS e grants exclusivos de `service_role`.
- `GET /api/integrations/instagram/status?post_id=...` retorna **apenas metadados** para um usuário autenticado e autorizado no mesmo cliente; sem tokens.
- Agendamentos antigos não são importados para a fila. Um post precisa ser salvo/reagendado para ser elegível.
- Cron lê o projeto Supabase **dtladsjhmnzdxcmgivne** rigidamente. Qualquer outro projeto falha antes de chamar a Meta.
- Worker independente **rsm-instagram-publisher-staging**. Nenhuma alteração no worker de produção ou no `main`.
- `RSM_PUBLISH_ENABLED=false` por padrão. Nunca ligar sem validação e autorização para uma postagem de teste.
- Mídia privada: no momento do envio gera URL de armazenamento assinada com validade de 1 hora, nunca expõe a chave de serviço no frontend. API Meta recebe os parâmetros no corpo da requisição.
- `processing`/ `publishing` interrompidos viram `uncertain` após 5 minutos; não há repetição automática de envio após resposta ambígua da Meta.
- O ID da publicação só é salvo e o post marcado `published` após confirmação da Meta. Se houver outras redes no mesmo post, apenas o job Instagram fica `published`; o post editorial não é marcado totalmente concluído.

## Etapas para implantação (sem enviar credenciais para chat)

1. Somente no Supabase de homologação, aplicar migração `20261014010000_instagram_publish_queue.sql`. **Concluído em 13/10-14/10/2026**. Reconfirmar RLS e ausência de cron legado ativo.
2. Compilar, executar `npm run test:instagram`, `npm run typecheck`, `npm run build:staging`, `npm run verify:build`; depois atualizar **somente** o Worker RSM de homologação para mostrar estados da fila. Não alterar `main`.
3. Criar o *segundo Worker* Cloudflare `rsm-instagram-publisher-staging`, com `wrangler.instagram-publisher.staging.json`; seus cron triggers rodam a cada minuto e não têm endpoint público.
4. Configurar **no Worker separado**, como **Secrets** (nunca `vars`, frontend ou Git): `SUPABASE_SERVICE_ROLE_KEY` do projeto de homologação e `INSTAGRAM_TOKEN_ENCRYPTION_KEY` da conexão de homologação. Esta última precisa ser exatamente a mesma usada para cifrar o token anteriormente; não trocar a chave sem migração.
5. Verificar `RSM_ENVIRONMENT=staging`, `SUPABASE_URL=https://dtladsjhmnzdxcmgivne.supabase.co`. A variável `RSM_PUBLISH_ENABLED` **não vem declarada no config** e, quando ausente, desativa todos os envios. O config usa `keep_vars` para preservar uma futura decisão no painel; não reutilizar secrets nem dados de produção.
6. Fazer um post **fictício** Feed / imagem JPEG / legenda e data futura, sem outros destinatários; verificar `queued`, reagendamento, `blocked` e `cancelled` sem publicar.
7. Com autorização explícita para esse post, ligar `RSM_PUBLISH_ENABLED=true` somente no Worker cron de homologação e verificar a postagem real no Instagram, ID publicado no job, horário, status, resultado e eventual falha. Desligar novamente quando terminar.
8. Preparar revisão de App Meta, monitoramento, armazenamento seguro de tokens, renovações e implementação de formatos adicionais antes de ativar no RSM de produção.

**Não executar** `auto_publish_scheduled_posts()`: essa função antiga apenas troca o campo status no banco e não publica nada no Instagram.
