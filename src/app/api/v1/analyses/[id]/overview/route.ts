import { NextRequest, NextResponse } from "next/server";
import { createApiRouteClient } from "@/lib/supabase/server";
import { successResponse, errorResponse } from "@/types/api";
import type { Analysis, UploadedEstimate, AttentionItemRow } from "@/types/database";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/v1/analyses/:id/overview — Tab1: 총평
export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return NextResponse.json(errorResponse("인증이 필요합니다."), { status: 401 });
  }

  const supabase = createApiRouteClient(authHeader);
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json(errorResponse("유효하지 않은 인증 토큰입니다."), { status: 401 });
  }

  const { data: rawAnalysis, error } = await supabase
    .from("analyses")
    .select("*")
    .eq("id", id)
    .single();
  const analysis = rawAnalysis as unknown as Analysis | null;

  if (error || !analysis) {
    if (error?.code === "PGRST116") {
      return NextResponse.json(errorResponse("분석 결과를 찾을 수 없습니다."), { status: 404 });
    }
    return NextResponse.json(errorResponse(error?.message ?? "분석 결과를 찾을 수 없습니다."), { status: error ? 500 : 404 });
  }

  const { data: rawEstimate } = await supabase
    .from("uploaded_estimates")
    .select("project_name, area_pyeong, area_sqm, estimate_date, designer_name, construction_amount, profit_overhead, billing_amount")
    .eq("id", analysis.estimate_id)
    .single();
  const estimate = rawEstimate as unknown as Pick<UploadedEstimate, "project_name" | "area_pyeong" | "area_sqm" | "estimate_date" | "designer_name" | "construction_amount" | "profit_overhead" | "billing_amount"> | null;

  // 주의항목 요약 (총평 탭에 표시되는 카드들)
  const { data: rawAttentionItems } = await supabase
    .from("attention_items")
    .select("title, description, savings_min, savings_max")
    .eq("analysis_id", id)
    .order("sort_order");
  const attentionItems = (rawAttentionItems ?? []) as unknown as Pick<AttentionItemRow, "title" | "description" | "savings_min" | "savings_max">[];

  return NextResponse.json(
    successResponse({
      project_name: estimate?.project_name ?? "",
      area_pyeong: estimate?.area_pyeong ?? 0,
      area_sqm: estimate?.area_sqm ?? 0,
      estimate_date: estimate?.estimate_date,
      designer_name: estimate?.designer_name,
      score: analysis.score,
      grade: analysis.grade,
      summary_text: analysis.summary_text,
      savings_min: analysis.savings_min,
      savings_max: analysis.savings_max,
      financial_summary: {
        construction_amount: estimate?.construction_amount ?? 0,
        profit_overhead: estimate?.profit_overhead ?? 0,
        billing_amount: estimate?.billing_amount ?? 0,
      },
      positive_points: analysis.positive_points,
      attention_summary: attentionItems.map((a) => ({
        title: a.title,
        description: a.description,
        savings_estimate: `약 ${(a.savings_min / 10000).toLocaleString()}~${(a.savings_max / 10000).toLocaleString()}만원 절감 가능`,
      })),
    })
  );
}
