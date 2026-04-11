import type { FullAnalysisResult } from "@/types/analysis";

export function parseAnalysisResponse(raw: string): FullAnalysisResult {
  // Claude 응답에서 JSON 블록 추출
  let jsonStr = raw.trim();

  // ```json ... ``` 블록이 있으면 추출
  const jsonMatch = jsonStr.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }

  // { 로 시작하지 않으면 첫 번째 { 부터 마지막 } 까지 추출
  if (!jsonStr.startsWith("{")) {
    const start = jsonStr.indexOf("{");
    const end = jsonStr.lastIndexOf("}");
    if (start !== -1 && end !== -1) {
      jsonStr = jsonStr.slice(start, end + 1);
    }
  }

  const parsed = JSON.parse(jsonStr);

  // 필수 필드 검증
  if (typeof parsed.score !== "number" || !parsed.grade) {
    throw new Error("AI 응답에 필수 필드(score, grade)가 누락되었습니다.");
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(parsed.score))),
    grade: String(parsed.grade),
    summary_text: String(parsed.summary_text ?? ""),
    savings_min: Number(parsed.savings_min ?? 0),
    savings_max: Number(parsed.savings_max ?? 0),
    financial_summary: {
      construction_amount: Number(parsed.financial_summary?.construction_amount ?? 0),
      profit_overhead: Number(parsed.financial_summary?.profit_overhead ?? 0),
      billing_amount: Number(parsed.financial_summary?.billing_amount ?? 0),
    },
    positive_points: Array.isArray(parsed.positive_points)
      ? parsed.positive_points.map((p: { title?: string; description?: string }) => ({
          title: String(p.title ?? ""),
          description: String(p.description ?? ""),
        }))
      : [],
    processes: Array.isArray(parsed.processes)
      ? parsed.processes.map((p: Record<string, unknown>) => ({
          process_category: String(p.process_category ?? ""),
          emoji_icon: String(p.emoji_icon ?? ""),
          amount: Number(p.amount ?? 0),
          status_badge: validateBadge(String(p.status_badge ?? "적정")),
          deviation_percent: Number(p.deviation_percent ?? 0),
          market_avg_amount: Number(p.market_avg_amount ?? 0),
        }))
      : [],
    attention_items: Array.isArray(parsed.attention_items)
      ? parsed.attention_items.map((a: Record<string, unknown>) => ({
          severity: validateSeverity(String(a.severity ?? "주의")),
          title: String(a.title ?? ""),
          description: String(a.description ?? ""),
          savings_min: Number(a.savings_min ?? 0),
          savings_max: Number(a.savings_max ?? 0),
          related_process: a.related_process ? String(a.related_process) : null,
        }))
      : [],
    negotiation_tips: Array.isArray(parsed.negotiation_tips)
      ? parsed.negotiation_tips.map(String)
      : [],
    missing_items: Array.isArray(parsed.missing_items)
      ? parsed.missing_items.map(String)
      : [],
    contractor_questions: Array.isArray(parsed.contractor_questions)
      ? parsed.contractor_questions.map(String)
      : [],
  };
}

function validateBadge(value: string): "적정" | "주의" | "높음" {
  if (value === "적정" || value === "주의" || value === "높음") return value;
  return "적정";
}

function validateSeverity(value: string): "높음" | "주의" {
  if (value === "높음" || value === "주의") return value;
  return "주의";
}
