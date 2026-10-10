import Link from "next/link";
import { BookOpen, FlaskConical, Star, ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { bg } from "@/i18n/bg";
export const metadata = { title: bg.nav.how };
export default function How() {
  const icons = [BookOpen, FlaskConical, Star];
  return (
    <section className="container section">
      <div className="center-heading">
        <p className="eyebrow">{bg.nav.how}</p>
        <h1>{bg.home.howTitle}</h1>
        <p className="muted" style={{ marginTop: 20 }}>
          {bg.home.howDescription}
        </p>
      </div>
      <div className="steps-grid">
        {bg.home.steps.map((step, i) => {
          const Icon = icons[i];
          return (
            <article className="step-card" key={step.title}>
              <div className={`step-icon tone-${["violet", "mint", "peach"][i]}`}>
                <Icon size={30} />
                <span>{i + 1}</span>
              </div>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          );
        })}
      </div>
      <div className="parent-promo">
        <div className="parent-visual">
          <ShieldCheck size={85} />
        </div>
        <div>
          <h2>{bg.home.parentTitle}</h2>
          <p className="muted">{bg.home.parentDescription}</p>
          <Button asChild>
            <Link href="/signup">
              {bg.nav.start}
              <ArrowRight size={17} />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
