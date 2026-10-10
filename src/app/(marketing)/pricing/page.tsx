import { PricingCards } from "@/components/pricing-cards";
import { bg } from "@/i18n/bg";
export const metadata = { title: bg.nav.pricing };
export default function Pricing() {
  return (
    <section className="container section">
      <div className="center-heading">
        <p className="eyebrow">{bg.nav.pricing}</p>
        <h1>{bg.pricing.title}</h1>
        <p className="muted" style={{ marginTop: 20 }}>
          {bg.pricing.description}
        </p>
      </div>
      <PricingCards />
      <p className="tiny-copy" style={{ textAlign: "center" }}>
        {bg.pricing.current}
      </p>
      <p className="tiny-copy" style={{ textAlign: "center", marginTop: 8 }}>
        {bg.pricing.note}
      </p>
    </section>
  );
}
