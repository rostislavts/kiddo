import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { Robot } from "@/components/illustration";
import { bg } from "@/i18n/bg";
export const metadata = { title: bg.auth.signupTitle };
export default async function Signup({
  searchParams,
}: {
  searchParams: Promise<{ school?: string }>;
}) {
  const school = (await searchParams).school === "1";
  return (
    <>
      <section className="auth-card">
        <div className="auth-art">
          <Robot />
        </div>
        <h1>{school ? "Регистрация за училище" : bg.auth.signupTitle}</h1>
        <p className="muted">
          {school
            ? "Използвай служебния имейл, за който е предоставен достъп."
            : bg.auth.signupSubtitle}
        </p>
        <AuthForm mode="signup" school={school} />
        <p className="auth-bottom">
          {bg.auth.hasAccount}{" "}
          <Link href={school ? "/login?school=1" : "/login"}>{bg.nav.login}</Link>
        </p>
      </section>
      {!school && <p className="auth-note">{bg.auth.childNote}</p>}
    </>
  );
}
