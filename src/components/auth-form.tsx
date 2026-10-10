"use client";
import Link from "next/link";
import { useActionState } from "react";
import { ArrowRight } from "lucide-react";
import {
  authenticate,
  requestPasswordReset,
  updatePassword,
  type AuthState,
} from "@/app/auth/actions";
import { Button } from "./ui/button";
import { bg } from "@/i18n/bg";
export function AuthForm({
  mode,
  school = false,
}: {
  mode: "login" | "signup" | "forgot" | "reset";
  school?: boolean;
}) {
  const action =
    mode === "forgot"
      ? requestPasswordReset
      : mode === "reset"
        ? updatePassword
        : authenticate.bind(null, mode);
  const [state, formAction, pending] = useActionState<AuthState, FormData>(action, {});
  return (
    <form action={formAction} className="form-stack">
      {school && <input type="hidden" name="school_account" value="true" />}
      {mode !== "reset" && (
        <label className="field">
          {bg.auth.email}
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            placeholder={school ? "teacher@school.bg" : "parent@example.com"}
          />
        </label>
      )}
      {mode !== "forgot" && (
        <label className="field">
          {bg.auth.password}
          <input
            name="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
            minLength={8}
            maxLength={128}
            placeholder={bg.auth.passwordHint}
          />
        </label>
      )}
      {mode === "signup" && (
        <>
          <label className="checkbox-field">
            <input name="consent" type="checkbox" required />
            <span>
              {school
                ? "Създавам служебен акаунт за училище и приемам условията за използване."
                : bg.auth.consent}
            </span>
          </label>
          <div className="inline-actions tiny-copy">
            <Link className="text-link" href="/terms">
              {bg.nav.terms}
            </Link>
            <Link className="text-link" href="/privacy">
              {bg.nav.privacy}
            </Link>
          </div>
        </>
      )}
      {state.error && (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="form-success" role="status">
          {state.success}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending
          ? bg.common.loading
          : mode === "login"
            ? bg.auth.login
            : mode === "signup"
              ? bg.auth.signup
              : mode === "forgot"
                ? bg.auth.sendReset
                : bg.auth.reset}
        <ArrowRight size={17} />
      </Button>
      {mode === "login" && (
        <Link className="text-link tiny-copy" href="/forgot-password">
          {bg.auth.forgot}
        </Link>
      )}
      {mode === "reset" && state.success && (
        <Link className="text-link" href="/select-child">
          {bg.common.continue}
        </Link>
      )}
    </form>
  );
}
