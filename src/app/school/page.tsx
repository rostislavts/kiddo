import Link from "next/link";
import { db } from "@/db";
import { getUser } from "@/lib/auth/session";
import { schoolList } from "@/lib/schools/view";
import { AppShell } from "@/components/app-shell";
import { PageTitle } from "@/components/ui/primitives";
import { MarketingHeader } from "@/components/marketing-shell";
export const dynamic = "force-dynamic";
export default async function SchoolHome() {
  const user = await getUser();
  if (!user)
    return (
      <>
        <MarketingHeader />
        <main id="main" className="container profile-selection">
          <PageTitle
            title="Училищен панел"
            description="Влез със служебния имейл, за който училищният отговорник е предоставил достъп."
          />
          <div className="inline-actions">
            <Link className="button button-primary" href="/login?school=1">
              Вход за училище
            </Link>
            <Link className="text-link" href="/signup?school=1">
              Регистрация на служител
            </Link>
            <Link className="text-link" href="/parent/school">
              Родител с училищна покана
            </Link>
          </div>
        </main>
      </>
    );
  const schools = await schoolList(db(), user.id);
  return (
    <AppShell mode="school" admin={user.role === "admin"}>
      <PageTitle
        title="Моите училища"
        description="Достъпът е предоставен за твоя потвърден служебен имейл."
      />
      {!schools.length && (
        <p className="notice">
          Все още нямаш назначена училищна роля. Свържи се с училищния отговорник и му дай имейла на
          този акаунт.
        </p>
      )}
      <div className="lab-grid">
        {schools.map((s) => (
          <Link key={s.id} href={`/school/${s.id}`} className="content-card lab-link">
            <h2>{s.name}</h2>Отвори →
          </Link>
        ))}
      </div>
      <p>
        <Link href="/parent/school">Активиране на ученически код от родител →</Link>
      </p>
    </AppShell>
  );
}
