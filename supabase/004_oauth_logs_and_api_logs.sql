-- =============================================
-- OAuth 에러 로그 + API 비용 로그
-- =============================================

-- OAuth 에러 로그 (P1-6)
CREATE TABLE IF NOT EXISTS oauth_error_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  error_type TEXT NOT NULL,
  description TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oauth_logs_type ON oauth_error_logs(error_type);
CREATE INDEX IF NOT EXISTS idx_oauth_logs_date ON oauth_error_logs(created_at);

-- API 비용 로그 (P2-11)
CREATE TABLE IF NOT EXISTS api_cost_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  estimate_id UUID REFERENCES uploaded_estimates(id) ON DELETE SET NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_krw NUMERIC(10, 2) NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_costs_user ON api_cost_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_api_costs_date ON api_cost_logs(created_at);

-- 추천/레퍼럴 (P2-12)
CREATE TABLE IF NOT EXISTS referral_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS referral_uses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referral_code TEXT NOT NULL REFERENCES referral_codes(code),
  referred_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rewarded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_uses_code ON referral_uses(referral_code);

-- RLS
ALTER TABLE api_cost_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_uses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own api costs"
  ON api_cost_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view own referral codes"
  ON referral_codes FOR SELECT USING (auth.uid() = user_id);
