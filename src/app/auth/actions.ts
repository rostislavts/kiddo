"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/auth/supabase";
import { appUrl, isConfigured } from "@/lib/config";
import { rateLimit } from "@/lib/security";

export type AuthState = { error?: string; success?: string };
const credentials = z.object({
  email: z
    .email()
    .max(254)
    .transform((email) => email.toLowerCase()),
  password: z.string().min(8).max(128),
});
export async function authenticate(
  mode: "login" | "signup",
  _state: AuthState,
  form: FormData,
): Promise<AuthState> {
  if (!isConfigured()) return { error: "Първо попълни настройките в .env. Виж /setup." };
  const parsed = credentials.safeParse({
    email: form.get("email"),
    password: form.get("password"),
  });
  if (!parsed.success) return { error: "Въведи валиден имейл и парола с поне 8 символа." };
  if (mode === "signup" && form.get("consent") !== "on")
    return { error: "Потвърди типа на акаунта и приемането на условията." };
  const school = form.get("school_account") === "true";
  try {
    await rateLimit(parsed.data.email, "auth", 10, 900);
    const supabase = await supabaseServer();
    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        ...parsed.data,
        options: {
          emailRedirectTo: `${appUrl()}/auth/callback${school ? "?next=/school" : ""}`,
          data: { parent_consent: !school, account_kind: school ? "school" : "parent" },
        },
      });
      if (error)
        return {
          error:
            "Не успяхме да създадем акаунта. Опитай отново или влез, ако вече имаш регистрация.",
        };
      if (!data.session)
        return {
          success: "Провери имейла си за връзка за потвърждение. След това влез в акаунта.",
        };
    } else {
      const { error } = await supabase.auth.signInWithPassword(parsed.data);
      if (error)
        return { error: "Имейлът или паролата са невалидни, или имейлът още не е потвърден." };
    }
  } catch {
    return { error: "Временно не можем да те впишем. Изчакай малко и опитай отново." };
  }
  redirect(school ? "/school" : "/select-child");
}
export async function signOut() {
  if (isConfigured()) {
    const supabase = await supabaseServer();
    await supabase.auth.signOut();
  }
  (await cookies()).delete("academy-child");
  redirect("/");
}
export async function requestPasswordReset(_state: AuthState, form: FormData): Promise<AuthState> {
  if (!isConfigured()) return { error: "Приложението още не е настроено." };
  const email = z.email().safeParse(form.get("email"));
  if (!email.success) return { error: "Въведи валиден имейл." };
  try {
    await rateLimit(email.data.toLowerCase(), "password_reset", 3, 900);
    const supabase = await supabaseServer();
    await supabase.auth.resetPasswordForEmail(email.data, {
      redirectTo: `${appUrl()}/auth/callback?next=/auth/reset-password`,
    });
  } catch {
    /* Do not reveal whether an address exists. */
  }
  return { success: "Ако има акаунт с този имейл, ще получиш връзка за нова парола." };
}
export async function updatePassword(_state: AuthState, form: FormData): Promise<AuthState> {
  const password = z.string().min(8).max(128).safeParse(form.get("password"));
  if (!password.success) return { error: "Паролата трябва да е поне 8 символа." };
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "Връзката е изтекла. Поискай нова." };
  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error) return { error: "Не успяхме да сменим паролата. Поискай нова връзка." };
  return { success: "Паролата е сменена. Можеш да продължиш към профилите." };
}
