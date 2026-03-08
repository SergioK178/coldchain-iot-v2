-- Activation token for Wi-Fi AP claim flow
ALTER TABLE devices ADD COLUMN IF NOT EXISTS activation_token VARCHAR(64);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS activation_token_expires_at TIMESTAMPTZ;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS devices_activation_token_idx ON devices(activation_token) WHERE activation_token IS NOT NULL;
