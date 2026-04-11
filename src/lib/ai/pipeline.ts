import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@supabase/supabase-js";
import { analyzeEstimateText } from "./claude-client";
import { parseAnalysisResponse } from "./parser";
import type { UploadedEstimate, Analysis, MarketReferenceData } from "@/types/database";

export async function runAnalysisPipeline(estimateId: string, userId: string) {
  const supabase = createAdminClient();
  const startTime = Date.now();

  try {
    // 1. 상태 업데이트: 분석중
    await supabase
      .from("uploaded_estimates")
      .update({ status: "분석중" as const })
      .eq("id", estimateId);

    // 2. 견적서 데이터 가져오기
    const { data: rawEstimate, error: estError } = await supabase
      .from("uploaded_estimates")
      .select("*")
      .eq("id", estimateId)
      .single();
    const estimate = rawEstimate as unknown as UploadedEstimate | null;

    if (estError || !estimate) {
      throw new Error("견적서를 찾을 수 없습니다.");
    }

    if (!estimate.extracted_text) {
      throw new Error("추출된 텍스트가 없습니다. 먼저 텍스트를 추출해주세요.");
    }

    // 3. 시장 참조 데이터 가져오기
    const areaPyeong = estimate.area_pyeong ?? 30;
    const { data: rawMarketData } = await supabase
      .from("market_reference_data")
      .select("*")
      .lte("area_range_min", areaPyeong)
      .gte("area_range_max", areaPyeong);
    const marketData = (rawMarketData ?? []) as unknown as MarketReferenceData[];

    const marketContext = marketData.length
      ? marketData
          .map(
            (m) =>
              `${m.process_category}: 평균 ${m.avg_price.toLocaleString()}원 (${m.min_price.toLocaleString()}~${m.max_price.toLocaleString()}원) [${m.price_type === "per_pyeong" ? "평당" : "총액"}]`
          )
          .join("\n")
      : "시장 참조 데이터 없음 - 일반적인 서울 기준 시장 가격으로 평가해주세요.";

    // 4. Claude API 호출
    const aiResponse = await analyzeEstimateText(
      estimate.extracted_text,
      marketContext
    );

    // 5. 응답 파싱 (실패 시 parse_failed 상태로 전환)
    let result;
    try {
      result = parseAnalysisResponse(aiResponse.content);
    } catch (parseError) {
      // 파싱 실패: parse_failed 상태로 기록
      await supabase
        .from("uploaded_estimates")
        .update({
          status: "오류" as const,
          error_message: `파싱 실패: ${parseError instanceof Error ? parseError.message : "JSON 파싱 오류"}`,
        })
        .eq("id", estimateId);

      // 수동 분석 요청 자동 생성 (untyped client 사용)
      const rawAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
      );
      await rawAdmin.from("manual_review_requests").insert({
        estimate_id: estimateId,
        user_id: userId,
        reason: "parse_failed",
        status: "pending",
      });

      throw new Error("PARSE_FAILED");
    }
    const durationMs = Date.now() - startTime;

    // 6. 기존 분석 결과 삭제 (재분석 시)
    await supabase
      .from("analyses")
      .delete()
      .eq("estimate_id", estimateId);

    // 7. analyses 메인 테이블 저장
    const { data: rawAnalysis, error: analysisError } = await supabase
      .from("analyses")
      .insert({
        estimate_id: estimateId,
        user_id: userId,
        score: result.score,
        grade: result.grade,
        summary_text: result.summary_text,
        savings_min: result.savings_min,
        savings_max: result.savings_max,
        positive_points: result.positive_points,
        ai_model: "claude-sonnet-4-20250514",
        ai_tokens_used: aiResponse.inputTokens + aiResponse.outputTokens,
        analysis_duration_ms: durationMs,
      })
      .select()
      .single();
    const analysis = rawAnalysis as unknown as Analysis | null;

    if (analysisError || !analysis) {
      throw new Error(`분석 결과 저장 실패: ${analysisError?.message}`);
    }

    const analysisId = analysis.id;

    // 8. 하위 테이블들 병렬 저장
    const insertPromises = [];

    // 공정별 분석
    if (result.processes.length > 0) {
      insertPromises.push(
        supabase.from("process_analyses").insert(
          result.processes.map((p, i) => ({
            analysis_id: analysisId,
            process_category: p.process_category,
            emoji_icon: p.emoji_icon,
            amount: p.amount,
            market_avg_amount: p.market_avg_amount,
            deviation_percent: p.deviation_percent,
            status_badge: p.status_badge,
            sort_order: i,
          }))
        )
      );
    }

    // 주의항목
    if (result.attention_items.length > 0) {
      insertPromises.push(
        supabase.from("attention_items").insert(
          result.attention_items.map((a, i) => ({
            analysis_id: analysisId,
            severity: a.severity,
            title: a.title,
            description: a.description,
            savings_min: a.savings_min,
            savings_max: a.savings_max,
            related_process: a.related_process,
            sort_order: i,
          }))
        )
      );
    }

    // 협상 팁
    if (result.negotiation_tips.length > 0) {
      insertPromises.push(
        supabase.from("negotiation_tips").insert(
          result.negotiation_tips.map((tip, i) => ({
            analysis_id: analysisId,
            tip_text: tip,
            sort_order: i,
          }))
        )
      );
    }

    // 누락 항목
    if (result.missing_items.length > 0) {
      insertPromises.push(
        supabase.from("missing_items").insert(
          result.missing_items.map((item, i) => ({
            analysis_id: analysisId,
            item_text: item,
            sort_order: i,
          }))
        )
      );
    }

    // 업체 질문
    if (result.contractor_questions.length > 0) {
      insertPromises.push(
        supabase.from("contractor_questions").insert(
          result.contractor_questions.map((q, i) => ({
            analysis_id: analysisId,
            question_text: q,
            sort_order: i,
          }))
        )
      );
    }

    await Promise.all(insertPromises);

    // 9. 견적서 금액 정보 + 상태 업데이트
    await supabase
      .from("uploaded_estimates")
      .update({
        status: "분석완료" as const,
        construction_amount: result.financial_summary.construction_amount,
        profit_overhead: result.financial_summary.profit_overhead,
        billing_amount: result.financial_summary.billing_amount,
      })
      .eq("id", estimateId);

    return { analysisId, score: result.score, grade: result.grade };
  } catch (error) {
    // 오류 시 상태 업데이트
    await supabase
      .from("uploaded_estimates")
      .update({
        status: "오류" as const,
        error_message: error instanceof Error ? error.message : "알 수 없는 오류",
      })
      .eq("id", estimateId);

    throw error;
  }
}
