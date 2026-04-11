import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

export async function GET() {
  const start = Date.now();
  const checks: Record<string, boolean> = {
    supabase: false,
    storage: false,
    anthropic: false,
  };

  // 1. Supabase DB 연결 확인
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("market_reference_data")
      .select("id")
      .limit(1);
    checks.supabase = !error;
  } catch {
    checks.supabase = false;
  }

  // 2. Supabase Storage 확인
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.storage.from("estimate-files").list("", {
      limit: 1,
    });
    checks.storage = !error;
  } catch {
    checks.storage = false;
  }

  // 3. Anthropic API 키 유효성 확인 (경량 호출)
  try {
    if (process.env.ANTHROPIC_API_KEY) {
      const client = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
      const res = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1,
        messages: [{ role: "user", content: "ping" }],
      });
      checks.anthropic = !!res.id;
    }
  } catch {
    checks.anthropic = false;
  }

  const allOk = Object.values(checks).every(Boolean);
  const durationMs = Date.now() - start;

  return NextResponse.json(
    {
      status: allOk ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      duration_ms: durationMs,
      services: {
        db: checks.supabase,
        storage: checks.storage,
        ai: checks.anthropic,
      },
    },
    { status: allOk ? 200 : 503 }
  );
}
