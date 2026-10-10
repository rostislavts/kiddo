import { AuthForm } from "@/components/auth-form";
import { MarketingHeader } from "@/components/marketing-shell";
import { bg } from "@/i18n/bg";
export default function Reset() {
  return (
    <>
      <MarketingHeader />
      <main id="main" className="auth-page">
        <section className="auth-card">
          <h1>{bg.auth.resetTitle}</h1>
          <AuthForm mode="reset" />
        </section>
      </main>
    </>
  );
}
