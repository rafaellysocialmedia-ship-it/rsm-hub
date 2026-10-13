# Instagram OAuth por cliente

Implementação em revisão; não fazer merge, aplicar migrações em produção ou publicar sem autorização da Rafaelly.

## Interface e rotas

Em **Clientes → Perfil 360º → Configurações → Acessos**, o cartão Instagram oferece conexão e status. O botão respeita `workspace.clients:edit`, cargos administrator/team, visibilidade e elegibilidade do cliente. As regras também são verificadas no servidor; o frontend não é a barreira de segurança. Clientes inativos ou com churn não podem conectar. As operações de cadastro manual de acessos continuam intactas.

- `POST /api/integrations/instagram/start`: bearer Supabase verificado por `auth.getUser`; JSON `{ "client_id": "UUID" }`; origem exata do callback configurado.
- `GET /api/integrations/instagram/callback`: estado aleatório com TTL de 10 minutos, hash no banco e vínculo com cookie HttpOnly/Secure/SameSite=Lax. Consumo atômico antes da troca de código, inclusive em recusas. Revalida permissões antes de persistir.
- `GET /api/integrations/instagram/status?client_id=UUID`: bearer e mesmas permissões; devolve somente ID, username, validade e expiração, nunca token cifrado ou puro.

Callback retorna à ficha do cliente, em Configurações/Acessos. Falhas não incluem mensagens do provedor, URLs, credenciais ou códigos nos logs. Uma falha após consumir estado exige iniciar uma nova conexão.

## Configuração por ambiente

Somente no servidor, como secrets/bindings do Worker; nunca em `VITE_*`, Git ou mensagens:

| Variável | Uso |
| --- | --- |
| `INSTAGRAM_OAUTH_ENABLED` | Somente `true` habilita o início/callback; ausente permanece desativado. |
| `INSTAGRAM_REDIRECT_URI` | URL HTTPS exata do ambiente, terminando em `/api/integrations/instagram/callback`, sem query ou fragmento. |
| `INSTAGRAM_APP_ID` | ID do aplicativo Instagram Login. |
| `INSTAGRAM_APP_SECRET` | Secret correspondente ao aplicativo. |
| `INSTAGRAM_TOKEN_ENCRYPTION_KEY` | 32 bytes aleatórios em Base64; manter backup seguro. |
| `SUPABASE_URL` | URL do banco do ambiente. |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret do backend; nunca enviado ao navegador. |

Se futuramente usar Wrangler para implantar após aprovação, preservar variáveis do painel com `--keep-vars`; o dry-run acima não altera bindings.

A URL deve estar permitida no painel Meta. O Worker usa `nodejs_compat` e compatibility date >= 2025-04-01, permitindo acesso às variáveis em runtime via `process.env`. A chave de criptografia, o app secret e a URL são validados antes de criar o estado. O servidor exige consentimento dos escopos `instagram_business_basic` e `instagram_business_content_publish`.

Homologação deve usar Worker, banco, cliente fictício e conta Instagram profissional de teste isolados. Não apontar testes à base real. Nesta sessão nenhuma credencial do Worker estava disponível; sua existência/validade remota não foi confirmada.

## Banco

Aplicar, primeiro em homologação:

1. `20261013000100_instagram_oauth.sql`, se ainda não aplicada.
2. `20261013042803_instagram_client_oauth.sql`.

A segunda migração adiciona client_id/browser_hash e a função `can_manage_instagram`, invocável apenas por service_role, com SECURITY INVOKER. Mantém conexões antigas sem client_id intactas e privadas; não tenta adivinhar o cliente. Altera a unicidade para cliente + conta Instagram, permitindo reconexão por outro membro autorizado da equipe.

RLS continua ativo e anon/authenticated não têm acesso às duas tabelas. Não expor tokens por views. Estados legados sem vínculo de navegador não podem concluir este fluxo.

## Validação reproduzível sem credenciais

```sh
npm ci
npm run test:instagram
npm run typecheck
node --import tsx tests/calendar-period.ts
npm run build
npm run verify:build
npx wrangler deploy --dry-run --config dist/server/wrangler.json
```

O último comando apenas valida o pacote; não publica. Testes OAuth usam fetch simulado e o teste SQL usa PostgreSQL local em memória (PGlite). Nenhum desses testes deve usar clientes reais.

## Gate antes de produção

1. Disponibilizar homologação isolada e registrar o callback exato na Meta.
2. Verificar apenas presença/formato dos bindings, sem imprimir valores.
3. Executar consentimento com conta profissional testadora, sucesso, recusa, replay, expiração, sessão inválida e cargo sem permissão.
4. Conferir o vínculo ao cliente fictício, criptografia, status e comportamento visual no navegador.
5. Apresentar os resultados e pedir autorização de produção.

A implementação cobre conexão OAuth. Publicação automática, renovação programada, desconexão/revogação e limpeza periódica de estados expirados continuam fora desta entrega. App Review, política de privacidade e requisitos da Meta para uso por clientes externos ainda precisam ser verificados no painel Meta antes da liberação ampla.

## Referências

- https://tanstack.com/start/latest/docs/framework/react/guide/server-routes
- https://supabase.com/docs/reference/javascript/auth-getuser
- https://developers.cloudflare.com/workers/runtime-apis/nodejs/process/
- https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login

A página direta da Meta respondeu 429 durante a consulta; o contrato deve ser confirmado também no teste real de homologação.
