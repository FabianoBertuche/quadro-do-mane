-- Promove todos os projetos com status DRAFT para ACTIVE e altera o default
-- do campo `status` na tabela `projects` para ACTIVE.
-- Decisão de produto: novos projetos já nascem como ativos por padrão.
-- Esta migration preserva projetos com status ARCHIVED/COMPLETED/PAUSED.

-- 1) Migra dados existentes: DRAFT → ACTIVE
UPDATE "projects"
SET "status" = 'ACTIVE'
WHERE "status" = 'DRAFT';

-- 2) Altera o default da coluna para ACTIVE
ALTER TABLE "projects"
ALTER COLUMN "status" SET DEFAULT 'ACTIVE';