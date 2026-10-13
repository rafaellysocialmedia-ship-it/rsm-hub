# Instagram Login — primeira etapa (RSM)

Esta implementação prepara uma conexão **por usuário autenticado no RSM**, não conecta automaticamente um cliente nem publica posts.

## Pré-requisitos de produção

1. Aplicar a migração `20261013000100_instagram_oauth.sql` no projeto Supabase correto.
2. Configurar **somente no servidor**, nunca em `VITE_*` ou no GitHub:
   - `INSTAGRAM_APP_ID`: ID do **app do Instagram** na configuração Instagram Login da Meta.
   - `INSTAGRAM_APP_SECRET`: segredo correspondente.
   - `INSTAGRAM_TOKEN_ENCRYPTION_KEY`: chave aleatória de **32 bytes codificada em Base64**. Faça backup seguro: perder a chave invalida a leitura dos tokens.
   - `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` (já existentes no backend).
3. Adicionar exatamente `https://app.rsmmarketing.com.br/api/integrations/instagram/callback` como URL de redirecionamento permitida na Meta **depois de publicar a rota**.
4. Testar primeiro com Instagram profissional cadastrado como testador.

## Uso

Após autenticação no RSM, o frontend envia `POST /api/integrations/instagram/start` com `Authorization: Bearer <supabase-access-token>` e redireciona o navegador à `authorization_url` retornada. O servidor valida a sessão, grava um estado de uso único com expiração de 10 minutos e gera a URL de consentimento. O callback consome o estado, troca o código por token de longa duração e armazena apenas o token cifrado no Supabase.

## Não habilitado nesta etapa

- Nenhum botão de conexão foi adicionado à interface.
- Não há associação da conta do Instagram a um cliente específico, autorização por cargo, publicação agendada, renovação automática do token nem fila de publicação.
- Não há consulta de status de conexão para o usuário.
- Webhooks não são necessários para esse fluxo de consentimento.

**Importante:** não habilitar para clientes antes de implementar autorização por agência/cliente, política de privacidade, desconexão, renovação de tokens, verificação de requisitos da Meta e testes de produção.
