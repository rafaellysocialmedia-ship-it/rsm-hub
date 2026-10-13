# Resultado da revisão OAuth — 13/10/2026

Branch: `fix/instagram-oauth-validation`, derivada do PR #1 com merge aditivo da `main` em `b45d32f`. O histórico publicado não foi reescrito. Nenhuma implantação ou migração remota executada.

## Achados e correções

- Build local original passou com Node 24.19 e npm ci. Não foi possível atribuir a falha histórica do Cloudflare a uma causa única: GitHub não retornou status checks ou Actions para o último commit do PR #1, e os logs Cloudflare não estão acessíveis nesta sessão.
- Defeito confirmado no empacotamento: `prepare-sites-build.mjs` renomeava index.mjs para index.js, mas deixava wrangler.main apontando ao arquivo inexistente. Corrigido e coberto por verificação do artefato.
- Rotas API incorporadas à árvore de rotas gerada, com importação do código de servidor somente nos handlers.
- OAuth agora vinculado a cliente, usuário e navegador. Estado de uso único; recusa também o consome; permissões são revalidadas no callback. Redirecionamento definido por ambiente, sem destino arbitrário vindo do usuário.
- Tokens cifrados com AES-256-GCM; respostas de erros genéricas; nenhuma captura/log de códigos, tokens, segredos ou erros upstream.
- Botão e status incluídos no Perfil 360º, Configurações → Acessos. Regras antigas do cadastro manual de acessos preservadas.

## Testes concluídos

| Verificação | Resultado |
| --- | --- |
| `npm run build` | PASS |
| `npm run typecheck` | PASS |
| `npm run verify:build` | PASS: entrypoint, assets, compatibilidade Worker e ausência de código/nomes de secrets no bundle público |
| `npm run test:instagram` | 45 testes aprovados, zero falhas |
| `node --import tsx tests/calendar-period.ts` | PASS: calendário, fuso, viradas de período, ano bissexto e seleção de clientes |
| Wrangler `deploy --dry-run` | PASS: 373 assets, Worker gzip ~1,65 MiB; nenhum upload/deploy |
| `git diff --check` | PASS |

Os 45 testes incluem: autenticação, origem, cliente inválido, configuração ausente, feature flag, cookies seguros, fluxo completo simulado, vínculo ao cliente, criptografia/decriptografia, replay, concorrência, estado expirado, recusa, permissão revogada, respostas inválidas da Meta, consentimento parcial, falha de banco e status sem token. Em PostgreSQL isolado: migração, preservação de registros legados, RLS, grants, FK e matriz de permissões/visibilidade/churn.

Calendário, tarefas, arrastar e soltar e aprovações não receberam alterações nesta correção em relação à main incorporada. O teste de calendário é automatizado; não substitui teste visual manual de todos esses módulos.

## Verificação remota somente leitura

No projeto Supabase `zttgcamgixlkbkbdvrtb`, confirmado pelo config.toml:

- Ambas as tabelas já existem com o schema inicial do PR #1.
- RLS ativo nas duas.
- anon/authenticated sem privilégio SELECT; service_role com acesso necessário.
- Ainda faltam client_id, browser_hash e a nova função de autorização; a migração está apenas no repositório.
- Não foram consultados valores de tokens nem alterados registros reais.

## Pendências que impedem declarar o fluxo real concluído

- Confirmar credenciais/bindings do Worker, sem revelar seus valores.
- Aplicar a migração em banco isolado de homologação e disponibilizar Worker de homologação.
- Testar com Instagram profissional testador e consentimento real Meta. As chamadas HTTP da Meta nos testes atuais são simuladas.
- Validar UI/retorno visual no navegador autenticado e requisitos de revisão do app Meta.
- Investigar logs históricos Cloudflare se a falha remota persistir após estes ajustes.

Não há aprovação de produção solicitada: primeiro devem ser resolvidas as pendências de homologação.
