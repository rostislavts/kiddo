"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Play, Save, Trash2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageTitle, Badge } from "@/components/ui/primitives";
import { postJson } from "@/lib/client-api";
import type { LabView } from "@/lib/lab/view";
import { labTiles, curatedImages } from "@/content/lab/catalog";
import { assemblePrompt, botInstructions } from "@/lib/ai/prompts";
import { promptBuilderSchema, botSchema } from "@/lib/ai/schemas";
import { Builder, defaults } from "./builders";
import { EnergyMeter, PremiumGate, ChallengeLink } from "./overview";
import { attemptContext } from "@/lib/lab/context";
import { LabResult } from "./result";
import { isBasicMission } from "@/lib/lab/access-policy";
type Project = LabView["projects"][number];
type Selection = { project?: string; challenge?: string; mission?: string; room?: string };
export function LabWorkspace({
  initial,
  feature,
  selection,
}: {
  initial: LabView;
  feature: string;
  selection: Selection;
}) {
  const [view, setView] = useState(initial);
  const tile = labTiles.find((t) => t.slug === feature)!;
  const [project, setProject] = useState(
    initial.projects.find((p) => p.id === selection.project && p.feature === feature),
  );
  const [title, setTitle] = useState(project?.title ?? `Моят ${tile.title}`);
  const [configuration, setConfiguration] = useState<Record<string, unknown>>(
    project?.configuration ?? structuredClone(defaults[feature] ?? {}),
  );
  const challenge =
    view.challenges.find((c) => c.id === selection.challenge && c.type === feature) ??
    view.challenges.find(
      (c) =>
        c.type === feature &&
        (["prompt-battles", "agent-missions", "detective", "escape-rooms"].includes(feature) ||
          (feature === "projects" && c.configuration.template === configuration.template)),
    );
  const context = {
    ...(challenge ? { challengeId: challenge.id } : {}),
    ...(selection.mission ? { missionId: selection.mission } : {}),
    ...(selection.room ? { escapeRunId: selection.room } : {}),
  };
  const [missionAgentId, setMissionAgentId] = useState("");
  const [message, setMessage] = useState(
    feature === "vision"
      ? curatedImages[0].question
      : feature === "knowledge" && challenge
        ? String(challenge.configuration.question ?? "")
        : "Разкажи ми за един любопитен робот.",
  );
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  const [answerIndex, setAnswerIndex] = useState<number>();
  const [imageId, setImageId] = useState<"library" | "space">("library");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [compare, setCompare] = useState<string[]>([]);
  const [card, setCard] = useState({ id: undefined as string | undefined, title: "", content: "" });
  const opened = useRef(false);
  const history = view.history
    .filter((r) => r.feature === feature && (!project || r.projectId === project.id))
    .slice(0, view.historyLimit);
  const savedGame = project ? view.games.find((g) => g.projectId === project.id) : null;
  const latestGame =
    feature === "games"
      ? (result ??
        (savedGame && savedGame.turn > 0
          ? {
              text: savedGame.narration ?? "Започни ново приключение.",
              turn: savedGame.turn,
              maxTurns: configuration.maxTurns,
              missionStatus: savedGame.status,
              choices: savedGame.status === "active" ? (savedGame.choices ?? []) : [],
            }
          : null))
      : null;
  const cost = view.costs[feature]?.cost ?? 0;
  const actualCost =
    feature === "prompt-battles" ? Number(challenge?.configuration.energyCost ?? cost) : cost;
  const paid = view.energy.premium;
  const basicMission = isBasicMission(challenge, context);
  const canAssess = paid || basicMission;
  const canRun =
    paid &&
    view.aiReady &&
    view.costs[feature]?.enabled !== false &&
    view.energy.balance >= actualCost;
  const hasBuilder = Object.hasOwn(defaults, feature);
  async function api<T>(action: string, data: Record<string, unknown>): Promise<T> {
    return postJson<T>("/api/lab", { action, childId: view.childId, data });
  }
  async function refresh() {
    const response = await fetch(`/api/lab?childId=${view.childId}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Не успяхме да обновим данните.");
    const next = (await response.json()) as LabView;
    setView(next);
    return next;
  }
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    void postJson("/api/lab", {
      action: "opened",
      childId: initial.childId,
      data: { feature },
    }).catch(() => {});
  }, [feature, initial.childId]);
  async function task(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Опитай отново.");
      try {
        await refresh();
      } catch {
        /* Keep the useful original error. */
      }
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    const saved = await api<Project>("save_project", {
      ...(project ? { id: project.id, expectedVersion: project.version } : {}),
      feature,
      title,
      configuration,
    });
    setProject(saved);
    return saved;
  }
  function chooseProject(id: string) {
    const next = view.projects.find((p) => p.id === id);
    setProject(next);
    setTitle(next?.title ?? `Моят ${tile.title}`);
    setConfiguration(next?.configuration ?? structuredClone(defaults[feature] ?? {}));
    setResult(null);
    setCompare([]);
    setCard({ id: undefined, title: "", content: "" });
  }
  async function run(choice = "") {
    await task(async () => {
      const saved = hasBuilder ? await save() : undefined;
      let input: Record<string, unknown> = {};
      if (feature === "prompts" || feature === "images") input = { builder: configuration };
      if (feature === "prompt-battles") input = { prompt };
      if (feature === "bots" || feature === "knowledge") input = { message };
      if (feature === "agents") input = { configuration };
      if (feature === "vision") input = { imageId, message };
      if (feature === "games") input = { choice };
      const output = await api<{ result: Record<string, unknown> }>("run", {
        requestId: crypto.randomUUID(),
        feature,
        ...(saved ? { projectId: saved.id } : missionAgentId ? { projectId: missionAgentId } : {}),
        ...context,
        input,
      });
      setResult(output.result);
      await refresh();
    });
  }
  async function assess() {
    await task(async () => {
      const saved = feature === "projects" ? await save() : project;
      setResult(
        await api<Record<string, unknown>>("assessment", {
          ...context,
          answer,
          ...(answerIndex === undefined ? {} : { answerIndex }),
          ...(saved ? { projectId: saved.id } : {}),
        }),
      );
      await refresh();
    });
  }
  let preview = "";
  if (feature === "prompts") {
    const parsed = promptBuilderSchema.safeParse(configuration);
    if (parsed.success) preview = assemblePrompt(parsed.data);
  }
  if (feature === "bots") {
    const parsed = botSchema.safeParse(configuration);
    if (parsed.success) preview = botInstructions(parsed.data);
  }
  const attempts = challenge
    ? view.attempts.filter(
        (a) =>
          a.challengeId === challenge.id &&
          a.contextKey ===
            attemptContext(
              { missionId: selection.mission, escapeRunId: selection.room },
              challenge.version,
            ),
      )
    : [];
  const room =
    feature === "escape-rooms" ? view.escapeRuns.find((r) => r.roomId === challenge?.id) : null;
  const steps =
    feature === "escape-rooms" ? view.escapeSteps.filter((s) => s.roomId === challenge?.id) : [];
  const finishedBattle =
    feature === "prompt-battles" &&
    attempts.length >= Number(challenge?.configuration.maxAttempts ?? 3);
  return (
    <>
      <Link className="lab-back" href={basicMission ? "/app/missions" : "/app/lab"}>
        <ArrowLeft size={16} /> {basicMission ? "AI Missions" : "AI Lab"}
      </Link>
      <PageTitle
        eyebrow="ОПИТАЙ · ПРОМЕНИ · ПРОВЕРИ"
        title={tile.title}
        description={tile.description}
        action={
          basicMission ? (
            <Badge className="badge-green">Базова мисия · Безплатно</Badge>
          ) : (
            <EnergyMeter energy={view.energy} />
          )
        }
      />
      {!paid && !basicMission && <PremiumGate energy={view.energy} />}
      {basicMission && (
        <p className="notice">
          Тази мисия е безплатна завинаги. Провери фактите, избери отговор и спечели XP. Не е нужна
          AI Energy.
        </p>
      )}
      {paid && !view.aiReady && !basicMission && (
        <p className="notice">
          AI връзката още не е настроена или е временно спряна. Можеш да подготвиш проектите си.
          Няма да се отнема Energy.
        </p>
      )}
      <p className="lab-safety">
        Използвай измислени герои и места. Не въвеждай истински имена, адреси или телефони.
        Проверявай AI отговорите — възможни са грешки.
      </p>
      {view.challenges.filter((c) => c.type === feature).length > 0 && (
        <nav className="lab-tabs" aria-label="Предизвикателства">
          {view.challenges
            .filter((c) => c.type === feature)
            .map((c) => (
              <Link
                aria-current={c.id === challenge?.id ? "page" : undefined}
                key={c.id}
                href={`/app/lab/${feature}?challenge=${c.id}`}
              >
                {c.title}
              </Link>
            ))}
        </nav>
      )}
      {selection.room && (
        <p className="notice">
          Тази задача е част от Escape Room.{" "}
          <Link href="/app/lab/escape-rooms">Виж напредъка →</Link>
        </p>
      )}
      {challenge && (
        <section className="content-card lab-challenge">
          <Badge>+{challenge.xpReward} XP при първо успешно решение</Badge>
          <h2>{challenge.title}</h2>
          <p>{challenge.description}</p>
          {typeof challenge.configuration.instructions === "string" && (
            <p>{challenge.configuration.instructions}</p>
          )}
          {feature === "prompt-battles" && (
            <>
              <p>
                Опити: {attempts.length} / {String(challenge.configuration.maxAttempts)} ·{" "}
                {actualCost} Energy на опит
              </p>
              <ul>
                {(
                  (challenge.configuration.requirements as {
                    type: string;
                    terms?: string[];
                    min?: number;
                    max?: number;
                    count?: number;
                    criterion?: string;
                    headings?: string[];
                    keys?: string[];
                  }[]) ?? []
                ).map((r, i) => (
                  <li key={i}>
                    {r.type === "required_terms"
                      ? `Включи: ${r.terms?.join(", ")}`
                      : r.type === "forbidden_terms"
                        ? `Без: ${r.terms?.join(", ")}`
                        : r.type === "word_count"
                          ? `${r.min}–${r.max} думи`
                          : r.type === "item_count"
                            ? `${r.count} точки`
                            : r.type === "semantic"
                              ? r.criterion
                              : r.type === "headings"
                                ? `Заглавия: ${r.headings?.join(", ")}`
                                : `JSON полета: ${r.keys?.join(", ")}`}
                  </li>
                ))}
              </ul>
            </>
          )}
          {feature === "agent-missions" && (
            <p>
              До {String(challenge.configuration.maxSteps)} стъпки. Агентът работи с уликите и
              инструментите на този измислен свят.
            </p>
          )}
        </section>
      )}
      {feature === "escape-rooms" ? (
        <section className="content-card">
          <h2>Бягството започва с една идея</h2>
          <ol className="lab-trace">
            {steps.map((step, index) => {
              const c = view.challenges.find((c) => c.id === step.challengeId);
              return (
                <li key={step.id}>
                  <strong>
                    {index + 1}. {c?.title}
                  </strong>
                  <p>
                    {room && index < room.step
                      ? "✓ Завършено"
                      : room && index === room.step
                        ? "Твоята следваща стъпка"
                        : "Предстои"}
                  </p>
                  {room && !room.completedAt && index === room.step && c && (
                    <ChallengeLink challenge={c} roomId={room.id} missionId={selection.mission}>
                      Продължи
                    </ChallengeLink>
                  )}
                </li>
              );
            })}
          </ol>
          {!room && (
            <Button
              disabled={!paid || busy || !challenge}
              onClick={() =>
                task(async () => {
                  await api("start_escape", { roomId: challenge!.id });
                  await refresh();
                })
              }
            >
              Започни бягството
            </Button>
          )}
          {room?.completedAt && (
            <p className="success-message">✓ Мисията е изпълнена. Твоите умения работят заедно!</p>
          )}
        </section>
      ) : (
        <div className="lab-workspace">
          <section className="content-card lab-builder">
            <h2>{hasBuilder ? "Твоят проект" : "Твоята задача"}</h2>
            {hasBuilder && (
              <>
                <label>
                  Отвори проект
                  <select
                    disabled={busy}
                    value={project?.id ?? ""}
                    onChange={(e) => chooseProject(e.target.value)}
                  >
                    <option value="">+ Нов проект</option>
                    {view.projects
                      .filter((p) => p.feature === feature)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Заглавие на проекта
                  <input
                    maxLength={80}
                    value={title}
                    disabled={busy || !paid}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </label>
                <Builder
                  feature={feature}
                  configuration={configuration}
                  onChange={setConfiguration}
                  projects={view.projects}
                  disabled={busy || !paid}
                />
                {preview && (
                  <details>
                    <summary>
                      {feature === "bots"
                        ? "Как работи моят бот? · System prompt"
                        : "Покажи действителния prompt"}
                    </summary>
                    {feature === "bots" && (
                      <p>
                        System prompt е инструкцията за ролята и правилата на бота. Промени правило
                        и провери следващия му отговор.
                      </p>
                    )}
                    <pre className="lab-output">{preview}</pre>
                  </details>
                )}
                <div className="lab-actions">
                  <Button
                    variant="secondary"
                    disabled={busy || !paid}
                    onClick={() =>
                      task(async () => {
                        await save();
                        await refresh();
                        setNotice("Проектът е запазен.");
                      })
                    }
                  >
                    <Save size={16} /> Запази проект
                  </Button>
                  {project && (
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(`Да изтрия „${project.title}“ и свързаните му данни?`))
                          void task(async () => {
                            await api("delete_project", { id: project.id });
                            await refresh();
                            chooseProject("");
                            setNotice("Проектът е изтрит.");
                          });
                      }}
                    >
                      <Trash2 size={16} /> Изтрий
                    </Button>
                  )}
                </div>
              </>
            )}
            {feature === "prompt-battles" && (
              <label>
                Твоята инструкция
                <textarea
                  rows={7}
                  maxLength={4000}
                  disabled={busy || !paid}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Дай на AI точни инструкции, за да изпълни всички условия."
                />
              </label>
            )}
            {feature === "agent-missions" && (
              <>
                <label>
                  Кой агент да участва?
                  <select
                    value={missionAgentId}
                    onChange={(e) => setMissionAgentId(e.target.value)}
                    disabled={busy}
                  >
                    <option value="">Готовият агент за тази мисия</option>
                    {view.projects
                      .filter((p) => p.feature === "agents")
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                  </select>
                </label>
                <div className="notice">
                  <h3>Мисия → инструмент → резултат</h3>
                  <p>
                    Ще видиш последователността от действия и провереното решение. Всяко ново
                    изпълнение избира вариант на загадката.
                  </p>
                  <Link href="/app/lab/agents">Искам да построя свой агент →</Link>
                </div>
              </>
            )}
            {feature === "vision" && (
              <>
                <label>
                  Избери сцена
                  <select
                    value={imageId}
                    disabled={busy}
                    onChange={(e) => {
                      const id = e.target.value as typeof imageId;
                      setImageId(id);
                      setMessage(curatedImages.find((i) => i.id === id)!.question);
                      setResult(null);
                    }}
                  >
                    {curatedImages.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.title}
                      </option>
                    ))}
                  </select>
                </label>
                <Image
                  unoptimized
                  width={960}
                  height={640}
                  className="lab-generated"
                  src={curatedImages.find((i) => i.id === imageId)!.path}
                  alt={curatedImages.find((i) => i.id === imageId)!.title}
                />
              </>
            )}
            {feature === "detective" && challenge && (
              <fieldset disabled={busy || !canAssess} className="lab-fields">
                <legend>{String(challenge.configuration.question)}</legend>
                {((challenge.configuration.claims as string[]) ?? []).map((claim, i) => (
                  <label className="lab-choice" key={i}>
                    <input
                      type="radio"
                      name="detective-answer"
                      checked={answerIndex === i}
                      onChange={() => {
                        setAnswerIndex(i);
                        if (challenge.configuration.mode === "fix") setAnswer(claim);
                      }}
                    />
                    {claim}
                  </label>
                ))}
                {challenge.configuration.mode === "fix" && (
                  <label>
                    Поправен отговор
                    <small>
                      Избери точната проверена формулировка от вариантите или я препиши.
                    </small>
                    <textarea
                      rows={3}
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      maxLength={1600}
                    />
                  </label>
                )}
                <Button onClick={assess} disabled={busy || !canAssess}>
                  Провери отговора · Безплатно
                </Button>
              </fieldset>
            )}
          </section>
          <div className="lab-output-column">
            {feature === "knowledge" && (
              <section className="content-card">
                <h2>Knowledge карти</h2>
                <p>
                  Дай на AI кратки факти за измисления свят. После задавай въпроси и виж избраните
                  източници.
                </p>
                {!project && <p className="notice">Запази проекта, за да добавиш карти.</p>}
                {view.cards
                  .filter((c) => c.projectId === project?.id)
                  .map((c) => (
                    <article className="lab-knowledge-card" key={c.id}>
                      <h3>{c.title}</h3>
                      <p>{c.content}</p>
                      <div className="lab-actions">
                        <Button
                          size="small"
                          variant="ghost"
                          disabled={busy || !paid}
                          onClick={() => setCard({ id: c.id, title: c.title, content: c.content })}
                        >
                          Редактирай
                        </Button>
                        <Button
                          size="small"
                          variant="ghost"
                          disabled={busy}
                          onClick={() =>
                            task(async () => {
                              await api("delete_card", { id: c.id });
                              await refresh();
                            })
                          }
                        >
                          Изтрий карта
                        </Button>
                      </div>
                    </article>
                  ))}
                <fieldset disabled={busy || !project || !paid} className="lab-fields">
                  <label>
                    Заглавие на картата
                    <input
                      value={card.title}
                      maxLength={100}
                      onChange={(e) => setCard({ ...card, title: e.target.value })}
                    />
                  </label>
                  <label>
                    Знание
                    <textarea
                      rows={3}
                      value={card.content}
                      maxLength={1600}
                      onChange={(e) => setCard({ ...card, content: e.target.value })}
                    />
                  </label>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      task(async () => {
                        await api("save_card", { ...card, projectId: project!.id });
                        setCard({ id: undefined, title: "", content: "" });
                        await refresh();
                      })
                    }
                  >
                    {card.id ? "Запази картата" : "Добави карта"}
                  </Button>
                  {challenge && Array.isArray(challenge.configuration.starterCards) && (
                    <Button
                      variant="ghost"
                      onClick={() =>
                        task(async () => {
                          for (const c of challenge.configuration.starterCards as {
                            title: string;
                            content: string;
                          }[])
                            if (
                              !view.cards.some(
                                (old) => old.projectId === project!.id && old.title === c.title,
                              )
                            )
                              await api("save_card", { ...c, projectId: project!.id });
                          await refresh();
                          setMessage(String(challenge.configuration.question));
                        })
                      }
                    >
                      Добави картите за мисията
                    </Button>
                  )}
                </fieldset>
              </section>
            )}
            <section className="content-card">
              <h2>{feature === "bots" ? "Изпробвай своя бот" : "Виж какво ще се получи"}</h2>
              {feature === "bots" &&
                project &&
                view.messages.some((m) => m.projectId === project.id) && (
                  <details open>
                    <summary>Скорошният разговор</summary>
                    {view.messages
                      .filter((m) => m.projectId === project.id)
                      .map((m) => (
                        <div className="lab-chat-message" key={m.id}>
                          <strong>{m.role === "user" ? "Ти" : "Твоят AI бот"}</strong>
                          <p className="lab-output">{m.content}</p>
                        </div>
                      ))}
                  </details>
                )}
              {["bots", "knowledge", "vision"].includes(feature) && (
                <label>
                  {feature === "bots" ? "Съобщение до бота" : "Твоят въпрос"}
                  <textarea
                    rows={3}
                    disabled={busy || !paid}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    maxLength={800}
                  />
                </label>
              )}
              {feature === "projects" ? (
                <>
                  <p>
                    Запази творбата, свържи и тествай инструментите. Галерията пази конфигурацията и
                    версиите им.
                  </p>
                  <div className="lab-actions">
                    {view.projects
                      .filter((p) => ((configuration.projectIds as string[]) ?? []).includes(p.id))
                      .map((p) => (
                        <Link
                          className="lab-link"
                          key={p.id}
                          href={`/app/lab/${p.feature}?project=${p.id}`}
                        >
                          Отвори {p.title} →
                        </Link>
                      ))}
                  </div>
                  {curatedImages
                    .filter((i) => ((configuration.visualIds as string[]) ?? []).includes(i.id))
                    .map((i) => (
                      <Image
                        key={i.id}
                        unoptimized
                        width={960}
                        height={640}
                        className="lab-generated"
                        src={i.path}
                        alt={i.title}
                      />
                    ))}
                  {challenge && (
                    <Button disabled={busy || !paid} onClick={assess}>
                      Провери творбата
                    </Button>
                  )}
                </>
              ) : feature === "detective" ? (
                <>
                  {challenge?.configuration.dynamic === true && attempts.some((a) => a.passed) && (
                    <div>
                      <p className="muted">Допълнително обяснение от реален AI модел · Premium</p>
                      <Button disabled={busy || !canRun} onClick={() => run()}>
                        Поискай AI обяснение · {actualCost} Energy
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {!(feature === "games" && latestGame) && (
                    <Button
                      disabled={
                        busy ||
                        !canRun ||
                        finishedBattle ||
                        ((feature === "prompt-battles" || feature === "agent-missions") &&
                          !challenge)
                      }
                      onClick={() => run()}
                    >
                      <Play size={16} />
                      {busy
                        ? "AI работи…"
                        : feature === "images"
                          ? "Създай изображение"
                          : feature === "games"
                            ? "Започни приключението"
                            : "Изпълни с AI"}
                      <span>
                        · {actualCost} <Zap size={13} />
                      </span>
                    </Button>
                  )}
                  {view.costs[feature]?.enabled === false && (
                    <p className="notice">Инструментът временно е в почивка.</p>
                  )}
                  {paid && view.energy.balance < actualCost && (
                    <p className="notice">
                      Energy е изчерпана за тази задача. Продължи с безплатните уроци в Академията.
                    </p>
                  )}
                  {finishedBattle && (
                    <p className="notice">
                      Всички опити са използвани. Сравни резултатите и избери следваща мисия.
                    </p>
                  )}
                </>
              )}
              {busy && (
                <p role="status" className="lab-running">
                  Подготвяме и проверяваме резултата. Изображенията може да отнемат повече време.
                </p>
              )}
              {(result || latestGame) && (
                <LabResult
                  result={(result ?? latestGame)!}
                  onChoice={feature === "games" ? (choice) => run(choice) : undefined}
                  disabled={busy || !canRun}
                />
              )}
              {!result && !latestGame && (
                <div className="lab-result-placeholder">
                  <span>{tile.icon}</span>
                  <p>Тук ще се появи твоят резултат.</p>
                  <small>Промени една идея и наблюдавай разликата.</small>
                </div>
              )}
            </section>
          </div>
        </div>
      )}
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="success-message" role="status">
          {notice}
        </p>
      )}
      {history.length > 0 && (
        <section className="content-card lab-history">
          <h2>Опити и сравнение</h2>
          <p className="muted">
            Показваме до {view.historyLimit} скорошни изпълнения. Избери до две, за да ги сравниш.
          </p>
          <div className="lab-history-list">
            {history.map((run, i) => (
              <label key={run.id}>
                <input
                  type="checkbox"
                  checked={compare.includes(run.id)}
                  disabled={!compare.includes(run.id) && compare.length >= 2}
                  onChange={(e) =>
                    setCompare(
                      e.target.checked
                        ? [...compare, run.id]
                        : compare.filter((id) => id !== run.id),
                    )
                  }
                />
                <span>
                  Опит {history.length - i} ·{" "}
                  {run.status === "completed"
                    ? `${run.energyUsed} Energy`
                    : run.status === "running"
                      ? "Изпълнява се"
                      : "Неуспешен · Energy е възстановена"}
                </span>
              </label>
            ))}
          </div>
          <div className="lab-compare">
            {history
              .filter((r) => compare.includes(r.id))
              .map((run) => (
                <article key={run.id}>
                  <h3>{new Date(run.createdAt).toLocaleString("bg-BG")}</h3>
                  <LabResult result={run.result} />
                </article>
              ))}
          </div>
        </section>
      )}
      {feature === "detective" && attempts.length > 0 && (
        <section className="content-card">
          <h2>Твоите проверки</h2>
          {attempts.slice(0, 5).map((a) => (
            <LabResult key={a.id} result={{ ...a.output, passed: a.passed }} />
          ))}
        </section>
      )}
    </>
  );
}
