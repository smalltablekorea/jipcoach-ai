import { NextRequest, NextResponse } from "next/server";
import { createApiRouteClient } from "@/lib/supabase/server";
import { successResponse, errorResponse } from "@/types/api";

// GET /api/v1/market-data — 시장 기준 가격 조회
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
  const category = searchParams.get("category");
  const areaPyeong = searchParams.get("area_pyeong");
  const region = searchParams.get("region");

  let query = supabase
    .from("market_reference_data")
    .select("*")
    .order("process_category");

  if (category) {
    query = query.eq("process_category", category);
  }

  if (areaPyeong) {
    const area = parseFloat(areaPyeong);
    query = query.lte("area_range_min", area).gte("area_range_max", area);
  }

  if (region) {
    query = query.eq("region", region);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(errorResponse(error.message), { status: 500 });
  }

  return NextResponse.json(successResponse(data));
}
