/**
 * 분석 결과에서 업체 고유명과 구체적 단가를 마스킹
 * - 업체명 → "A업체", "B업체" 등으로 치환
 * - 업체별 고유 단가 → 구간 범위로 변환
 */

// 텍스트에서 업체명 패턴을 찾아 익명화
const COMPANY_SUFFIXES = [
  "인테리어",
  "디자인",
  "건설",
  "건축",
  "시공",
  "데코",
  "홈",
  "리빙",
  "공간",
  "스튜디오",
];

// 텍스트 내 업체명을 A업체, B업체로 치환
export function maskCompanyNames(text: string): string {
  if (!text) return text;

  let result = text;
  const found: string[] = [];

  // "OO인테리어", "OO디자인" 등의 패턴 검출
  for (const suffix of COMPANY_SUFFIXES) {
    const regex = new RegExp(`[가-힣A-Za-z]{2,10}${suffix}`, "g");
    const matches = result.match(regex) || [];
    for (const match of matches) {
      if (!found.includes(match)) {
        found.push(match);
      }
    }
  }

  // 발견된 업체명을 알파벳 순서로 치환
  found.forEach((name, idx) => {
    const label = String.fromCharCode(65 + (idx % 26)) + "업체";
    result = result.replaceAll(name, label);
  });

  return result;
}

// 구체적 단가를 구간 범위로 변환: 423,000 → "40만~45만원"
export function maskUnitPrice(price: number): string {
  if (price <= 0) return "미제공";
  const man = price / 10000;
  // 5만원 단위 구간으로 반올림
  const low = Math.floor(man / 5) * 5;
  const high = low + 5;
  if (low < 10) {
    return `${low}만~${high}만원`;
  }
  return `${low}만~${high}만원`;
}

// 분석 결과 텍스트 필드 전체에 업체명 마스킹 적용
export function maskAnalysisTexts<T extends Record<string, unknown>>(
  analysis: T,
  textFields: string[]
): T {
  const result = { ...analysis };
  for (const field of textFields) {
    if (typeof result[field] === "string") {
      (result as Record<string, unknown>)[field] = maskCompanyNames(
        result[field] as string
      );
    }
  }
  return result;
}
