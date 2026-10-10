import Link from "next/link";
import { Settings } from "lucide-react";
import { MarketingHeader } from "@/components/marketing-shell";
import { Button } from "@/components/ui/button";
import { bg } from "@/i18n/bg";
export default function Setup() {
  return (
    <>
      <MarketingHeader />
      <main className="container prose-page" id="main">
        <Settings size={40} style={{ color: "#ad91d3", marginBottom: 22 }} />
        <h1>{bg.setup.title}</h1>
        <p>{bg.setup.description}</p>
        <h2>{bg.setup.env}</h2>
        <div className="setup-list">
          {["DATABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"].map(
            (key) => (
              <code key={key}>{key}</code>
            ),
          )}
          <code>
            npm run db:migrate
            <br />
            npm run db:seed
          </code>
        </div>
        <p>{bg.setup.docs}</p>
        <p>{bg.setup.optional}</p>
        <Button asChild>
          <Link href="/">{bg.setup.link}</Link>
        </Button>
      </main>
    </>
  );
}
