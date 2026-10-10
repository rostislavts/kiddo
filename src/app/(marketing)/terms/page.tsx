import { legal } from "@/i18n/legal-bg";
export const metadata = { title: legal.terms.title };
export default function Terms() {
  return (
    <article className="container prose-page">
      <h1>{legal.terms.title}</h1>
      <p className="notice">{legal.draft}</p>
      {legal.terms.sections.map((section) => (
        <section key={section.title}>
          <h2>{section.title}</h2>
          <p>{section.body}</p>
        </section>
      ))}
    </article>
  );
}
