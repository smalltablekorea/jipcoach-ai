import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// OAuth 콜백 처리 (카카오/구글 등)
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  const next = searchParams.get("next") ?? "/";

  // OAuth 에러 처리 (카카오 로그인 실패 등)
  if (error) {
    console.error(`[OAuth Error] ${error}: ${errorDescription}`);

    // 에러 로그 저장 (fire-and-forget)
    logOAuthError(error, errorDescription, request.headers.get("user-agent"));

    // 이메일 로그인 대체 경로로 리다이렉트
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("oauth_error", error);
    loginUrl.searchParams.set(
      "message",
      "카카오 로그인에 실패했습니다. 이메일로 로그인해주세요."
    );
    return NextResponse.redirect(loginUrl);
  }

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=no_code", origin));
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  try {
    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error(`[OAuth Exchange Error] ${exchangeError.message}`);
      logOAuthError(
        "exchange_failed",
        exchangeError.message,
        request.headers.get("user-agent")
      );

      const loginUrl = new URL("/login", origin);
      loginUrl.searchParams.set("oauth_error", "exchange_failed");
      loginUrl.searchParams.set(
        "message",
        "카카오 로그인 처리 중 오류가 발생했습니다. 이메일로 로그인해주세요."
      );
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.redirect(new URL(next, origin));
  } catch (err) {
    console.error("[OAuth Callback Unexpected Error]", err);
    logOAuthError(
      "unexpected",
      err instanceof Error ? err.message : "unknown",
      request.headers.get("user-agent")
    );

    return NextResponse.redirect(
      new URL("/login?oauth_error=unexpected&message=로그인 중 오류가 발생했습니다.", origin)
    );
  }
}

// OAuth 에러를 DB에 기록 (비동기, 실패해도 무시)
async function logOAuthError(
  errorType: string,
  description: string | null,
  userAgent: string | null
) {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    await admin.from("oauth_error_logs").insert({
      error_type: errorType,
      description: description ?? "",
      user_agent: userAgent ?? "",
    });
  } catch {
    // 로깅 실패는 무시
  }
}
