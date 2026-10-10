"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { postJson } from "@/lib/client-api";
import type { AIConfig } from "@/lib/ai/models";
import type { labChallenges, featuredMissions, achievements } from "@/db/schema";
type Challenge = typeof labChallenges.$inferSelect;
type Mission = typeof featuredMissions.$inferSelect;
type Achievement = typeof achievements.$inferSelect;
export function LabAdmin({
  settings,
  challenges,
  missions,
  badges,
}: {
  settings: { config: AIConfig; version: number };
  challenges: Challenge[];
  missions: Mission[];
  badges: Achievement[];
}) {
  const router = useRouter();
  const [config, setConfig] = useState(settings.config);
  const [version, setVersion] = useState(settings.version);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [kind, setKind] = useState<"challenge" | "mission" | "achievement">("challenge");
  const [draft, setDraft] = useState("");
  const [advanced, setAdvanced] = useState(JSON.stringify(config, null, 2));
  const [userId, setUserId] = useState("");
  const [amount, setAmount] = useState(100);
  const choices = kind === "challenge" ? challenges : kind === "mission" ? missions : badges;
  async function perform(action: string, data: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const result = await postJson<Record<string, unknown>>("/api/admin/lab", { action, data });
      setStatus("Промените са запазени.");
      router.refresh();
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Грешка при запис.");
      return null;
    } finally {
      setBusy(false);
    }
  }
  function select(id: string) {
    const row = choices.find((c) => c.id === id);
    if (!row) {
      setDraft("");
      return;
    }
    let value: Record<string, unknown>;
    if (kind === "challenge") {
      const c = row as Challenge;
      value = {
        id: c.id,
        slug: c.slug,
        type: c.type,
        title: c.title,
        description: c.description,
        configuration: c.configuration,
        status: c.status,
        xpReward: c.xpReward,
        expectedVersion: c.version,
      };
    } else if (kind === "mission") {
      const m = row as Mission;
      value = {
        id: m.id,
        title: m.title,
        description: m.description,
        challengeId: m.challengeId,
        startsAt: new Date(m.startsAt).toISOString(),
        endsAt: new Date(m.endsAt).toISOString(),
        xpReward: m.xpReward,
        achievementId: m.achievementId,
        status: m.status,
      };
    } else {
      const b = row as Achievement;
      const criteria = b.criteria as { event: string; count: number };
      value = {
        id: b.id,
        key: b.key,
        title: b.title,
        description: b.description,
        event: criteria.event,
        count: criteria.count,
        published: b.published,
      };
    }
    setDraft(JSON.stringify(value, null, 2));
  }
  function newDraft() {
    const first = challenges[0];
    const value =
      kind === "challenge"
        ? {
            slug: "new-prompt-battle",
            type: "prompt-battles",
            title: "Ново предизвикателство",
            description: "Опиши ясна цел.",
            configuration: {
              instructions: "Напиши инструкция за история с робот.",
              requirements: [{ type: "required_terms", terms: ["робот"] }],
              forbiddenElements: [],
              maxAttempts: 3,
              difficulty: "easy",
              energyCost: 3,
            },
            status: "draft",
            xpReward: 50,
          }
        : kind === "mission"
          ? {
              title: "Нова мисия",
              description: "Ново приключение в AI Lab.",
              challengeId: first?.id,
              startsAt: new Date().toISOString(),
              endsAt: new Date(Date.now() + 30 * 86400000).toISOString(),
              xpReward: 50,
              achievementId: null,
              status: "draft",
            }
          : {
              key: "new-lab-badge",
              title: "Нова Lab значка",
              description: "За успешно AI приключение.",
              event: "prompt_playground_run",
              count: 3,
              published: false,
            };
    setDraft(JSON.stringify(value, null, 2));
  }
  async function saveDraft() {
    try {
      const result = await perform(kind, JSON.parse(draft));
      if (result) {
        if (kind === "challenge")
          setDraft(
            JSON.stringify(
              { ...JSON.parse(draft), id: result.id, expectedVersion: result.version },
              null,
              2,
            ),
          );
        else setDraft(JSON.stringify({ ...JSON.parse(draft), id: result.id }, null, 2));
      }
    } catch {
      setError("Невалиден JSON. Провери запетаите и кавичките.");
    }
  }
  return (
    <>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      {status && (
        <p className="success-message" role="status">
          {status}
        </p>
      )}
      <section className="content-card">
        <h2>Достъп, модели и Energy</h2>
        <div className="lab-admin-controls">
          <label>
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
            />{" "}
            Всички AI заявки са включени
          </label>
          <label>
            Месечен семеен бюджет{" "}
            <input
              type="number"
              min={1}
              max={10000}
              value={config.monthlyEnergy}
              onChange={(e) => setConfig({ ...config, monthlyEnergy: Number(e.target.value) })}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={config.rollover}
              onChange={(e) => setConfig({ ...config, rollover: e.target.checked })}
            />{" "}
            Прехвърляне на неизползвана Energy
          </label>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Функция</th>
                <th>Включена</th>
                <th>Energy</th>
                <th>Модел</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(config.features).map(([key, feature]) => (
                <tr key={key}>
                  <td>{key}</td>
                  <td>
                    <input
                      aria-label={`Включи ${key}`}
                      type="checkbox"
                      checked={feature.enabled}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          features: {
                            ...config.features,
                            [key]: { ...feature, enabled: e.target.checked },
                          },
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`Energy ${key}`}
                      type="number"
                      min={1}
                      max={100}
                      value={feature.cost}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          features: {
                            ...config.features,
                            [key]: { ...feature, cost: Number(e.target.value) },
                          },
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`Модел ${key}`}
                      value={feature.model}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          features: {
                            ...config.features,
                            [key]: { ...feature, model: e.target.value },
                          },
                        })
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button
          disabled={busy}
          onClick={async () => {
            const saved = await perform("settings", { configuration: config, version });
            if (saved) {
              setVersion(Number(saved.version));
              setAdvanced(JSON.stringify(saved.configuration, null, 2));
            }
          }}
        >
          Запази настройките
        </Button>
        <p className="muted">
          Новият месечен бюджет се прилага при следващия billing период. Цената на Prompt Battle се
          задава в неговата конфигурация.
        </p>
        <details>
          <summary>Лимити, цени за отчетност и разширени настройки</summary>
          <p>
            Лимити за вход/изход, заявки в минута, стъпки, изображения и срокове. Prices използва
            USD за милион tokens и за изображение; празна цена означава неизвестен разход, а не
            нула.
          </p>
          <Button
            size="small"
            variant="ghost"
            onClick={() => setAdvanced(JSON.stringify(config, null, 2))}
          >
            Зареди текущите стойности
          </Button>
          <textarea
            aria-label="Разширена AI конфигурация"
            className="lab-admin-json"
            value={advanced}
            onChange={(e) => setAdvanced(e.target.value)}
          />
          <Button
            disabled={busy}
            variant="secondary"
            onClick={async () => {
              try {
                const configuration = JSON.parse(advanced);
                const saved = await perform("settings", { configuration, version });
                if (saved) {
                  setConfig(saved.configuration as AIConfig);
                  setVersion(Number(saved.version));
                }
              } catch {
                setError("Невалиден JSON.");
              }
            }}
          >
            Запази разширените настройки
          </Button>
        </details>
      </section>
      <section className="content-card">
        <h2>Мисии, предизвикателства и значки</h2>
        <p>
          Публикуваните записи стават достъпни веднага. Featured мисии се показват само между
          startsAt и endsAt (UTC). За нов период създай нов запис.
        </p>
        <div className="lab-admin-controls">
          <label>
            Вид
            <select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as typeof kind);
                setDraft("");
              }}
            >
              <option value="challenge">Предизвикателства и Escape Rooms</option>
              <option value="mission">Featured мисии</option>
              <option value="achievement">Premium значки</option>
            </select>
          </label>
          <label>
            Запис
            <select value="" onChange={(e) => select(e.target.value)}>
              <option value="">Избери за редакция</option>
              {choices.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>
          <Button variant="secondary" onClick={newDraft}>
            Нов запис
          </Button>
        </div>
        {draft && (
          <>
            <textarea
              aria-label="Конфигурация на мисията"
              className="lab-admin-json"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <div className="lab-actions">
              <Button disabled={busy} onClick={saveDraft}>
                Запази съдържанието
              </Button>
              <Button
                disabled={busy}
                variant="secondary"
                onClick={() => {
                  try {
                    const copy = JSON.parse(draft);
                    delete copy.id;
                    delete copy.expectedVersion;
                    if (copy.slug) copy.slug += "-copy";
                    if (copy.key) copy.key += "-copy";
                    if (copy.status) copy.status = "draft";
                    setDraft(JSON.stringify(copy, null, 2));
                  } catch {
                    setError("Невалиден JSON.");
                  }
                }}
              >
                Копирай като нов
              </Button>
            </div>
          </>
        )}
        <details>
          <summary>Справочник с идентификатори</summary>
          <ul>
            {challenges.map((c) => (
              <li key={c.id}>
                {c.title} · {c.type} · {c.status}
                <br />
                <code>{c.id}</code>
              </li>
            ))}
          </ul>
        </details>
      </section>
      <section className="content-card">
        <h2>Добави Energy</h2>
        <p>Добавката е за текущия активен billing период. Нужен е ID на родителския акаунт.</p>
        <div className="lab-admin-controls">
          <label>
            Родителски ID
            <input value={userId} onChange={(e) => setUserId(e.target.value)} />
          </label>
          <label>
            Energy
            <input
              type="number"
              min={1}
              max={10000}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </label>
          <Button
            disabled={busy}
            onClick={() => perform("grant", { userId, amount, requestId: crypto.randomUUID() })}
          >
            Добави Energy
          </Button>
        </div>
      </section>
    </>
  );
}
