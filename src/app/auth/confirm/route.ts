import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/auth/supabase";
import { appUrl } from "@/lib/config";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const hash = params.get("token_hash");
  const type = params.get("type");
  if (hash && (type === "email" || type === "recovery")) {
    const client = await supabaseServer();
    const { data, error } = await client.auth.verifyOtp({ token_hash: hash, type });
    if (!error)
      return NextResponse.redirect(
        new URL(
          type === "recovery"
            ? "/auth/reset-password"
            : data.user?.user_metadata.account_kind === "school"
              ? "/school"
              : "/select-child",
          appUrl(),
        ),
      );
  }
  return NextResponse.redirect(new URL("/login?error=confirmation", appUrl()));
}
