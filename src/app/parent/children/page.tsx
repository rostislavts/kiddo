import { eq } from "drizzle-orm";
import { db } from "@/db";
import { children } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { PageTitle } from "@/components/ui/primitives";
import { ChildForm, DeleteChild } from "@/components/child-forms";
import { bg } from "@/i18n/bg";
export default async function ChildrenPage() {
  const user = await requireUser();
  const profiles = await db().select().from(children).where(eq(children.parentId, user.id));
  return (
    <>
      <PageTitle title={bg.nav.children} description={bg.children.nicknameHelp} />
      <div className="two-columns">
        <section className="content-card">
          <h2>{bg.children.new}</h2>
          <ChildForm needsConsent={!user.consentAt} />
        </section>
        {profiles.map((child) => (
          <section className="content-card" key={child.id}>
            <h2>{child.nickname}</h2>
            <ChildForm child={child} />
            <DeleteChild child={child} />
          </section>
        ))}
      </div>
    </>
  );
}
