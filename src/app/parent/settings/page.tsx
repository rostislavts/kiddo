import { Download } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { PageTitle } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { DeleteAccount } from "@/components/child-forms";
import { bg } from "@/i18n/bg";
export default async function Settings() {
  const user = await requireUser();
  return (
    <>
      <PageTitle title={bg.nav.settings} description={bg.parent.privacyDescription} />
      <div className="two-columns">
        <div>
          <section className="content-card">
            <h2>{bg.parent.account}</h2>
            <p>{user.email}</p>
          </section>
          <section className="content-card">
            <h2>{bg.parent.privacyTitle}</h2>
            <p className="tiny-copy" style={{ marginBottom: 22 }}>
              {bg.parent.analytics}
            </p>
            <Button asChild variant="secondary">
              <a href="/api/account" download>
                <Download size={18} />
                {bg.parent.export}
              </a>
            </Button>
          </section>
        </div>
        <section className="content-card danger-zone">
          <h2>{bg.parent.deleteAccount}</h2>
          <DeleteAccount />
        </section>
      </div>
    </>
  );
}
