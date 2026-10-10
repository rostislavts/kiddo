import Link from "next/link";
import { db } from "@/db";
import { requireAdmin } from "@/lib/auth/session";
import { schoolList } from "@/lib/schools/view";
import { SchoolCreator } from "@/components/schools/admin";
import { PageTitle, Badge } from "@/components/ui/primitives";
export default async function Schools() {
  const user = await requireAdmin(),
    schools = await schoolList(db(), user.id);
  return (
    <>
      <PageTitle
        title="Училища и лицензи"
        description="Управлявай договорения Premium достъп за ученици."
      />
      <div className="lab-grid">
        {schools.map((s) => (
          <Link key={s.id} className="content-card lab-link" href={`/school/${s.id}`}>
            <div>
              <h2>{s.name}</h2>
              <p>
                {s.contactName} · {s.contactEmail}
              </p>
              <Badge>{s.status === "active" ? "Активно" : "Спряно"}</Badge>
            </div>
            →
          </Link>
        ))}
      </div>
      <SchoolCreator />
    </>
  );
}
