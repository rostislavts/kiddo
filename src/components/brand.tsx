import Link from "next/link";
import { Bot } from "lucide-react";
import { bg } from "@/i18n/bg";
export function Brand({ href = "/", small = false }: { href?: string; small?: boolean }) {
  return (
    <Link href={href} className="brand" aria-label={bg.brand}>
      <span className="brand-icon">
        <Bot size={27} strokeWidth={2.3} />
      </span>
      <span>
        {bg.brand}
        {!small && <small>{bg.tagline}</small>}
      </span>
    </Link>
  );
}
