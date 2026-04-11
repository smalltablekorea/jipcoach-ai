import { NextRequest, NextResponse } from "next/server";
import { createApiRouteClient } from "@/lib/supabase/server";
import { successResponse, errorResponse } from "@/types/api";
import type { MissingItemRow, ContractorQuestionRow } from "@/types/database";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/v1/analyses/:id/missing-items — Tab4: 누락항목 + 질문
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

  const { error: analysisError } = await supabase
    .from("analyses")
    .select("id")
    .eq("id", id)
    .single();

  if (analysisError) {
    return NextResponse.json(errorResponse("분석 결과를 찾을 수 없습니다."), { status: 404 });
  }

  const [missingRes, questionsRes] = await Promise.all([
    supabase.from("missing_items").select("*").eq("analysis_id", id).order("sort_order"),
    supabase.from("contractor_questions").select("*").eq("analysis_id", id).order("sort_order"),
  ]);
  const missingItems = (missingRes.data ?? []) as unknown as MissingItemRow[];
  const questions = (questionsRes.data ?? []) as unknown as ContractorQuestionRow[];

  return NextResponse.json(
    successResponse({
      missing_items: missingItems.map((m) => m.item_text),
      contractor_questions: questions.map((q) => q.question_text),
    })
  );
}
