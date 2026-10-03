alter table public.client_contracts add column if not exists signed_url text, add column if not exists signature_provider text;
alter table public.client_contracts add constraint client_contracts_signed_url_https check (signed_url is null or signed_url ~ '^https://[^[:space:]]+$');
alter table public.client_contracts add constraint client_contracts_signature_provider_check check (signature_provider is null or signature_provider in ('zapsign','autentique','other'));
alter table public.clients add column if not exists churned boolean not null default false, add column if not exists churn_date date, add column if not exists churn_reason text, add column if not exists churn_notes text;
alter table public.clients add constraint clients_churn_details_check check (not churned or (churn_date is not null and nullif(btrim(churn_reason), '') is not null));
