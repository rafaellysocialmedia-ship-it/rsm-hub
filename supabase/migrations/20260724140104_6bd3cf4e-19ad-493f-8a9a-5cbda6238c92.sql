-- 1. Add deadline fields to clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS profile_project_deadline date,
  ADD COLUMN IF NOT EXISTS editorial_deadline date;

-- 2. Add screenshot to client_baselines
ALTER TABLE public.client_baselines
  ADD COLUMN IF NOT EXISTS screenshot_path text;

-- 3. Add "projeto_perfil" category to file_category enum
ALTER TYPE public.file_category ADD VALUE IF NOT EXISTS 'projeto_perfil';