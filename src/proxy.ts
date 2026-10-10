import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    return response;
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookieOptions: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(values, headers) {
          values.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
        },
      },
    },
  );
  await supabase.auth.getClaims();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = {
  matcher: [
    // Public pages also render session-aware navigation and need refreshed cookies.
    "/",
    "/how-it-works",
    "/curriculum",
    "/pricing",
    "/faq",
    "/privacy",
    "/terms",
    "/setup",
    "/forgot-password",
    "/app/:path*",
    "/parent/:path*",
    "/admin/:path*",
    "/school/:path*",
    "/api/schools/:path*",
    "/api/lab/:path*",
    "/api/account/:path*",
    "/api/learning/:path*",
    "/api/billing/:path*",
    "/api/admin/:path*",
    "/api/events/:path*",
    "/auth/:path*",
    "/login",
    "/signup",
    "/select-child",
  ],
};
