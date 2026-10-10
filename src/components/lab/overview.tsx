import Link from "next/link";
import { ArrowRight, Zap, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageTitle, Badge } from "@/components/ui/primitives";
import { labTiles } from "@/content/lab/catalog";
import type { LabView } from "@/lib/lab/view";
import { isBasicMission } from "@/lib/lab/access-policy";
export function EnergyMeter({ energy }: { energy: LabView["energy"] }) {
  if (!energy.premium) return <Badge className="badge-neutral">AI Energy · Premium</Badge>;
  return (
    <div
      className="lab-energy"
      aria-label={
        energy.source === "school" ? "Училищен AI Energy бюджет" : "Семеен AI Energy бюджет"
      }
    >
      <Zap size={20} />
      <strong>{energy.balance} Energy</strong>
      <span>
        {energy.source === "school"
          ? `за теб · Premium чрез ${energy.schoolName}`
          : "общо за семейството"}
      </span>
      {energy.schoolRemaining !== null && energy.schoolRemaining < energy.individualBalance && (
        <small>Ограничено от общия училищен бюджет</small>
      )}
      {energy.endsAt && (
        <small>
          {energy.premium ? "До" : "Последен период до"}{" "}
          {new Date(energy.endsAt).toLocaleDateString("bg-BG")}
        </small>
      )}
      {energy.source === "school" && energy.familyAvailable && (
        <Link href="/parent/school">Избор на бюджет от родител</Link>
      )}
    </div>
  );
}
export function PremiumGate({ energy }: { energy: LabView["energy"] }) {
  return (
    <section className="lab-gate content-card">
      <div>
        <Badge>
          <LockKeyhole size={14} /> AI Lab Premium
        </Badge>
        <h2>
          Знанието е безплатно.
          <br />
          Идеите ти оживяват тук.
        </h2>
        <p>
          Истински AI отговори, твои ботове, мини агенти, изображения, Knowledge/RAG Lab и Premium
          мисии.
        </p>
        <p>Всички уроци, тестове и базови мисии в AI Academy са безплатни завинаги.</p>
        <p>✦ {energy.monthly} AI Energy месечно за цялото семейство</p>
        <p>Запазените творби и спечелените значки остават твои и след края на абонамента.</p>
      </div>
      <div>
        <strong className="lab-price">
          €14.90 <small>/ месец</small>
        </strong>
        <Button asChild>
          <Link href="/parent/billing">
            Отключи AI Lab <ArrowRight size={17} />
          </Link>
        </Button>
        <p className="muted">Абонаментът се управлява от родител.</p>
      </div>
    </section>
  );
}
export function ChallengeLink({
  challenge,
  missionId,
  roomId,
  children,
}: {
  challenge: LabView["challenges"][number];
  missionId?: string;
  roomId?: string;
  children: React.ReactNode;
}) {
  const query = new URLSearchParams({
    challenge: challenge.id,
    ...(missionId ? { mission: missionId } : {}),
    ...(roomId ? { room: roomId } : {}),
  });
  return (
    <Link className="lab-link" href={`/app/lab/${challenge.type}?${query}`}>
      {children}
      <ArrowRight size={16} />
    </Link>
  );
}
export function FeaturedMissions({ view }: { view: LabView }) {
  return (
    <section className="content-card">
      <p className="eyebrow">НОВО ПРИКЛЮЧЕНИЕ</p>
      <h2>Premium мисии сега</h2>
      {!view.missions.length && (
        <p>Следващата мисия се подготвя. Междувременно опитай някое от предизвикателствата.</p>
      )}
      <div className="lab-grid">
        {view.missions.map((m) => {
          const c = view.challenges.find((c) => c.id === m.challengeId);
          return (
            <article className="lab-mini-card" key={m.id}>
              <Badge>
                {view.completions.some((x) => x.missionId === m.id)
                  ? "✓ Завършена"
                  : "Premium · Мисия на месеца"}
              </Badge>
              <h3>{m.title}</h3>
              <p>{m.description}</p>
              <p className="muted">
                До {new Date(m.endsAt).toLocaleDateString("bg-BG")} · +{m.xpReward} XP
              </p>
              {c && (
                <ChallengeLink challenge={c} missionId={m.id}>
                  Отвори мисията
                </ChallengeLink>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
export function CreationGallery({ view, limit }: { view: LabView; limit?: number }) {
  const projects = limit ? view.projects.slice(0, limit) : view.projects;
  return (
    <div className="lab-grid">
      {!projects.length && (
        <p className="notice">Тук ще се появят твоите проекти. Започни с идея в AI Lab!</p>
      )}
      {projects.map((p) => {
        const tile = labTiles.find((t) => t.slug === p.feature);
        return (
          <Link
            className="lab-mini-card lab-creation"
            key={p.id}
            href={`/app/lab/${p.feature}?project=${p.id}`}
          >
            <span className={`lab-icon ${tile?.tone}`}>{tile?.icon || "✦"}</span>
            <h3>{p.title}</h3>
            <p>
              {tile?.title} · версия {p.version}
            </p>
            <Badge>{p.state === "completed" ? "Завършен" : "В процес"}</Badge>
            <small>{new Date(p.updatedAt).toLocaleDateString("bg-BG")}</small>
          </Link>
        );
      })}
    </div>
  );
}
function MissionChallenges({ view, basic }: { view: LabView; basic: boolean }) {
  const challenges = view.challenges.filter((c) => isBasicMission(c) === basic);
  return (
    <section className="content-card">
      <h2>{basic ? "Базови мисии · Безплатно завинаги" : "Premium предизвикателства"}</h2>
      <p>
        {basic
          ? "Откривай грешки, проверявай доказателства и поправяй отговори. Включени са и в двата плана, без AI Energy."
          : "Създавай с реални AI модели, агенти и свързани инструменти. Нужен е активен семеен или училищен Premium достъп."}
      </p>
      <div className="lab-grid">
        {challenges.map((c) => (
          <article className="lab-mini-card" key={c.id}>
            <Badge className={basic ? "badge-green" : undefined}>
              {basic ? "Безплатно" : "Premium"} · +{c.xpReward} XP
            </Badge>
            <h3>{c.title}</h3>
            <p>{c.description}</p>
            {view.attempts.some((a) => a.challengeId === c.id && a.passed) && <p>✓ Решена</p>}
            <ChallengeLink challenge={c}>Към мисията</ChallengeLink>
          </article>
        ))}
        {!challenges.length && <p>Следващите мисии се подготвят.</p>}
      </div>
    </section>
  );
}
export function LabOverview({
  view,
  mode = "home",
}: {
  view: LabView;
  mode?: "home" | "missions" | "creations";
}) {
  return (
    <>
      <PageTitle
        eyebrow={
          mode === "missions"
            ? "PLAY · ИГРАЙ"
            : mode === "creations"
              ? "МОИТЕ ИДЕИ"
              : "CREATE · СЪЗДАВАЙ"
        }
        title={
          mode === "missions"
            ? "AI Missions"
            : mode === "creations"
              ? "Моите творби"
              : "Твоята AI лаборатория"
        }
        description={
          mode === "creations"
            ? "Лична галерия на твоите идеи. Видима само в семейния акаунт."
            : mode === "missions"
              ? "Базови мисии безплатно завинаги. Още приключения с реален AI в Premium."
              : "Питай. Променяй. Проверявай. Създай нещо свое."
        }
        action={<EnergyMeter energy={view.energy} />}
      />
      {mode === "home" && !view.energy.premium && <PremiumGate energy={view.energy} />}
      {mode === "missions" && <MissionChallenges view={view} basic />}
      {mode !== "creations" && <FeaturedMissions view={view} />}
      {mode === "home" && (
        <>
          <section className="content-card">
            <div className="lab-section-heading">
              <h2>Продължи да създаваш</h2>
              <Link href="/app/creations">Всички творби →</Link>
            </div>
            <CreationGallery view={view} limit={3} />
          </section>
          <div className="lab-grid lab-tools">
            {labTiles.map((tile) => (
              <Link
                key={tile.slug}
                href={`/app/lab/${tile.slug}`}
                className={`lab-tool ${tile.tone}`}
              >
                <span className="lab-icon">{tile.icon}</span>
                <h2>{tile.title}</h2>
                <Badge className={tile.slug === "detective" ? "badge-green" : undefined}>
                  {tile.slug === "detective" ? "Базови мисии · Безплатно" : "Premium"}
                </Badge>
                <p>{tile.description}</p>
                <span className="lab-link">
                  Разгледай <ArrowRight size={16} />
                </span>
              </Link>
            ))}
          </div>
        </>
      )}
      {mode === "missions" && <MissionChallenges view={view} basic={false} />}
      {mode === "creations" && <CreationGallery view={view} />}
    </>
  );
}
