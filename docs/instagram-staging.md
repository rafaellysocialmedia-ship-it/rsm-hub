# Homologação Instagram — preparação e bloqueios

Base: PR #2, commit 5e67a72. Nenhum merge ou deploy de produção autorizado/executado.

## Estado em 13/10/2026

- Supabase: organização atual `rafaellysocialmedia-ship-it's Org`, plano Free. Projeto RSM de produção confirmado pelo config.toml. Nenhuma branch de desenvolvimento disponível. O outro projeto está inativo e não foi reaproveitado porque seu conteúdo/finalidade não foram autorizados para testes.
- Migração `20261013042803_instagram_client_oauth.sql`: necessária; consulta somente leitura confirmou ausência dos campos/função novos no projeto atual. Nenhuma migração remota aplicada, pois não existe destino isolado confirmado.
- Cloudflare: CLI sem autenticação. Login pelo navegador iniciado via formulário seguro do Google; confirmação por chave de acesso pendente. Não há evidência de acesso ao painel autenticado nem de Worker de homologação criado.
- Credenciais Meta/Supabase/Cloudflare: ausentes do ambiente de execução local; presença/validade no Worker remoto ainda não verificadas. Nenhum valor solicitado pelo chat, exibido ou registrado.
- Endereço público de testes: **ainda não existe um endereço provisionado e validado**. O domínio fixture usado no dry-run é fictício e não é um link para uso.

## Preparação implementada

`npm run build:staging` requer quatro parâmetros de ambiente não secretos/do frontend:

- `RSM_STAGING_CF_ACCOUNT_ID`: conta Cloudflare escolhida após login.
- `RSM_STAGING_SUPABASE_URL`: projeto de testes isolado, obrigatoriamente diferente do project_id de produção.
- `RSM_STAGING_SUPABASE_PUBLISHABLE_KEY`: chave pública do projeto de testes, formato sb_publishable_.
- `RSM_STAGING_ORIGIN`: endereço workers.dev do Worker dedicado `rsm-hub-instagram-staging`, confirmado pela Cloudflare.

O script substitui explicitamente as configurações Supabase do frontend no build, não usa secrets de produção e inspeciona o bundle contra o identificador do banco real. Gera `dist/server/wrangler.staging.json` por allowlist: sem rotas de produção, cron ou service bindings herdados; OAuth começa desativado. `keep_vars` preserva variáveis do painel. Observability desativado neste Worker de teste para evitar captura automática de URLs do callback/troca de tokens. Isso não modifica observability da produção.

Validação local com parâmetros fictícios: 53 testes aprovados (45 anteriores + 8 de isolamento). O build e o dry-run de staging são verificações de artefato, não provisionamento remoto ou teste OAuth real.

## Sequência para concluir após acesso

1. Confirmar login Cloudflare e conta correta. Verificar se o nome dedicado está livre ou pertence a esta homologação; não sobrescrever outro Worker.
2. Definir a organização/destino Supabase com a usuária. Consultar e confirmar custos antes de criar branch/projeto. O plano Free atual não oferece branching; avaliar projeto separado disponível ou upgrade com autorização explícita, sem assumir custo.
3. Provisionar banco sem dados de produção. Reproduzir schema/migrações e somente fixtures necessárias; desativar integrações externas, automações e cron no destino isolado. Não copiar auth.users, clientes, arquivos ou tokens reais.
4. Aplicar a migração nova no projeto isolado após verificar schema/migration history. Executar advisors e confirmar RLS/grants/função. Não usar db push implicitamente contra supabase/config.toml de produção.
5. Criar usuário de teste e cliente fictício exclusivamente na homologação; conferir login, cargos e acesso a Configurações → Acessos.
6. Compilar com os parâmetros isolados; executar `npm run verify:build` e `npx wrangler deploy --dry-run --config dist/server/wrangler.staging.json`.
7. Publicar exclusivamente pelo config staging após validar a conta/destino. Configurar secrets do ambiente isolado: SUPABASE_SERVICE_ROLE_KEY, INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET e INSTAGRAM_TOKEN_ENCRYPTION_KEY. A chave de criptografia deve ser nova, 32 bytes aleatórios em Base64. Nunca imprimir os valores.
8. Configurar Supabase Auth Site URL/redirects de homologação. Na Meta, permitir o callback HTTPS exato do Worker; conferir app Instagram Login e conta profissional @rafaellysocialmedia como testadora, com convite aceito.
9. Habilitar INSTAGRAM_OAUTH_ENABLED somente nesse Worker. Fazer testes negativos HTTP e depois o consentimento real com a usuária. Confirmar vínculo, cifragem, status, recusa e replay. Não publicar posts.
10. Fornecer o endereço real após verificar login e página de conexão. Produção permanece aguardando autorização própria.

## Configurações que dependem da usuária

- Concluir autenticação Cloudflare/Google no formulário seguro.
- Indicar a organização para o banco isolado e confirmar eventual custo exibido pela integração Supabase. Criar recursos com custo exige confirmação do provedor; não há custo aprovado nesta tarefa.
- Se os secrets Meta não estiverem acessíveis/reutilizáveis no painel, cadastrá-los diretamente como secrets na homologação, sem enviá-los no chat.
- Conferir/aceitar convite de testadora e autorizar o consentimento da conta @rafaellysocialmedia quando a URL real estiver disponível.

Referências: https://supabase.com/docs/guides/deployment e https://developers.cloudflare.com/workers/wrangler/configuration/
