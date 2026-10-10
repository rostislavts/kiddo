import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { Check } from "lucide-react";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { canAccessPremium } from "@/lib/billing/entitlements";
import { bg } from "@/i18n/bg";
import { PageTitle, Badge } from "@/components/ui/primitives";
import { BillingControls } from "@/components/billing-controls";
import { PricingComparison } from "@/components/pricing-comparison";
import { date } from "@/lib/utils";
export default async function Billing() {
  const user = await requireUser();
  const rows = await db()
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, user.id))
    .orderBy(desc(subscriptions.updatedAt));
  const current = rows.find((s) => s.status !== "canceled") ?? rows[0];
  const premium = canAccessPremium(rows, process.env.PADDLE_MONTHLY_PRICE_ID);
  const configured = !!(
    process.env.PADDLE_API_KEY &&
    process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN &&
    process.env.PADDLE_MONTHLY_PRICE_ID &&
    process.env.PADDLE_NOTIFICATION_WEBHOOK_SECRET
  );
  return (
    <>
      <PageTitle title={bg.billing.title} description={bg.billing.description} />
      <p className="notice section-gap">
        Тук управляваш семейния абонамент. Ако детето има училищен лиценз, той действа отделно и не
        изисква плащане от родителя. <Link href="/parent/school">Училище и Energy →</Link>
      </p>
      <div className="two-columns">
        <section className="content-card">
          <h2>{bg.billing.plan}</h2>
          <dl className="detail-list">
            <div>
              <dt>{bg.billing.plan}</dt>
              <dd>{premium ? bg.common.premium : bg.common.free}</dd>
            </div>
            <div>
              <dt>{bg.billing.status}</dt>
              <dd>
                <Badge>{bg.billing.statuses[current?.status ?? "none"]}</Badge>
              </dd>
            </div>
            <div>
              <dt>{bg.billing.next}</dt>
              <dd>{date(current?.periodEnd ?? null)}</dd>
            </div>
          </dl>
          {current?.cancelAtPeriodEnd && (
            <p className="notice section-gap">{bg.billing.cancelScheduled}</p>
          )}
          <div className="section-gap">
            <BillingControls
              hasSubscription={!!current && current.status !== "canceled"}
              premium={premium}
              configured={configured}
            />
          </div>
        </section>
        <article className="pricing-card featured">
          <Badge>{bg.common.premium}</Badge>
          <h2>{bg.pricing.premiumTitle}</h2>
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
          <p className="tiny-copy">{bg.pricing.note}</p>
          <p className="tiny-copy section-gap">{bg.pricing.current}</p>
        </article>
      </div>
      <PricingComparison />
    </>
  );
}
