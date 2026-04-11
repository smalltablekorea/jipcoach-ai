-- =============================================
-- 집코치 AI견적분석 - 초기 DB 스키마
-- Supabase SQL Editor에서 실행하세요
-- =============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ═══ uploaded_estimates (업로드된 견적서) ═══
CREATE TABLE public.uploaded_estimates (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name         TEXT NOT NULL,
  file_type         TEXT NOT NULL CHECK (file_type IN ('pdf', 'image')),
  file_size         INTEGER NOT NULL,
  storage_path      TEXT NOT NULL,
  page_count        INTEGER DEFAULT 1,
  project_name      TEXT,
  area_pyeong       NUMERIC(6,1),
  area_sqm          NUMERIC(8,2),
  designer_name     TEXT,
  estimate_date     DATE,
  construction_amount BIGINT NOT NULL DEFAULT 0,
  profit_overhead   BIGINT NOT NULL DEFAULT 0,
  billing_amount    BIGINT NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT '업로드완료'
                    CHECK (status IN ('업로드완료','추출중','추출완료','분석중','분석완료','오류')),
  error_message     TEXT,
  extracted_text    TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_estimates_user ON uploaded_estimates(user_id);
CREATE INDEX idx_estimates_status ON uploaded_estimates(status);
CREATE INDEX idx_estimates_created ON uploaded_estimates(created_at DESC);

-- ═══ estimate_line_items (견적서 추출 항목) ═══
CREATE TABLE public.estimate_line_items (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  estimate_id       UUID NOT NULL REFERENCES uploaded_estimates(id) ON DELETE CASCADE,
  process_category  TEXT NOT NULL,
  item_name         TEXT NOT NULL,
  specification     TEXT DEFAULT '',
  quantity          NUMERIC(10,2) DEFAULT 0,
  unit              TEXT DEFAULT '',
  unit_price        BIGINT DEFAULT 0,
  amount            BIGINT DEFAULT 0,
  item_type         TEXT DEFAULT 'work' CHECK (item_type IN ('labor','material','work')),
  sort_order        INTEGER DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_line_items_estimate ON estimate_line_items(estimate_id);

-- ═══ analyses (AI 분석 결과 메인) ═══
CREATE TABLE public.analyses (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  estimate_id         UUID NOT NULL REFERENCES uploaded_estimates(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score               INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  grade               TEXT NOT NULL,
  summary_text        TEXT NOT NULL DEFAULT '',
  savings_min         BIGINT DEFAULT 0,
  savings_max         BIGINT DEFAULT 0,
  positive_points     JSONB DEFAULT '[]'::JSONB,
  ai_model            TEXT DEFAULT 'claude-sonnet-4-20250514',
  ai_tokens_used      INTEGER DEFAULT 0,
  analysis_duration_ms INTEGER DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_analyses_estimate ON analyses(estimate_id);
CREATE INDEX idx_analyses_user ON analyses(user_id);
CREATE UNIQUE INDEX idx_analyses_estimate_unique ON analyses(estimate_id);

-- ═══ process_analyses (공정별 분석 - Tab2) ═══
CREATE TABLE public.process_analyses (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  analysis_id       UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  process_category  TEXT NOT NULL,
  emoji_icon        TEXT DEFAULT '',
  amount            BIGINT NOT NULL DEFAULT 0,
  market_avg_amount BIGINT DEFAULT 0,
  market_min_amount BIGINT DEFAULT 0,
  market_max_amount BIGINT DEFAULT 0,
  deviation_percent NUMERIC(5,1) DEFAULT 0,
  status_badge      TEXT NOT NULL DEFAULT '적정'
                    CHECK (status_badge IN ('적정','주의','높음')),
  sort_order        INTEGER DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_process_analysis ON process_analyses(analysis_id);

-- ═══ attention_items (주의항목 - Tab3) ═══
CREATE TABLE public.attention_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  analysis_id     UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  severity        TEXT NOT NULL CHECK (severity IN ('높음','주의')),
  title           TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  savings_min     BIGINT DEFAULT 0,
  savings_max     BIGINT DEFAULT 0,
  related_process TEXT,
  sort_order      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_attention_analysis ON attention_items(analysis_id);

-- ═══ negotiation_tips (협상 팁) ═══
CREATE TABLE public.negotiation_tips (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  analysis_id   UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  tip_text      TEXT NOT NULL,
  sort_order    INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tips_analysis ON negotiation_tips(analysis_id);

-- ═══ missing_items (누락 항목 - Tab4) ═══
CREATE TABLE public.missing_items (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  analysis_id   UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  item_text     TEXT NOT NULL,
  sort_order    INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_missing_analysis ON missing_items(analysis_id);

-- ═══ contractor_questions (업체 확인 질문) ═══
CREATE TABLE public.contractor_questions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  analysis_id     UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  question_text   TEXT NOT NULL,
  sort_order      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_questions_analysis ON contractor_questions(analysis_id);

-- ═══ market_reference_data (시장 기준 가격) ═══
CREATE TABLE public.market_reference_data (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  process_category  TEXT NOT NULL,
  area_range_min    NUMERIC(6,1) NOT NULL,
  area_range_max    NUMERIC(6,1) NOT NULL,
  price_type        TEXT NOT NULL DEFAULT 'per_pyeong'
                    CHECK (price_type IN ('per_pyeong','total')),
  avg_price         BIGINT NOT NULL,
  min_price         BIGINT NOT NULL,
  max_price         BIGINT NOT NULL,
  data_source       TEXT DEFAULT '',
  last_updated      DATE DEFAULT CURRENT_DATE,
  region            TEXT DEFAULT '서울',
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_market_category ON market_reference_data(process_category);

-- ═══ updated_at 자동 갱신 트리거 ═══
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_estimates_updated BEFORE UPDATE ON uploaded_estimates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_analyses_updated BEFORE UPDATE ON analyses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_market_updated BEFORE UPDATE ON market_reference_data
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══ RLS 정책 ═══

-- uploaded_estimates
ALTER TABLE uploaded_estimates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_estimates_select" ON uploaded_estimates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own_estimates_insert" ON uploaded_estimates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_estimates_update" ON uploaded_estimates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own_estimates_delete" ON uploaded_estimates FOR DELETE USING (auth.uid() = user_id);

-- estimate_line_items (부모 통해 간접 RLS)
ALTER TABLE estimate_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_line_items" ON estimate_line_items FOR ALL
  USING (EXISTS (SELECT 1 FROM uploaded_estimates WHERE id = estimate_line_items.estimate_id AND user_id = auth.uid()));

-- analyses
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_analyses_select" ON analyses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own_analyses_insert" ON analyses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_analyses_update" ON analyses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own_analyses_delete" ON analyses FOR DELETE USING (auth.uid() = user_id);

-- 하위 테이블들 (analysis_id 통해 간접 RLS)
ALTER TABLE process_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_process_analyses" ON process_analyses FOR ALL
  USING (EXISTS (SELECT 1 FROM analyses WHERE id = process_analyses.analysis_id AND user_id = auth.uid()));

ALTER TABLE attention_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_attention_items" ON attention_items FOR ALL
  USING (EXISTS (SELECT 1 FROM analyses WHERE id = attention_items.analysis_id AND user_id = auth.uid()));

ALTER TABLE negotiation_tips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_negotiation_tips" ON negotiation_tips FOR ALL
  USING (EXISTS (SELECT 1 FROM analyses WHERE id = negotiation_tips.analysis_id AND user_id = auth.uid()));

ALTER TABLE missing_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_missing_items" ON missing_items FOR ALL
  USING (EXISTS (SELECT 1 FROM analyses WHERE id = missing_items.analysis_id AND user_id = auth.uid()));

ALTER TABLE contractor_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_contractor_questions" ON contractor_questions FOR ALL
  USING (EXISTS (SELECT 1 FROM analyses WHERE id = contractor_questions.analysis_id AND user_id = auth.uid()));

-- market_reference_data (모든 인증 사용자 읽기 가능)
ALTER TABLE market_reference_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read_market" ON market_reference_data FOR SELECT
  USING (auth.role() = 'authenticated');
