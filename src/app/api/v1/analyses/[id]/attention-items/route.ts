import { NextRequest, NextResponse } from "next/server";
import { createApiRouteClient } from "@/lib/supabase/server";
import { successResponse, errorResponse } from "@/types/api";
import type { AttentionItemRow, NegotiationTipRow } from "@/types/database";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/v1/analyses/:id/attention-items — Tab3: 주의항목 + 협상팁
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

  const [itemsRes, tipsRes] = await Promise.all([
    supabase.from("attention_items").select("*").eq("analysis_id", id).order("sort_order"),
    supabase.from("negotiation_tips").select("*").eq("analysis_id", id).order("sort_order"),
  ]);

  const items = (itemsRes.data ?? []) as unknown as AttentionItemRow[];
  const tips = (tipsRes.data ?? []) as unknown as NegotiationTipRow[];

  return NextResponse.json(
    successResponse({
      total_savings_min: items.reduce((sum, a) => sum + a.savings_min, 0),
      total_savings_max: items.reduce((sum, a) => sum + a.savings_max, 0),
      items,
      negotiation_tips: tips.map((t) => t.tip_text),
    })
  );
}
