import { eq } from "drizzle-orm";
import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/db";
import { children } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { MarketingHeader } from "@/components/marketing-shell";
import { PageTitle } from "@/components/ui/primitives";
import { ChildForm, SelectChild } from "@/components/child-forms";
import { Button } from "@/components/ui/button";
import { bg, avatars, type AvatarKey } from "@/i18n/bg";
export const dynamic = "force-dynamic";
export default async function SelectPage() {
  const user = await requireUser();
  const profiles = await db().select().from(children).where(eq(children.parentId, user.id));
  return (
    <>
      <MarketingHeader />
      <main id="main" className="container profile-selection">
        <PageTitle title={bg.children.title} description={bg.children.description} />
        {profiles.length ? (
          <>
            <div className="profile-grid">
              {profiles.map((child) => (
                <article className="profile-card" key={child.id}>
                  <div className="large-avatar">
                    {avatars[child.avatar as AvatarKey] || avatars.robot}
                  </div>
                  <h3>{child.nickname}</h3>
                  <SelectChild id={child.id} />
                </article>
              ))}
            </div>
            <div className="result-actions">
              <Button asChild variant="secondary">
                <Link href="/parent/children">
                  <Plus size={17} />
                  {bg.children.add}
                </Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href="/parent">{bg.nav.parent}</Link>
              </Button>
            </div>
          </>
        ) : (
          <section className="content-card" style={{ maxWidth: 490, margin: "auto" }}>
            <h2>{bg.children.new}</h2>
            <ChildForm needsConsent={!user.consentAt} />
          </section>
        )}
      </main>
    </>
  );
}
