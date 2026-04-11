import { NextRequest, NextResponse } from "next/server";
import { createApiRouteClient } from "@/lib/supabase/server";
import { successResponse, errorResponse } from "@/types/api";
import type { ProcessAnalysisRow } from "@/types/database";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/v1/analyses/:id/processes — Tab2: 공정별 분석
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

  // 분석 존재 확인
  const { error: analysisError } = await supabase
    .from("analyses")
    .select("id")
    .eq("id", id)
    .single();

  if (analysisError) {
    return NextResponse.json(errorResponse("분석 결과를 찾을 수 없습니다."), { status: 404 });
  }

  const { data: rawData, error } = await supabase
    .from("process_analyses")
    .select("*")
    .eq("analysis_id", id)
    .order("sort_order");

  if (error) {
    return NextResponse.json(errorResponse(error.message), { status: 500 });
  }

  const processes = (rawData ?? []) as unknown as ProcessAnalysisRow[];
  const totalAmount = processes.reduce((sum, p) => sum + p.amount, 0);

  return NextResponse.json(
    successResponse({
      total_amount: totalAmount,
      processes,
    })
  );
}
