import { NextRequest, NextResponse } from "next/server";
import { createApiRouteClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { successResponse, errorResponse } from "@/types/api";

function untypedAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// GET /api/v1/credits — 크레딧 잔액 조회
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

  const admin = untypedAdmin();
  const { data } = await admin
    .from("user_credits")
    .select("balance")
    .eq("user_id", user.id)
    .single();

  return NextResponse.json(
    successResponse({
      balance: (data as { balance: number } | null)?.balance ?? 0,
    })
  );
}

// POST /api/v1/credits — 크레딧 1회 사용 (프로 분석)
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return NextResponse.json(errorResponse("인증이 필요합니다."), { status: 401 });
  }

  const supabase = createApiRouteClient(authHeader);
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json(errorResponse("유효하지 않은 인증 토큰입니다."), { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const estimateId = body?.estimate_id;
  if (!estimateId) {
    return NextResponse.json(errorResponse("estimate_id가 필요합니다."), { status: 400 });
  }

  const admin = untypedAdmin();

  // 1. 크레딧 잔액 확인
  const { data: credits } = await admin
    .from("user_credits")
    .select("balance")
    .eq("user_id", user.id)
    .single();

  const balance = (credits as { balance: number } | null)?.balance ?? 0;

  if (balance < 1) {
    return NextResponse.json(
      errorResponse("크레딧이 부족합니다. 충전 후 다시 시도해주세요."),
      { status: 402 }
    );
  }

  // 2. 이미 분석 완료된 견적서인지 확인
  const { data: existingAnalysis } = await admin
    .from("analyses")
    .select("id")
    .eq("estimate_id", estimateId)
    .limit(1);

  if (((existingAnalysis ?? []) as unknown[]).length > 0) {
    return NextResponse.json(
      successResponse({
        message: "이미 분석이 완료된 견적서입니다.",
        already_analyzed: true,
        balance,
      })
    );
  }

  // 3. 크레딧 차감
  const newBalance = balance - 1;
  await admin
    .from("user_credits")
    .upsert({
      user_id: user.id,
      balance: newBalance,
      updated_at: new Date().toISOString(),
    });

  await admin.from("credit_transactions").insert({
    user_id: user.id,
    amount: -1,
    balance_after: newBalance,
    reason: `프로 분석: ${estimateId}`,
    reference_id: estimateId,
  });

  // 4. 분석 파이프라인 실행
  try {
    const { runAnalysisPipeline } = await import("@/lib/ai/pipeline");
    const result = await runAnalysisPipeline(estimateId, user.id);

    return NextResponse.json(
      successResponse({
        analysis_id: result.analysisId,
        score: result.score,
        grade: result.grade,
        balance: newBalance,
        message: "프로 분석이 완료되었습니다.",
      })
    );
  } catch (error) {
    // 분석 실패 시 크레딧 복구
    await admin
      .from("user_credits")
      .update({ balance, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);

    await admin.from("credit_transactions").insert({
      user_id: user.id,
      amount: 1,
      balance_after: balance,
      reason: `분석 실패 크레딧 복구: ${estimateId}`,
      reference_id: estimateId,
    });

    const msg = error instanceof Error ? error.message : "분석 실패";
    return NextResponse.json(errorResponse(msg), { status: 500 });
  }
}
