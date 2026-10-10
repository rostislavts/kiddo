import { legal } from "@/i18n/legal-bg";
export const metadata = { title: legal.privacy.title };
export default function Privacy() {
  return (
    <article className="container prose-page">
      <h1>{legal.privacy.title}</h1>
      <p className="notice">{legal.draft}</p>
      {legal.privacy.sections.map((section) => (
        <section key={section.title}>
          <h2>{section.title}</h2>
          <p>{section.body}</p>
        </section>
      ))}
    </article>
  );
}
