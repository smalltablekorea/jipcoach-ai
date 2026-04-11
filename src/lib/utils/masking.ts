/**
 * 개인정보 마스킹 유틸리티
 * 전화번호, 이메일, 상세주소를 마스킹하여 개인정보 보호
 */

// 전화번호 마스킹: 010-1234-5678 → 010-****-5678
export function maskPhone(phone: string): string {
  if (!phone) return phone;
  // 010-1234-5678 / 01012345678 / 010 1234 5678
  return phone.replace(
    /(\d{2,3})[-\s]?(\d{3,4})[-\s]?(\d{4})/g,
    "$1-****-$3"
  );
}

// 이메일 마스킹: smalltable@gmail.com → s***@gmail.com
export function maskEmail(email: string): string {
  if (!email) return email;
  return email.replace(
    /^(.)[^@]*(@.+)$/,
    (_, first, domain) => `${first}***${domain}`
  );
}

// 상세주소 마스킹: "서울 강남구 역삼동 123-4 101동 502호" → "서울 강남구 역삼동"
export function maskAddress(address: string): string {
  if (!address) return address;
  // 동/호수 제거
  const cleaned = address
    .replace(/\d+동\s*\d+호/g, "")
    .replace(/\d+-\d+/g, "")
    .replace(/\d+호/g, "")
    .replace(/\d+층/g, "")
    .trim();
  // 구/동 수준까지만 남기기
  const parts = cleaned.split(/\s+/);
  const cutIdx = parts.findIndex(
    (p) => p.endsWith("동") || p.endsWith("읍") || p.endsWith("면") || p.endsWith("리")
  );
  if (cutIdx >= 0) {
    return parts.slice(0, cutIdx + 1).join(" ");
  }
  // 구까지만
  const guIdx = parts.findIndex((p) => p.endsWith("구") || p.endsWith("군"));
  if (guIdx >= 0) {
    return parts.slice(0, guIdx + 1).join(" ");
  }
  return parts.slice(0, Math.min(3, parts.length)).join(" ");
}

// 이름 마스킹: 김철수 → 김*수 (2자: 김* / 3자이상: 김*수)
export function maskName(name: string): string {
  if (!name) return name;
  if (name.length <= 1) return name;
  if (name.length === 2) return name[0] + "*";
  return name[0] + "*".repeat(name.length - 2) + name[name.length - 1];
}

// 텍스트에서 전화번호/이메일 패턴을 일괄 마스킹
export function maskPII(text: string): string {
  if (!text) return text;
  let result = text;
  // 전화번호
  result = result.replace(
    /(\d{2,3})[-\s]?(\d{3,4})[-\s]?(\d{4})/g,
    "$1-****-$3"
  );
  // 이메일
  result = result.replace(
    /([a-zA-Z0-9._%+-])[a-zA-Z0-9._%+-]*@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
    "$1***@$2"
  );
  return result;
}
