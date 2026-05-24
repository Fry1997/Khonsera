-- Persist Gmail scan results so we don't re-query the same emails
-- and can offer previously-found-but-not-imported bookings later.

CREATE TABLE IF NOT EXISTS gmail_scanned_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  gmail_message_id text NOT NULL,
  sender text,
  subject text,
  parsed_type text,
  parsed_data jsonb,
  parse_failed boolean NOT NULL DEFAULT false,
  imported boolean NOT NULL DEFAULT false,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, user_id, gmail_message_id)
);
CREATE INDEX IF NOT EXISTS gmail_scanned_emails_user_idx
  ON gmail_scanned_emails(workspace_id, user_id);
