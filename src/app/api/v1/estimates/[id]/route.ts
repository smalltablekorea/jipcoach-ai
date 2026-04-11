import { NextRequest, NextResponse } from "next/server";
import { createApiRouteClient } from "@/lib/supabase/server";
import { successResponse, errorResponse } from "@/types/api";
import { maskPII, maskName } from "@/lib/utils/masking";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/v1/estimates/:id — 견적서 상세 + 추출 항목
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

  const { data: rawEstimate, error } = await supabase
    .from("uploaded_estimates")
    .select("*")
    .eq("id", id)
    .single();
  const estimate = rawEstimate as unknown as Record<string, unknown> | null;

  if (error || !estimate) {
    if (error?.code === "PGRST116") {
      return NextResponse.json(errorResponse("견적서를 찾을 수 없습니다."), { status: 404 });
    }
    return NextResponse.json(errorResponse(error?.message ?? "견적서를 찾을 수 없습니다."), { status: error ? 500 : 404 });
  }

  // 추출된 항목도 함께 조회
  const { data: lineItems } = await supabase
    .from("estimate_line_items")
    .select("*")
    .eq("estimate_id", id)
    .order("sort_order", { ascending: true });

  // 개인정보 마스킹 적용
  const maskedEstimate = {
    ...estimate,
    designer_name: typeof estimate.designer_name === "string" ? maskName(estimate.designer_name) : null,
    extracted_text: typeof estimate.extracted_text === "string" ? maskPII(estimate.extracted_text) : null,
  };

  return NextResponse.json(
    successResponse({
      ...maskedEstimate,
      line_items: lineItems ?? [],
    })
  );
}

// DELETE /api/v1/estimates/:id — 견적서 삭제
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

  // 견적서 정보 조회 (storage_path 필요)
  const { data: rawEst } = await supabase
    .from("uploaded_estimates")
    .select("storage_path")
    .eq("id", id)
    .single();
  const est = rawEst as unknown as { storage_path: string } | null;

  if (!est) {
    return NextResponse.json(errorResponse("견적서를 찾을 수 없습니다."), { status: 404 });
  }

  // Storage 파일 삭제
  await supabase.storage
    .from("estimate-files")
    .remove([est.storage_path]);

  // DB 레코드 삭제 (CASCADE로 analyses, line_items 등 자동 삭제)
  const { error } = await supabase
    .from("uploaded_estimates")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json(errorResponse(error.message), { status: 500 });
  }

  return NextResponse.json(successResponse({ deleted: true }));
}
