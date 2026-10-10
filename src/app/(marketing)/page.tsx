import Link from "next/link";
import {
  ArrowRight,
  Check,
  ShieldCheck,
  Sparkles,
  BookOpen,
  FlaskConical,
  Star,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { Robot, WorldArt } from "@/components/illustration";
import { bg } from "@/i18n/bg";
import { worldSeeds } from "@/content/seed/curriculum";
import { PricingComparison } from "@/components/pricing-comparison";

export default function Home() {
  const stepIcons = [BookOpen, FlaskConical, Star];
  return (
    <>
      <section className="hero container">
        <div className="hero-copy">
          <Badge>
            <span className="live-dot" />
            {bg.home.eyebrow}
          </Badge>
          <h1>
            {bg.home.title}
            <br />
            <span>{bg.home.titleAccent}</span>
          </h1>
          <p>{bg.home.description}</p>
          <div className="hero-actions">
            <Button asChild size="large">
              <Link href="/signup">
                {bg.nav.start}
                <ArrowRight size={20} />
              </Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/curriculum">
                {bg.home.secondary}
                <ArrowRight size={18} />
              </Link>
            </Button>
          </div>
          <small>
            <Check size={16} />
            {bg.home.footnote}
          </small>
        </div>
        <div className="hero-scene">
          <div className="scene-orbit orbit-one" />
          <div className="scene-orbit orbit-two" />
          <span className="scene-star star-one">✦</span>
          <span className="scene-star star-two">✧</span>
          <div className="floating-label label-top">
            <Sparkles size={18} />
            {bg.home.bubble}
          </div>
          <div className="hero-robot">
            <Robot />
          </div>
          <div className="hero-mission">
            <div className="mission-icon">
              <Zap size={25} />
            </div>
            <div>
              <span className="eyebrow">{bg.home.mission}</span>
              <strong>{bg.home.missionTitle}</strong>
              <small>{bg.home.reward}</small>
            </div>
            <span className="mission-go">
              <ArrowRight size={21} />
            </span>
          </div>
          <span className="floating-pill pill-left">01</span>
          <span className="floating-pill pill-right">
            <Star size={27} fill="currentColor" />
          </span>
        </div>
      </section>
      <div className="trust-strip container">
        <span>
          <Sparkles />
          {bg.home.learnTag}
        </span>
        <span>
          <ShieldCheck />
          {bg.home.safeTag}
        </span>
        <span>
          <BookOpen />
          {bg.home.bgTag}
        </span>
      </div>
      <section className="section container">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{bg.home.sectionEyebrow}</p>
            <h2>{bg.home.sectionTitle}</h2>
            <p className="muted">{bg.home.sectionDescription}</p>
          </div>
          <Link href="/curriculum" className="text-link">
            {bg.home.secondary}
            <ArrowRight size={18} />
          </Link>
        </div>
        <div className="world-grid marketing-world-grid">
          {worldSeeds.slice(0, 3).map((w, i) => (
            <Link key={w.id} href="/curriculum" className="world-card">
              <WorldArt visual={w.visual} color={w.color} />
              <div className="world-card-content">
                <span className="eyebrow">
                  {bg.world.eyebrow} {String(i + 1).padStart(2, "0")}
                </span>
                <h3>{w.title}</h3>
                <p>{w.description}</p>
                <div className="world-card-footer">
                  <span>{i < 2 ? `3 ${bg.common.lessons}` : bg.common.soon}</span>
                  <Badge className={i === 0 ? "badge-green" : "badge-neutral"}>
                    {i < 2 ? bg.common.free : bg.common.soon}
                  </Badge>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
      <section className="how-section">
        <div className="container">
          <div className="center-heading">
            <p className="eyebrow">{bg.nav.how}</p>
            <h2>{bg.home.howTitle}</h2>
            <p className="muted">{bg.home.howDescription}</p>
          </div>
          <div className="steps-grid">
            {bg.home.steps.map((step, i) => {
              const Icon = stepIcons[i];
              return (
                <article key={step.title} className="step-card">
                  <div className={`step-icon tone-${["violet", "mint", "peach"][i]}`}>
                    <Icon size={31} />
                    <span>{i + 1}</span>
                  </div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>
      <section className="parent-promo container">
        <div className="parent-visual">
          <ShieldCheck size={88} strokeWidth={1.4} />
          <span className="mini-stat">
            <Check />
            {bg.home.safeTag}
          </span>
        </div>
        <div>
          <p className="eyebrow">{bg.nav.parent}</p>
          <h2>{bg.home.parentTitle}</h2>
          <p className="muted">{bg.home.parentDescription}</p>
          <Button asChild variant="secondary">
            <Link href="/how-it-works">
              {bg.home.parentCta}
              <ArrowRight size={18} />
            </Link>
          </Button>
        </div>
      </section>
      <div className="section container">
        <PricingComparison />
        <Link href="/pricing" className="text-link">
          Виж плановете и цените <ArrowRight size={18} />
        </Link>
      </div>
      <section className="final-cta container">
        <Sparkles size={32} />
        <h2>{bg.home.finalTitle}</h2>
        <p>{bg.home.finalDescription}</p>
        <Button asChild size="large">
          <Link href="/signup">
            {bg.nav.start}
            <ArrowRight size={19} />
          </Link>
        </Button>
      </section>
    </>
  );
}
