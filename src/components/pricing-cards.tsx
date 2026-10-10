import Link from "next/link";
import { Check, ArrowRight } from "lucide-react";
import { bg } from "@/i18n/bg";
import { Button } from "./ui/button";
import { Badge } from "./ui/primitives";
import { PricingComparison } from "./pricing-comparison";
export function PricingCards() {
  return (
    <>
      <div className="pricing-grid">
        <article className="pricing-card">
          <Badge className="badge-green">{bg.common.free}</Badge>
          <h2>{bg.pricing.freeTitle}</h2>
          <p>{bg.pricing.freeSubtitle}</p>
          <div className="price">
            <strong>{bg.pricing.freePrice}</strong>
            <span>{bg.pricing.forever}</span>
          </div>
          <ul className="feature-list">
            {bg.pricing.freeFeatures.map((f) => (
              <li key={f}>
                <Check />
                {f}
              </li>
            ))}
          </ul>
          <Button asChild variant="secondary">
            <Link href="/signup">
              {bg.nav.start}
              <ArrowRight size={18} />
            </Link>
          </Button>
        </article>
        <article className="pricing-card featured">
          <Badge>{bg.pricing.badge}</Badge>
          <h2>{bg.pricing.premiumTitle}</h2>
          <p>{bg.pricing.premiumSubtitle}</p>
          <div className="price">
            <strong>{bg.pricing.price}</strong>
            <span>{bg.pricing.perMonth}</span>
          </div>
          <ul className="feature-list">
            {bg.pricing.premiumFeatures.map((f) => (
              <li key={f}>
                <Check />
                {f}
              </li>
            ))}
          </ul>
          <Button asChild>
            <Link href="/parent/billing">
              {bg.pricing.upgrade}
              <ArrowRight size={18} />
            </Link>
          </Button>
        </article>
      </div>
      <PricingComparison />
    </>
  );
}
