import type { EstimateStatus } from "./database";

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T | null;
  error: string | null;
}

export interface PaginatedData<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export function successResponse<T>(data: T): ApiResponse<T> {
  return { success: true, data, error: null };
}

export function errorResponse(error: string): ApiResponse<null> {
  return { success: false, data: null, error };
}

export interface EstimateUploadResponse {
  estimate_id: string;
  file_name: string;
  status: EstimateStatus;
}

export interface AnalysisListItem {
  id: string;
  estimate_id: string;
  project_name: string | null;
  area_pyeong: number | null;
  score: number;
  grade: string;
  savings_min: number;
  savings_max: number;
  status: EstimateStatus;
  created_at: string;
}

export interface TriggerAnalysisRequest {
  force_reanalyze?: boolean;
}
