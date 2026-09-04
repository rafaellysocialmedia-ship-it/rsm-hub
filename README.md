# Social Media Hub

SaaS para centralizar a operação de uma agência de social media: clientes,
calendário editorial, aprovações, tarefas, reuniões, arquivos, acessos,
briefings, analytics, tráfego pago, financeiro, cursos e marketplace.

## Perfis de acesso

- **Administrador:** configura equipe, permissões, módulos e toda a operação.
- **Equipe:** acessa somente os módulos e ações liberados.
- **Cliente:** acompanha calendário, aprovações, resultados e recursos próprios.

## Tecnologias

- React 19, TypeScript e TanStack Start
- Tailwind CSS e shadcn/ui
- Supabase Auth, Postgres, Storage e Row Level Security
- Cloudflare Workers para a aplicação web

## Desenvolvimento

Requisitos: Node.js 22+ e npm.

```bash
npm install
cp .env.example .env
npm run dev
```

Antes de iniciar, preencha o arquivo `.env` com as credenciais do projeto
Supabase. A chave `SUPABASE_SERVICE_ROLE_KEY` é usada somente no servidor e é
necessária para convites e administração de usuários. As variáveis de IA são
opcionais.

O botão de acesso pelo Google fica oculto por segurança enquanto
`VITE_GOOGLE_AUTH_ENABLED=false`. Depois de configurar o Client ID, o Client
Secret e as URLs de redirecionamento no provedor de autenticação, defina essa
variável como `true` e publique novamente.

## Banco de dados

As migrações versionadas ficam em `supabase/migrations`. Em um projeto
Supabase novo, aplique todas as migrações em ordem antes de liberar o acesso.
Elas incluem tabelas, funções, políticas de segurança e os buckets de arquivos
usados pelo sistema.

## Qualidade

```bash
npm run lint
npm run build
```

## Publicação

A aplicação pode ser hospedada independentemente do Lovable. Configure no
ambiente de produção as mesmas variáveis descritas em `.env.example` e
adicione o domínio publicado à lista de URLs permitidas do Supabase Auth para
login por Google, confirmação de email e recuperação de senha.
