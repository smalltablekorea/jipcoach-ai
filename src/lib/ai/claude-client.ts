import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function getClaudeClient(): Anthropic {
  if (!client) {
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    });
  }
  return client;
}

export async function analyzeEstimateText(
  estimateText: string,
  marketDataContext: string
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const claude = getClaudeClient();

  const response = await claude.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `## 견적서 원문\n\n${estimateText}\n\n## 시장 참조 데이터\n\n${marketDataContext}`,
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  return {
    content: textBlock?.text ?? "",
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

const SYSTEM_PROMPT = `당신은 한국 인테리어 견적서 분석 전문가 AI입니다.
사용자가 제공한 견적서 텍스트와 시장 참조 데이터를 기반으로 견적서를 분석해주세요.

반드시 아래 JSON 형식으로만 응답하세요. JSON 외의 텍스트는 포함하지 마세요.

{
  "score": <0-100 정수, 전체 적정성 점수>,
  "grade": "<A+, A, B+, B, C+, C, D 중 하나>",
  "summary_text": "<전체 견적서에 대한 2-3문장 총평>",
  "savings_min": <예상 절감 최소액 (원)>,
  "savings_max": <예상 절감 최대액 (원)>,
  "financial_summary": {
    "construction_amount": <공사금액 (원)>,
    "profit_overhead": <이윤+공과잡비 (원)>,
    "billing_amount": <총 청구금액 (원)>
  },
  "positive_points": [
    { "title": "<잘 된 점 요약>", "description": "<상세 설명>" }
  ],
  "processes": [
    {
      "process_category": "<공정명>",
      "emoji_icon": "<이모지>",
      "amount": <해당 공정 금액 (원)>,
      "status_badge": "<적정|주의|높음>",
      "deviation_percent": <시장 평균 대비 % 차이>,
      "market_avg_amount": <시장 평균 금액 (원)>
    }
  ],
  "attention_items": [
    {
      "severity": "<높음|주의>",
      "title": "<주의항목 제목>",
      "description": "<상세 설명>",
      "savings_min": <절감 가능 최소액 (원)>,
      "savings_max": <절감 가능 최대액 (원)>,
      "related_process": "<관련 공정명 또는 null>"
    }
  ],
  "negotiation_tips": ["<협상 팁 1>", "<협상 팁 2>"],
  "missing_items": ["<누락 항목 1>", "<누락 항목 2>"],
  "contractor_questions": ["<업체에 확인할 질문 1>", "<질문 2>"]
}

분석 기준:
- 각 공정의 금액을 시장 참조 데이터와 비교하여 적정/주의/높음 판정
- 시장 평균 대비 ±5% 이내: "적정", 5~12%: "주의", 12% 초과: "높음"
- score는 적정 비율이 높을수록 높은 점수
- 일반적으로 누락되기 쉬운 항목 (커튼/블라인드, 가전, 가구, 엘리베이터 비용, 민원처리, 행위허가 등) 체크
- 이윤율과 공과잡비 비율이 업계 평균(이윤 10-15%, 공과잡비 3-5%) 대비 적정한지 평가
- 구체적인 절감 금액을 원 단위로 제시`;
