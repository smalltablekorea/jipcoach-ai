import { NextRequest, NextResponse } from "next/server";
import { createApiRouteClient } from "@/lib/supabase/server";
import { successResponse, errorResponse } from "@/types/api";
import { maskPII, maskName } from "@/lib/utils/masking";
import type { UploadedEstimate } from "@/types/database";

const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// POST /api/v1/estimates — 견적서 파일 업로드
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

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const projectName = formData.get("project_name") as string | null;
  const areaPyeong = formData.get("area_pyeong") as string | null;

  if (!file) {
    return NextResponse.json(errorResponse("파일이 필요합니다."), { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(errorResponse("지원하지 않는 파일 형식입니다. (PDF, JPG, PNG, WebP, HEIC)"), { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(errorResponse("파일 크기가 50MB를 초과합니다."), { status: 413 });
  }

  const fileType = file.type === "application/pdf" ? "pdf" : "image";
  const storagePath = `${user.id}/${Date.now()}_${file.name}`;

  // Supabase Storage에 업로드
  const { error: uploadError } = await supabase.storage
    .from("estimate-files")
    .upload(storagePath, file, { contentType: file.type });

  if (uploadError) {
    return NextResponse.json(errorResponse(`파일 업로드 실패: ${uploadError.message}`), { status: 500 });
  }

  // DB에 레코드 생성
  const { data: rawData, error } = await supabase
    .from("uploaded_estimates")
    .insert({
      user_id: user.id,
      file_name: file.name,
      file_type: fileType,
      file_size: file.size,
      storage_path: storagePath,
      project_name: projectName || null,
      area_pyeong: areaPyeong ? parseFloat(areaPyeong) : null,
    })
    .select()
    .single();
  const data = rawData as unknown as UploadedEstimate | null;

  if (error || !data) {
    return NextResponse.json(errorResponse(error?.message ?? "저장 실패"), { status: 500 });
  }

  return NextResponse.json(
    successResponse({
      estimate_id: data.id,
      file_name: data.file_name,
      status: data.status,
    }),
    { status: 201 }
  );
}

// GET /api/v1/estimates — 견적서 목록 조회
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
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)), 100);
  const offset = (page - 1) * limit;

  const { data: rawData, error, count } = await supabase
    .from("uploaded_estimates")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  const data = (rawData ?? []) as unknown as UploadedEstimate[];

  if (error) {
    return NextResponse.json(errorResponse(error.message), { status: 500 });
  }

  // 개인정보 마스킹 적용
  const maskedData = data.map((item) => ({
    ...item,
    designer_name: item.designer_name ? maskName(item.designer_name) : null,
    extracted_text: item.extracted_text ? maskPII(item.extracted_text) : null,
  }));

  return NextResponse.json(
    successResponse({
      items: maskedData,
      pagination: {
        page,
        limit,
        total: count ?? 0,
        total_pages: Math.ceil((count ?? 0) / limit),
      },
    })
  );
}
