import { NextRequest, NextResponse } from "next/server";
import { createApiRouteClient } from "@/lib/supabase/server";
import { successResponse, errorResponse } from "@/types/api";
import { runAnalysisPipeline } from "@/lib/ai/pipeline";

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/v1/estimates/:id/analyze — AI 분석 트리거
export async function POST(request: NextRequest, context: RouteContext) {
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

  // 견적서 존재 확인
  const { data: estimate, error: estError } = await supabase
    .from("uploaded_estimates")
    .select("id, status, extracted_text")
    .eq("id", id)
    .single();

  if (estError || !estimate) {
    return NextResponse.json(errorResponse("견적서를 찾을 수 없습니다."), { status: 404 });
  }

  // 이미 분석 중인지 확인
  if (estimate.status === "분석중" || estimate.status === "추출중") {
    return NextResponse.json(errorResponse("이미 분석이 진행 중입니다."), { status: 409 });
  }

  // 추출된 텍스트가 없으면 분석 불가
  if (!estimate.extracted_text) {
    return NextResponse.json(
      errorResponse("추출된 텍스트가 없습니다. 견적서 텍스트를 먼저 등록해주세요."),
      { status: 400 }
    );
  }

  // 재분석 여부 확인
  let forceReanalyze = false;
  try {
    const body = await request.json();
    forceReanalyze = body.force_reanalyze === true;
  } catch {
    // body 없어도 OK
  }

  if (estimate.status === "분석완료" && !forceReanalyze) {
    return NextResponse.json(
      errorResponse("이미 분석이 완료되었습니다. 재분석하려면 force_reanalyze: true를 전달해주세요."),
      { status: 409 }
    );
  }

  try {
    const result = await runAnalysisPipeline(id, user.id);
    return NextResponse.json(
      successResponse({
        analysis_id: result.analysisId,
        score: result.score,
        grade: result.grade,
        status: "분석완료",
      }),
      { status: 202 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "분석 중 오류가 발생했습니다.";

    // 파싱 실패: 수동 분석 안내 응답
    if (msg === "PARSE_FAILED") {
      return NextResponse.json(
        successResponse({
          status: "parse_failed",
          message: "자동 분석이 어려운 형식입니다. 수동 분석이 요청되었으며, 24시간 내 결과를 제공합니다.",
          manual_review: true,
        }),
        { status: 202 }
      );
    }

    return NextResponse.json(errorResponse(msg), { status: 500 });
  }
}
