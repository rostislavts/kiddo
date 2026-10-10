import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/auth/supabase";
import { appUrl } from "@/lib/config";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next =
    url.searchParams.get("next") === "/auth/reset-password"
      ? "/auth/reset-password"
      : url.searchParams.get("next") === "/school"
        ? "/school"
        : "/select-child";
  if (code) {
    const client = await supabaseServer();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, appUrl()));
  }
  return NextResponse.redirect(new URL("/login?error=confirmation", appUrl()));
}
