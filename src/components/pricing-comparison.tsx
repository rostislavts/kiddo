import { bg } from "@/i18n/bg";

function Included({ value }: { value: boolean | string }) {
  if (typeof value === "string") return <strong>{value}</strong>;
  return (
    <span
      className={value ? "plan-included" : "plan-excluded"}
      role="img"
      aria-label={value ? "Включено" : "Не е включено"}
    >
      {value ? "✓" : "–"}
    </span>
  );
}

export function PricingComparison() {
  return (
    <section className="content-card plan-comparison">
      <h2>{bg.pricing.comparisonTitle}</h2>
      <table aria-label={bg.pricing.comparisonTitle}>
        <thead>
          <tr>
            <th scope="col">Възможности</th>
            <th scope="col">AI Academy</th>
            <th scope="col">AI Lab</th>
          </tr>
        </thead>
        <tbody>
          {bg.pricing.comparison.map((row) => (
            <tr key={row.feature}>
              <th scope="row">{row.feature}</th>
              <td>
                <Included value={row.academy} />
              </td>
              <td>
                <Included value={row.lab} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="tiny-copy">{bg.pricing.comparisonNote}</p>
    </section>
  );
}
