import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { Robot } from "@/components/illustration";
import { bg } from "@/i18n/bg";
export const metadata = { title: bg.nav.login };
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; school?: string }>;
}) {
  const { error, school } = await searchParams;
  return (
    <>
      <section className="auth-card">
        <div className="auth-art">
          <Robot />
        </div>
        <h1>{school ? "Вход за училище" : bg.auth.loginTitle}</h1>
        <p className="muted">
          {school === "1"
            ? "Влез със служебния имейл, за който е предоставен достъп."
            : bg.auth.loginSubtitle}
        </p>
        {error && (
          <p className="form-error" style={{ marginBottom: 20 }}>
            {bg.auth.confirmationError}
          </p>
        )}
        <AuthForm mode="login" school={school === "1"} />
        <p className="auth-bottom">
          {bg.auth.noAccount}{" "}
          <Link href={school ? "/signup?school=1" : "/signup"}>{bg.nav.start}</Link>
        </p>
      </section>
      {school !== "1" && <p className="auth-note">{bg.auth.childNote}</p>}
    </>
  );
}
