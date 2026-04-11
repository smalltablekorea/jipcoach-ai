-- =============================================
-- 수동 분석 요청 테이블
-- =============================================

CREATE TABLE IF NOT EXISTS manual_review_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  estimate_id UUID NOT NULL REFERENCES uploaded_estimates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL DEFAULT 'parse_failed',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'refunded')),
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_manual_review_estimate ON manual_review_requests(estimate_id);
CREATE INDEX IF NOT EXISTS idx_manual_review_status ON manual_review_requests(status);

-- RLS
ALTER TABLE manual_review_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own manual review requests"
  ON manual_review_requests FOR SELECT USING (auth.uid() = user_id);
