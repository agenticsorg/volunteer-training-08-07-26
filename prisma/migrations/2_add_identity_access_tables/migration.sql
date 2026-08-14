-- MailboxAuthorization table with RLS
CREATE TABLE mailbox_authorizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mailbox_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('gmail', 'outlook')),
  scope_set JSONB NOT NULL,
  consent_granted_at TIMESTAMP NOT NULL,
  last_token_refreshed_at TIMESTAMP,
  credential_handle TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id, mailbox_id, platform)
);

-- RLS on mailbox_authorizations
ALTER TABLE mailbox_authorizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON mailbox_authorizations
  USING (tenant_id = current_setting('row_security_context.tenant_id')::UUID);

-- Indexes
CREATE INDEX idx_mailbox_authorizations_tenant_id ON mailbox_authorizations(tenant_id);
CREATE INDEX idx_mailbox_authorizations_user_id ON mailbox_authorizations(user_id);
CREATE INDEX idx_mailbox_authorizations_mailbox_id ON mailbox_authorizations(mailbox_id);
CREATE INDEX idx_mailbox_authorizations_status ON mailbox_authorizations(status);

-- ConsentGrant table with RLS
CREATE TABLE consent_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mailbox_authorization_id UUID NOT NULL REFERENCES mailbox_authorizations(id) ON DELETE CASCADE,
  scope_set JSONB NOT NULL,
  granted_at TIMESTAMP NOT NULL,
  consent_proof_url TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- RLS on consent_grants
ALTER TABLE consent_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_consent_grants ON consent_grants
  USING (
    mailbox_authorization_id IN (
      SELECT id FROM mailbox_authorizations
      WHERE tenant_id = current_setting('row_security_context.tenant_id')::UUID
    )
  );

-- Indexes
CREATE INDEX idx_consent_grants_mailbox_authorization_id ON consent_grants(mailbox_authorization_id);

-- OAuthProvider table (global, no RLS)
CREATE TABLE oauth_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL UNIQUE CHECK (platform IN ('gmail', 'outlook')),
  client_id TEXT NOT NULL,
  client_secret_vault_ref TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  min_scopes JSONB NOT NULL,
  admin_scopes JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Add auth_provider and auth_subject columns to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS auth_provider TEXT,
ADD COLUMN IF NOT EXISTS auth_subject TEXT;
