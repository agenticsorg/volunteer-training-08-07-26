-- Local/dev database bootstrap for docker-compose's postgres service.
-- gen_random_uuid() (used throughout prisma/schema.prisma) is provided by pgcrypto on Postgres 15.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
