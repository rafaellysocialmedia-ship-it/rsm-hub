# Agendamento Instagram no Worker OAuth existente — proposta isolada para homologação

## Motivo

O Worker `rsm-hub-instagram-staging` possui a chave protegida
`INSTAGRAM_TOKEN_ENCRYPTION_KEY` usada para criptografar o token da conta conectada.
A Cloudflare não revela o valor de um Secret salvo. Não é seguro criar outra chave
ou tentar substituir a existente.

Em vez de replicar o Secret no Worker `rsm-instagram-publisher-staging`, este PR
propõe executar a rotina de publicações no **próprio Worker OAuth de homologação**,
que já pode usar o Secret original. **Nenhuma chave é exibida, transferida ou
gravada no GitHub.**

## Mudanças (somente no branch de homologação)

- Entrada `src/server.ts` ganha um handler `scheduled` que encaminha ao executor
  compartilhado de `workers/instagram-publisher-staging.mjs`.
- `src/lib/instagram-cron.server.ts` adiciona uma trava de segurança extra.
- `scripts/staging-config.mjs` programa o cron `* * * * *` **somente** no
  Worker `rsm-hub-instagram-staging` do Supabase `dtladsjhmnzdxcmgivne`.
- Arquivos de produção, `main`, registros existentes, contas Meta e banco
  Supabase **não são modificados** por esta proposta.
- Worker independente `rsm-instagram-publisher-staging` permanece intacto;
  sua execução também deve permanecer **desativada**.

## Travas de execução

O handler principal só encaminha a tarefa se todos forem verdadeiros:

1. `RSM_ENVIRONMENT=staging`
2. `SUPABASE_URL=https://dtladsjhmnzdxcmgivne.supabase.co`
3. `RSM_PUBLISH_ENABLED=true`
4. `RSM_PRIMARY_PUBLISH_ENABLED=true`

O executor possui validações adicionais, incluindo chave de serviço e chave
criptográfica. As duas flags **não** constam do arquivo Wrangler e não devem
ser adicionadas ou ativadas nesta etapa. Um cron pode ser invocado e não realizar
nenhuma consulta externa/publicação.

`INSTAGRAM_TOKEN_ENCRYPTION_KEY` e `SUPABASE_SERVICE_ROLE_KEY` permanecem
somente como Secrets do Worker OAuth de homologação.

## Checklist antes de qualquer ativação (ação separada, futura)

1. Passar CI: testes offline de publicação, typecheck, build e artefato de homologação.
2. Revisar o PR e verificar que o deploy seleciona **apenas**
   `rsm-hub-instagram-staging`, usando `dist/server/wrangler.staging.json`.
3. Verificar no painel que o Worker OAuth ainda possui ambos os Secrets, e que
   as flags `RSM_PUBLISH_ENABLED` e `RSM_PRIMARY_PUBLISH_ENABLED` estão ausentes.
4. Fazer deploy apenas após autorização específica e verificar o único cron.
5. Criar publicação fictícia elegível; verificar fila, bloqueio e cancelamento
   **sem** enviar nada à Meta.
6. **Antes de qualquer teste real**, desativar/remover o cron do Worker antigo
   `rsm-instagram-publisher-staging` para evitar execuções concorrentes.
7. Obter autorização explícita para UM post de teste em conta profissional
   controlada pela usuária; só então ativar as duas flags no Worker OAuth staging.
8. Confirmar resultado na Meta e no banco; desligar as duas flags ao terminar.

**Não executar** a antiga função `auto_publish_scheduled_posts()`, que apenas
altera status no banco e não publica na Meta.

## Status

Proposta de código apenas. **Sem merge, deploy, alteração de secrets ou publicação real.**
