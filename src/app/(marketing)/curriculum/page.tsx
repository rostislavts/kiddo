import Link from "next/link";
import { db } from "@/db";
import { catalog } from "@/lib/learning/service";
import { isConfigured } from "@/lib/config";
import { worldSeeds, lessonSeeds } from "@/content/seed/curriculum";
import { bg } from "@/i18n/bg";
import { WorldArt } from "@/components/illustration";
import { Badge } from "@/components/ui/primitives";
export const metadata = { title: bg.nav.curriculum };
export const dynamic = "force-dynamic";
export default async function Curriculum() {
  const data = isConfigured() ? await catalog(db()) : { worlds: worldSeeds, lessons: lessonSeeds };
  return (
    <section className="container section">
      <div className="center-heading">
        <p className="eyebrow">{bg.home.sectionEyebrow}</p>
        <h1>{bg.home.sectionTitle}</h1>
        <p className="muted" style={{ marginTop: 20 }}>
          {bg.home.sectionDescription}
        </p>
      </div>
      <div className="world-grid">
        {data.worlds.map((world, index) => (
          <Link
            className="world-card"
            key={world.id}
            href={world.published ? `/app/world/${world.slug}` : "/signup"}
          >
            <WorldArt visual={world.visual} color={world.color} />
            <div className="world-card-content">
              <span className="eyebrow">
                {bg.world.eyebrow} {String(index + 1).padStart(2, "0")}
              </span>
              <h3>{world.title}</h3>
              <p>{world.description}</p>
              <div className="world-card-footer">
                <span>
                  {data.lessons.filter((l) => l.worldId === world.id).length || "—"}{" "}
                  {bg.common.lessons}
                </span>
                <Badge className="badge-green">
                  {!world.published ? bg.common.soon : bg.common.free}
                </Badge>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
