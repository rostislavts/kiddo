import { AuthForm } from "@/components/auth-form";
import { bg } from "@/i18n/bg";
export default function Forgot() {
  return (
    <section className="auth-card">
      <h1>{bg.auth.forgotTitle}</h1>
      <p className="muted">{bg.auth.forgotDescription}</p>
      <AuthForm mode="forgot" />
    </section>
  );
}
