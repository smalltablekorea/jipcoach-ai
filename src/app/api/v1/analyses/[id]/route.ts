import { NextRequest, NextResponse } from "next/server";
import { createApiRouteClient } from "@/lib/supabase/server";
import { successResponse, errorResponse } from "@/types/api";
import { maskCompanyNames } from "@/lib/utils/analysis-masking";
import { maskName } from "@/lib/utils/masking";
import type { Analysis, UploadedEstimate, ProcessAnalysisRow, AttentionItemRow, NegotiationTipRow, MissingItemRow, ContractorQuestionRow } from "@/types/database";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/v1/analyses/:id — 전체 분석 결과 (4탭 전체)
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

  // 분석 메인 데이터
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

  // 견적서 정보
  const { data: rawEstimate } = await supabase
    .from("uploaded_estimates")
    .select("project_name, area_pyeong, area_sqm, estimate_date, designer_name, construction_amount, profit_overhead, billing_amount")
    .eq("id", analysis.estimate_id)
    .single();
  const estimate = rawEstimate as unknown as Pick<UploadedEstimate, "project_name" | "area_pyeong" | "area_sqm" | "estimate_date" | "designer_name" | "construction_amount" | "profit_overhead" | "billing_amount"> | null;

  // 하위 데이터 병렬 조회
  const [processesRes, attentionRes, tipsRes, missingRes, questionsRes] = await Promise.all([
    supabase.from("process_analyses").select("*").eq("analysis_id", id).order("sort_order"),
    supabase.from("attention_items").select("*").eq("analysis_id", id).order("sort_order"),
    supabase.from("negotiation_tips").select("*").eq("analysis_id", id).order("sort_order"),
    supabase.from("missing_items").select("*").eq("analysis_id", id).order("sort_order"),
    supabase.from("contractor_questions").select("*").eq("analysis_id", id).order("sort_order"),
  ]);
  const processes = (processesRes.data ?? []) as unknown as ProcessAnalysisRow[];
  const attentionItems = (attentionRes.data ?? []) as unknown as AttentionItemRow[];
  const tips = (tipsRes.data ?? []) as unknown as NegotiationTipRow[];
  const missingItems = (missingRes.data ?? []) as unknown as MissingItemRow[];
  const questions = (questionsRes.data ?? []) as unknown as ContractorQuestionRow[];

  // 업체명 마스킹 적용 (summary, attention descriptions, tips 등)
  const maskedSummary = maskCompanyNames(analysis.summary_text);
  const maskedAttentionItems = attentionItems.map((a) => ({
    ...a,
    title: maskCompanyNames(a.title),
    description: maskCompanyNames(a.description),
  }));
  const maskedTips = tips.map((t) => ({
    ...t,
    tip_text: maskCompanyNames(t.tip_text),
  }));

  return NextResponse.json(
    successResponse({
      overview: {
        project_name: estimate?.project_name ?? "",
        area_pyeong: estimate?.area_pyeong ?? 0,
        area_sqm: estimate?.area_sqm ?? 0,
        estimate_date: estimate?.estimate_date,
        designer_name: estimate?.designer_name ? maskName(estimate.designer_name) : null,
        score: analysis.score,
        grade: analysis.grade,
        summary_text: maskedSummary,
        savings_min: analysis.savings_min,
        savings_max: analysis.savings_max,
        financial_summary: {
          construction_amount: estimate?.construction_amount ?? 0,
          profit_overhead: estimate?.profit_overhead ?? 0,
          billing_amount: estimate?.billing_amount ?? 0,
        },
        positive_points: analysis.positive_points,
      },
      processes: {
        total_amount: processes.reduce((sum, p) => sum + p.amount, 0),
        processes,
      },
      attention: {
        total_savings_min: maskedAttentionItems.reduce((sum, a) => sum + a.savings_min, 0),
        total_savings_max: maskedAttentionItems.reduce((sum, a) => sum + a.savings_max, 0),
        items: maskedAttentionItems,
        negotiation_tips: maskedTips.map((t) => t.tip_text),
      },
      missing: {
        missing_items: missingItems.map((m) => m.item_text),
        contractor_questions: questions.map((q) => q.question_text),
      },
    })
  );
}

// DELETE /api/v1/analyses/:id — 분석 결과 삭제
export async function DELETE(request: NextRequest, context: RouteContext) {
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

  const { error } = await supabase
    .from("analyses")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json(errorResponse(error.message), { status: 500 });
  }

  return NextResponse.json(successResponse({ deleted: true }));
}
