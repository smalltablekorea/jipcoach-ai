import { NextRequest, NextResponse } from "next/server";
import { createApiRouteClient } from "@/lib/supabase/server";
import { successResponse, errorResponse } from "@/types/api";
import type { Analysis } from "@/types/database";

// GET /api/v1/analyses — 분석 결과 목록
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return NextResponse.json(errorResponse("인증이 필요합니다."), { status: 401 });
  }

  const supabase = createApiRouteClient(authHeader);
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json(errorResponse("유효하지 않은 인증 토큰입니다."), { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)), 100);
  const offset = (page - 1) * limit;

  type AnalysisWithEstimate = Pick<Analysis, "id" | "estimate_id" | "score" | "grade" | "savings_min" | "savings_max" | "created_at"> & {
    uploaded_estimates: {
      project_name: string | null;
      area_pyeong: number | null;
      status: string;
    };
  };

  const { data: rawData, error, count } = await supabase
    .from("analyses")
    .select(
      `
      id, estimate_id, score, grade, savings_min, savings_max, created_at,
      uploaded_estimates!inner(project_name, area_pyeong, status)
    `,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  const data = (rawData ?? []) as unknown as AnalysisWithEstimate[];

  if (error) {
    return NextResponse.json(errorResponse(error.message), { status: 500 });
  }

  const items = data.map((row) => {
    const est = row.uploaded_estimates;
    return {
      id: row.id,
      estimate_id: row.estimate_id,
      project_name: est.project_name,
      area_pyeong: est.area_pyeong,
      score: row.score,
      grade: row.grade,
      savings_min: row.savings_min,
      savings_max: row.savings_max,
      status: est.status,
      created_at: row.created_at,
    };
  });

  return NextResponse.json(
    successResponse({
      items,
      pagination: {
        page,
        limit,
        total: count ?? 0,
        total_pages: Math.ceil((count ?? 0) / limit),
      },
    })
  );
}
