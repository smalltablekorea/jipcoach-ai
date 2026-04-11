import { NextRequest, NextResponse } from "next/server";
import { createApiRouteClient } from "@/lib/supabase/server";
import { successResponse, errorResponse } from "@/types/api";
import { createClient } from "@supabase/supabase-js";

interface Payment {
  id: string;
  user_id: string;
  order_id: string;
  payment_key: string | null;
  product_name: string;
  amount: number;
  credits_granted: number;
  status: string;
  paid_at: string | null;
  created_at: string;
}

// 타입 미정의 테이블용 untyped admin client
function untypedAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

const REFUND_WINDOW_MS = 24 * 60 * 60 * 1000; // 24시간

// POST /api/v1/refund — 환불 요청
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
  if (!body?.payment_id || !body?.reason) {
    return NextResponse.json(
      errorResponse("payment_id와 reason이 필요합니다."),
      { status: 400 }
    );
  }

  const { payment_id, reason, amount: requestedAmount } = body as {
    payment_id: string;
    reason: string;
    amount?: number;
  };

  const admin = untypedAdmin();

  // 1. 결제 정보 조회
  const { data: rawPayment, error: paymentError } = await admin
    .from("payments")
    .select("*")
    .eq("id", payment_id)
    .eq("user_id", user.id)
    .single();
  const payment = rawPayment as Payment | null;

  if (paymentError || !payment) {
    return NextResponse.json(errorResponse("결제 내역을 찾을 수 없습니다."), { status: 404 });
  }

  if (payment.status !== "confirmed") {
    return NextResponse.json(
      errorResponse("확인된 결제만 환불 요청할 수 있습니다."),
      { status: 400 }
    );
  }

  // 2. 기존 환불 내역 확인 (중복 방지)
  const { data: existingRefunds } = await admin
    .from("refunds")
    .select("amount, status")
    .eq("payment_id", payment_id)
    .neq("status", "rejected");

  const refundedTotal = ((existingRefunds ?? []) as { amount: number }[]).reduce(
    (sum, r) => sum + r.amount,
    0
  );
  const refundableAmount = payment.amount - refundedTotal;

  if (refundableAmount <= 0) {
    return NextResponse.json(
      errorResponse("이미 전액 환불 처리된 결제입니다."),
      { status: 400 }
    );
  }

  const refundAmount = requestedAmount
    ? Math.min(requestedAmount, refundableAmount)
    : refundableAmount;

  // 3. 환불 기한 확인
  const paidAt = payment.paid_at ? new Date(payment.paid_at) : new Date(payment.created_at);
  const elapsed = Date.now() - paidAt.getTime();
  const withinWindow = elapsed <= REFUND_WINDOW_MS;

  // 분석 상태 확인 (분석 완료 전이면 자동 승인)
  const { data: analysis } = await admin
    .from("analyses")
    .select("id")
    .eq("user_id", user.id)
    .gte("created_at", payment.created_at)
    .limit(1);

  const hasAnalysis = ((analysis ?? []) as unknown[]).length > 0;

  // 4. 환불 레코드 생성
  let refundStatus: string;
  let rejectReason: string | null = null;

  if (!hasAnalysis || withinWindow) {
    refundStatus = "approved";
  } else {
    refundStatus = "rejected";
    rejectReason = "분석 완료 후 24시간이 경과하여 환불이 불가합니다. 고객센터로 문의해주세요.";
  }

  const { data: refund, error: refundError } = await admin
    .from("refunds")
    .insert({
      payment_id,
      user_id: user.id,
      amount: refundAmount,
      reason,
      status: refundStatus,
      reject_reason: rejectReason,
    })
    .select()
    .single();

  if (refundError || !refund) {
    return NextResponse.json(errorResponse("환불 요청 처리 실패"), { status: 500 });
  }

  const refundId = (refund as { id: string }).id;

  // 5. 자동 승인인 경우: Toss 환불 + 크레딧 차감 + 결제 상태 업데이트
  if (refundStatus === "approved") {
    const tossSecretKey = process.env.TOSS_SECRET_KEY;

    if (tossSecretKey && payment.payment_key) {
      try {
        const tossRes = await fetch(
          `https://api.tosspayments.com/v1/payments/${payment.payment_key}/cancel`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${Buffer.from(tossSecretKey + ":").toString("base64")}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              cancelReason: reason,
              cancelAmount: refundAmount,
            }),
          }
        );

        if (!tossRes.ok) {
          await admin
            .from("refunds")
            .update({ status: "pending" })
            .eq("id", refundId);

          return NextResponse.json(
            successResponse({
              refund_id: refundId,
              status: "pending",
              message: "결제사 환불 처리 중입니다. 잠시 후 확인해주세요.",
            })
          );
        }
      } catch {
        await admin
          .from("refunds")
          .update({ status: "pending" })
          .eq("id", refundId);
      }
    }

    // 환불 완료 처리
    await admin
      .from("refunds")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", refundId);

    // 크레딧 차감
    const { data: credits } = await admin
      .from("user_credits")
      .select("balance")
      .eq("user_id", user.id)
      .single();

    const currentBalance = (credits as { balance: number } | null)?.balance ?? 0;
    const newBalance = Math.max(0, currentBalance - payment.credits_granted);

    await admin
      .from("user_credits")
      .upsert({
        user_id: user.id,
        balance: newBalance,
        updated_at: new Date().toISOString(),
      });

    await admin.from("credit_transactions").insert({
      user_id: user.id,
      amount: -payment.credits_granted,
      balance_after: newBalance,
      reason: `환불: ${reason}`,
      reference_id: refundId,
    });

    // 결제 상태 업데이트
    const newPaymentStatus =
      refundAmount >= payment.amount ? "refunded" : "partial_refunded";
    await admin
      .from("payments")
      .update({ status: newPaymentStatus, updated_at: new Date().toISOString() })
      .eq("id", payment_id);

    return NextResponse.json(
      successResponse({
        refund_id: refundId,
        status: "completed",
        amount: refundAmount,
        message: "환불이 완료되었습니다.",
      })
    );
  }

  // 거부된 경우
  return NextResponse.json(
    successResponse({
      refund_id: refundId,
      status: refundStatus,
      reject_reason: rejectReason,
    }),
    { status: refundStatus === "rejected" ? 200 : 201 }
  );
}

// GET /api/v1/refund — 내 환불 내역 조회
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
  const { data: refunds, error } = await admin
    .from("refunds")
    .select("*, payments(product_name, amount)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(errorResponse(error.message), { status: 500 });
  }

  return NextResponse.json(successResponse(refunds ?? []));
}
