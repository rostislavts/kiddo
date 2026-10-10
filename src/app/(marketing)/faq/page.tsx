import { bg } from "@/i18n/bg";
export const metadata = { title: bg.nav.faq };
export default function Faq() {
  return (
    <section className="container section">
      <div className="center-heading">
        <p className="eyebrow">{bg.nav.faq}</p>
        <h1>{bg.faq.title}</h1>
      </div>
      <div className="faq-list">
        {bg.faq.items.map((item) => (
          <details className="faq-item" key={item.q}>
            <summary>{item.q}</summary>
            <p>{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
