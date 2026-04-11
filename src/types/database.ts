export type EstimateStatus = "업로드완료" | "추출중" | "추출완료" | "분석중" | "분석완료" | "오류";
export type StatusBadge = "적정" | "주의" | "높음";
export type Severity = "높음" | "주의";
export type ItemType = "labor" | "material" | "work";
export type PriceType = "per_pyeong" | "total";

export interface Database {
  public: {
    Tables: {
      uploaded_estimates: {
        Row: {
          id: string;
          user_id: string;
          file_name: string;
          file_type: "pdf" | "image";
          file_size: number;
          storage_path: string;
          page_count: number;
          project_name: string | null;
          area_pyeong: number | null;
          area_sqm: number | null;
          designer_name: string | null;
          estimate_date: string | null;
          construction_amount: number;
          profit_overhead: number;
          billing_amount: number;
          status: EstimateStatus;
          error_message: string | null;
          extracted_text: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          file_name: string;
          file_type: "pdf" | "image";
          file_size: number;
          storage_path: string;
          page_count?: number;
          project_name?: string | null;
          area_pyeong?: number | null;
          area_sqm?: number | null;
          designer_name?: string | null;
          estimate_date?: string | null;
          construction_amount?: number;
          profit_overhead?: number;
          billing_amount?: number;
          status?: EstimateStatus;
          error_message?: string | null;
          extracted_text?: string | null;
        };
        Update: {
          file_name?: string;
          project_name?: string | null;
          area_pyeong?: number | null;
          area_sqm?: number | null;
          designer_name?: string | null;
          estimate_date?: string | null;
          construction_amount?: number;
          profit_overhead?: number;
          billing_amount?: number;
          status?: EstimateStatus;
          error_message?: string | null;
          extracted_text?: string | null;
        };
        Relationships: [];
      };
      estimate_line_items: {
        Row: {
          id: string;
          estimate_id: string;
          process_category: string;
          item_name: string;
          specification: string;
          quantity: number;
          unit: string;
          unit_price: number;
          amount: number;
          item_type: ItemType;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          estimate_id: string;
          process_category: string;
          item_name: string;
          specification?: string;
          quantity?: number;
          unit?: string;
          unit_price?: number;
          amount?: number;
          item_type?: ItemType;
          sort_order?: number;
        };
        Update: {
          process_category?: string;
          item_name?: string;
          specification?: string;
          quantity?: number;
          unit?: string;
          unit_price?: number;
          amount?: number;
          item_type?: ItemType;
          sort_order?: number;
        };
        Relationships: [];
      };
      analyses: {
        Row: {
          id: string;
          estimate_id: string;
          user_id: string;
          score: number;
          grade: string;
          summary_text: string;
          savings_min: number;
          savings_max: number;
          positive_points: { title: string; description: string }[];
          ai_model: string;
          ai_tokens_used: number;
          analysis_duration_ms: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          estimate_id: string;
          user_id: string;
          score: number;
          grade: string;
          summary_text?: string;
          savings_min?: number;
          savings_max?: number;
          positive_points?: { title: string; description: string }[];
          ai_model?: string;
          ai_tokens_used?: number;
          analysis_duration_ms?: number;
        };
        Update: {
          score?: number;
          grade?: string;
          summary_text?: string;
          savings_min?: number;
          savings_max?: number;
          positive_points?: { title: string; description: string }[];
          ai_model?: string;
          ai_tokens_used?: number;
          analysis_duration_ms?: number;
        };
        Relationships: [];
      };
      process_analyses: {
        Row: {
          id: string;
          analysis_id: string;
          process_category: string;
          emoji_icon: string;
          amount: number;
          market_avg_amount: number;
          market_min_amount: number;
          market_max_amount: number;
          deviation_percent: number;
          status_badge: StatusBadge;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          analysis_id: string;
          process_category: string;
          emoji_icon?: string;
          amount?: number;
          market_avg_amount?: number;
          market_min_amount?: number;
          market_max_amount?: number;
          deviation_percent?: number;
          status_badge?: StatusBadge;
          sort_order?: number;
        };
        Update: {
          process_category?: string;
          emoji_icon?: string;
          amount?: number;
          market_avg_amount?: number;
          market_min_amount?: number;
          market_max_amount?: number;
          deviation_percent?: number;
          status_badge?: StatusBadge;
          sort_order?: number;
        };
        Relationships: [];
      };
      attention_items: {
        Row: {
          id: string;
          analysis_id: string;
          severity: Severity;
          title: string;
          description: string;
          savings_min: number;
          savings_max: number;
          related_process: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          analysis_id: string;
          severity: Severity;
          title: string;
          description?: string;
          savings_min?: number;
          savings_max?: number;
          related_process?: string | null;
          sort_order?: number;
        };
        Update: {
          severity?: Severity;
          title?: string;
          description?: string;
          savings_min?: number;
          savings_max?: number;
          related_process?: string | null;
          sort_order?: number;
        };
        Relationships: [];
      };
      negotiation_tips: {
        Row: { id: string; analysis_id: string; tip_text: string; sort_order: number; created_at: string };
        Insert: { id?: string; analysis_id: string; tip_text: string; sort_order?: number };
        Update: { tip_text?: string; sort_order?: number };
        Relationships: [];
      };
      missing_items: {
        Row: { id: string; analysis_id: string; item_text: string; sort_order: number; created_at: string };
        Insert: { id?: string; analysis_id: string; item_text: string; sort_order?: number };
        Update: { item_text?: string; sort_order?: number };
        Relationships: [];
      };
      contractor_questions: {
        Row: { id: string; analysis_id: string; question_text: string; sort_order: number; created_at: string };
        Insert: { id?: string; analysis_id: string; question_text: string; sort_order?: number };
        Update: { question_text?: string; sort_order?: number };
        Relationships: [];
      };
      market_reference_data: {
        Row: {
          id: string;
          process_category: string;
          area_range_min: number;
          area_range_max: number;
          price_type: PriceType;
          avg_price: number;
          min_price: number;
          max_price: number;
          data_source: string;
          last_updated: string;
          region: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          process_category: string;
          area_range_min: number;
          area_range_max: number;
          price_type?: PriceType;
          avg_price: number;
          min_price: number;
          max_price: number;
          data_source?: string;
          region?: string;
        };
        Update: {
          process_category?: string;
          area_range_min?: number;
          area_range_max?: number;
          price_type?: PriceType;
          avg_price?: number;
          min_price?: number;
          max_price?: number;
          data_source?: string;
          region?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type UploadedEstimate = Database["public"]["Tables"]["uploaded_estimates"]["Row"];
export type Analysis = Database["public"]["Tables"]["analyses"]["Row"];
export type ProcessAnalysisRow = Database["public"]["Tables"]["process_analyses"]["Row"];
export type AttentionItemRow = Database["public"]["Tables"]["attention_items"]["Row"];
export type NegotiationTipRow = Database["public"]["Tables"]["negotiation_tips"]["Row"];
export type MissingItemRow = Database["public"]["Tables"]["missing_items"]["Row"];
export type ContractorQuestionRow = Database["public"]["Tables"]["contractor_questions"]["Row"];
export type MarketReferenceData = Database["public"]["Tables"]["market_reference_data"]["Row"];
