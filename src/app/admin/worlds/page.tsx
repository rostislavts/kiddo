import Link from "next/link";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { worlds, tracks } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { PageTitle, Badge } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { WorldForm } from "@/components/admin-forms";
import { bg } from "@/i18n/bg";
export default async function Worlds() {
  await requireAdmin();
  const all = await db().select().from(worlds).orderBy(asc(worlds.sortOrder));
  const allTracks = await db().select().from(tracks);
  return (
    <>
      <PageTitle title={bg.admin.worlds} />
      <section className="content-card">
        {all.map((w) => (
          <div className="admin-world-row" key={w.id}>
            <div>
              <h3>
                {w.sortOrder + 1}. {w.title}
              </h3>
              <p>
                {w.slug} · {bg.common.free}
              </p>
            </div>
            <div className="inline-actions">
              <Badge className={w.published ? "badge-green" : "badge-neutral"}>
                {w.published ? bg.admin.published : bg.admin.draft}
              </Badge>
              <Button asChild size="small" variant="secondary">
                <Link href={`/admin/worlds/${w.id}`}>{bg.common.edit}</Link>
              </Button>
            </div>
          </div>
        ))}
      </section>
      <details className="content-card">
        <summary>{bg.admin.newWorld}</summary>
        <div className="section-gap">
          <WorldForm worlds={all} tracks={allTracks} />
        </div>
      </details>
    </>
  );
}
