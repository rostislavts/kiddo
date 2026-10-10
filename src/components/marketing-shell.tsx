import Link from "next/link";
import { ArrowUpRight, LogOut } from "lucide-react";
import { Brand } from "./brand";
import { Button } from "./ui/button";
import { bg } from "@/i18n/bg";
import { getUser } from "@/lib/auth/session";
import { signOut } from "@/app/auth/actions";
export async function MarketingHeader() {
  const user = await getUser();
  return (
    <header
      className={`marketing-header container${user ? " marketing-header-authenticated" : ""}`}
    >
      <Brand />
      <nav aria-label={bg.nav.home} className="marketing-nav">
        <Link href="/how-it-works">{bg.nav.how}</Link>
        <Link href="/curriculum">{bg.nav.curriculum}</Link>
        <Link href="/pricing">{bg.nav.pricing}</Link>
      </nav>
      <div className="header-actions">
        {user ? (
          <>
            <Link href="/parent" className="login-link">
              {bg.nav.parent}
            </Link>
            <Button asChild size="small">
              <Link href="/select-child">{bg.nav.children}</Link>
            </Button>
            <form action={signOut}>
              <button
                type="submit"
                className="icon-button"
                aria-label={bg.nav.logout}
                title={bg.nav.logout}
              >
                <LogOut size={18} aria-hidden="true" />
              </button>
            </form>
          </>
        ) : (
          <>
            <Link href="/login" className="login-link">
              {bg.nav.login}
            </Link>
            <Button asChild size="small">
              <Link href="/signup">
                {bg.nav.start}
                <ArrowUpRight size={16} />
              </Link>
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
export function MarketingFooter() {
  return (
    <footer className="marketing-footer container">
      <div>
        <Brand small />
        <p>{bg.home.footer}</p>
      </div>
      <nav>
        <Link href="/faq">{bg.nav.faq}</Link>
        <Link href="/privacy">{bg.nav.privacy}</Link>
        <Link href="/terms">{bg.nav.terms}</Link>
        <Link href="/login">{bg.nav.parent}</Link>
        <Link href="/school">За училища</Link>
      </nav>
      <small>
        © {new Date().getFullYear()} {bg.brand}
      </small>
    </footer>
  );
}
