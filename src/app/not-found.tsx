import Link from "next/link";
import { bg } from "@/i18n/bg";
import { Button } from "@/components/ui/button";
import { Robot } from "@/components/illustration";
export default function NotFound() {
  return (
    <main className="container gate" id="main">
      <div className="auth-art">
        <Robot />
      </div>
      <h1>{bg.errors.notFound}</h1>
      <p className="muted">{bg.errors.notFoundText}</p>
      <Button asChild>
        <Link href="/">{bg.errors.back}</Link>
      </Button>
    </main>
  );
}
