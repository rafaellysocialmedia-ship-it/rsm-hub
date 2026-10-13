# Homologação Instagram — estado verificado

Base: PR #2, commit c9306fa (mais o commit de validação de banco nesta branch).
Nenhum merge nem deploy em produção.

## Estado em 13/10/2026

- Destino confirmado pelo conector ANTES das alterações: **RSM Homologação**, `dtladsjhmnzdxcmgivne`, organização `cyhazeicsfprfhabaobb`, região `ca-central-1`, ACTIVE_HEALTHY. Projeto Free criado pela usuária.
- Aplicadas as **102 migrações** do PR #2 em ordem, mais **2 ajustes exclusivos de homologação** (104 registros no histórico remoto).
- Lacuna descoberta no replay: `auto_renew`, `default_payment_method_id`, trigger de forma de pagamento e funções de automação financeira não estavam definidos no git. Consultadas somente definições de schema na produção, sem ler registros de negócio. Restauradas as dependências em `supabase/staging/20261013122217_restore_finance_bootstrap_dependencies.sql`, antes de `20261003205105`. Nenhuma alteração em produção.
- Endurecimento local: revogada execução pública de `rls_auto_enable()`, função de event trigger criada pela plataforma.
- Todas as tabelas públicas com RLS. Tabelas OAuth sem acesso direto para anon/authenticated, acesso de serviço confirmado. A ausência de policies nelas é intencional.
- Todos os cron jobs desativados na mesma transação de cada migração que os cria. Zero jobs ativos confirmado.
- Fixtures: 3 identidades fictícias sem senha/identidade de login, 2 clientes fictícios, 1 rascunho e 15 tarefas (incluindo tarefas de onboarding criadas pelos triggers). Nenhum dado/token real copiado. Zero states e conexões OAuth após os testes.
- Cloudflare: painel exige login e CLI não autenticada. Worker ainda não publicado. **Não existe URL pública de homologação verificada.**
- Credenciais Meta, chave de serviço do novo Supabase e chave de criptografia do Worker ainda precisam de configuração segura. Nenhum valor consta neste relatório.

## Resultados dos testes

- 55 testes automatizados de OAuth/criptografia/configuração/isolamento/plano de migrações; typecheck.
- Supabase real: `instagram-staging-live.sql` passou para admin/equipe/cliente, cargo sem edição, módulo oculto, churn/inativo, privilégios, state associado ao navegador, consumo único, gravação de serviço e isolamento de tarefas. Transação revertida.
- Regressões SQL no projeto novo, usando os UUIDs fictícios: `calendar-workspace.sql`, `calendar-today-creation.sql`, `functional-ux-links.sql`, `finance-automation-permissions.sql`. Todas passaram, com rollback: reagendamento, horário preservado, conflitos, mídia, aprovações, portal, permissões e financeiro.
- Requisições HTTP reais anônimas às duas tabelas OAuth retornaram **401**. Nenhum token exposto.
- Build de staging e Wrangler dry-run já haviam passado no PR #2 com parâmetros fictícios. Isso não é deploy nem teste de login real.
- OAuth Meta real, login na aplicação e regressão visual/arrastar-e-soltar no Worker continuam pendentes até a publicação isolada.
- Advisors remanescentes: extensões `pg_trgm`/`pg_net` no schema public (histórico existente), proteção contra senhas vazadas desativada. Não foi contratado upgrade para esse recurso. Documentação: https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public e https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Reproduzir a instalação com segurança

`node scripts/staging-migration-plan.mjs dtladsjhmnzdxcmgivne` gera apenas um manifesto; recusa qualquer outro ID, incluindo produção e projeto pausado. A função exportada retorna SQL em ordem, inclui o bootstrap financeiro antes da dependência e desativa cron na mesma transação.

Manifesto auditável: `docs/instagram-staging-migration-manifest.json`. O histórico MCP usa nomes `source_<arquivo original>` e versões de execução; não executar `supabase db push` cegamente, porque o config.toml continua sendo o original e o histórico não usa os timestamps originais. Não reaplicar o plano no banco já instalado.

## Preparação implementada

`npm run build:staging` requer quatro parâmetros de ambiente não secretos/do frontend:

- `RSM_STAGING_CF_ACCOUNT_ID`: conta Cloudflare escolhida após login.
- `RSM_STAGING_SUPABASE_URL`: projeto de testes isolado, obrigatoriamente diferente do project_id de produção.
- `RSM_STAGING_SUPABASE_PUBLISHABLE_KEY`: chave pública do projeto de testes, formato sb_publishable_.
- `RSM_STAGING_ORIGIN`: endereço workers.dev do Worker dedicado `rsm-hub-instagram-staging`, confirmado pela Cloudflare.

O script substitui explicitamente as configurações Supabase do frontend no build, não usa secrets de produção e inspeciona o bundle contra o identificador do banco real. Gera `dist/server/wrangler.staging.json` por allowlist: sem rotas de produção, cron ou service bindings herdados; OAuth começa desativado. `keep_vars` preserva variáveis do painel. A configuração gerada **não** declara `INSTAGRAM_OAUTH_ENABLED`, evitando sobrescrever o valor `true` configurado no painel do Worker de homologação. Se a variável estiver ausente no Worker, o código do servidor mantém o OAuth desativado por padrão. Confirmar o estado no painel após qualquer deploy. Observability desativado neste Worker de teste para evitar captura automática de URLs do callback/troca de tokens. Isso não modifica observability da produção.

Validação local com parâmetros fictícios: 53 testes aprovados (45 anteriores + 8 de isolamento). O build e o dry-run de staging são verificações de artefato, não provisionamento remoto ou teste OAuth real.

## Sequência para concluir após acesso

1. Confirmar login Cloudflare e conta correta. Verificar se o nome dedicado está livre ou pertence a esta homologação; não sobrescrever outro Worker.
2. Banco isolado já criado pela usuária e instalado: usar exclusivamente `dtladsjhmnzdxcmgivne`. Não criar outro projeto nem contratar upgrade.
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
- O banco já está pronto; falta criar o login pessoal de homologação por canal seguro e atribuir o cargo após verificar sua identidade. As fixtures não têm senha e não servem como login.
- Cadastrar secrets exclusivos de homologação diretamente no Worker, sem enviá-los no chat. Usar app/test app Meta separado, chave de serviço do projeto novo e nova chave AES; não reutilizar credenciais de produção.
- Conferir/aceitar convite de testadora e autorizar o consentimento da conta @rafaellysocialmedia quando a URL real estiver disponível.

Referências: https://supabase.com/docs/guides/deployment e https://developers.cloudflare.com/workers/wrangler/configuration/
