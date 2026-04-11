// Tab 1: 총평
export interface AnalysisOverview {
  project_name: string;
  area_pyeong: number;
  area_sqm: number;
  estimate_date: string | null;
  designer_name: string | null;
  score: number;
  grade: string;
  summary_text: string;
  savings_min: number;
  savings_max: number;
  financial_summary: {
    construction_amount: number;
    profit_overhead: number;
    billing_amount: number;
  };
  positive_points: { title: string; description: string }[];
  attention_summary: {
    title: string;
    description: string;
    savings_estimate: string;
  }[];
}

// Tab 2: 공정별 분석
export interface ProcessAnalysis {
  id: string;
  process_category: string;
  emoji_icon: string;
  amount: number;
  status_badge: "적정" | "주의" | "높음";
  deviation_percent: number;
  market_avg_amount: number;
  market_min_amount: number;
  market_max_amount: number;
}

export interface ProcessAnalysisResponse {
  total_amount: number;
  processes: ProcessAnalysis[];
}

// Tab 3: 주의항목
export interface AttentionItem {
  id: string;
  severity: "높음" | "주의";
  title: string;
  description: string;
  savings_min: number;
  savings_max: number;
  related_process: string | null;
}

export interface AttentionItemsResponse {
  total_savings_min: number;
  total_savings_max: number;
  items: AttentionItem[];
  negotiation_tips: string[];
}

// Tab 4: 누락 확인
export interface MissingItemsResponse {
  missing_items: string[];
  contractor_questions: string[];
}

// AI 파이프라인이 Claude에게 받아올 전체 분석 결과
export interface FullAnalysisResult {
  score: number;
  grade: string;
  summary_text: string;
  savings_min: number;
  savings_max: number;
  financial_summary: {
    construction_amount: number;
    profit_overhead: number;
    billing_amount: number;
  };
  positive_points: { title: string; description: string }[];
  processes: {
    process_category: string;
    emoji_icon: string;
    amount: number;
    status_badge: "적정" | "주의" | "높음";
    deviation_percent: number;
    market_avg_amount: number;
  }[];
  attention_items: {
    severity: "높음" | "주의";
    title: string;
    description: string;
    savings_min: number;
    savings_max: number;
    related_process: string | null;
  }[];
  negotiation_tips: string[];
  missing_items: string[];
  contractor_questions: string[];
}
