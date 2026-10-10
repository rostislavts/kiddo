import { db } from "@/db";
import * as s from "@/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { aiConfiguration } from "@/lib/ai/settings";
import { labTelemetry } from "@/lib/lab/admin";
import { PageTitle } from "@/components/ui/primitives";
import { LabAdmin } from "@/components/lab/admin";
export default async function AdminLab() {
  await requireAdmin();
  const database = db();
  const [settings, challenges, missions, badges, telemetry] = await Promise.all([
    aiConfiguration(database),
    database.select().from(s.labChallenges),
    database.select().from(s.featuredMissions),
    database.select().from(s.achievements),
    labTelemetry(database),
  ]);
  return (
    <>
      <PageTitle
        title="AI Lab · управление"
        description="Публикувай мисии, управлявай бюджета и наблюдавай изпълненията."
      />
      <LabAdmin
        settings={settings}
        challenges={challenges}
        missions={missions}
        badges={badges.filter((b) => b.criteria.type === "lab")}
      />
      <section className="content-card">
        <h2>Използване и прогнозен разход</h2>
        <div className="lab-grid">
          <article className="lab-mini-card">
            <h3>{telemetry.conversion.percent}% Free → Premium</h3>
            <p>
              {telemetry.conversion.everSubscribed} от {telemetry.conversion.accounts} акаунта имат
              абонаментна история.
            </p>
          </article>
          <article className="lab-mini-card">
            <h3>{telemetry.conversion.activeFamilies} активни семейства</h3>
            <p>
              {telemetry.canceledFamiliesLast30Days} семейства с прекратен абонамент през последните
              30 дни.
            </p>
          </article>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Функция</th>
                <th>Статус</th>
                <th>Заявки</th>
                <th>Energy</th>
                <th>Оценка USD</th>
              </tr>
            </thead>
            <tbody>
              {telemetry.runs.map((r) => (
                <tr key={`${r.feature}:${r.status}`}>
                  <td>{r.feature}</td>
                  <td>{r.status}</td>
                  <td>{r.runs}</td>
                  <td>{r.energy ?? 0}</td>
                  <td>
                    {r.estimatedUsd === null
                      ? "Няма зададена цена"
                      : Number(r.estimatedUsd).toFixed(4)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3>Разход по семейство · последни 30 дни</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Родителски ID</th>
                <th>Заявки / активни деца</th>
                <th>Energy</th>
                <th>Известен разход USD</th>
              </tr>
            </thead>
            <tbody>
              {telemetry.perSubscriber.map((r) => (
                <tr key={r.userId}>
                  <td>
                    <code>{r.userId}</code>
                  </td>
                  <td>
                    {r.runs} / {r.children}
                  </td>
                  <td>{r.energy}</td>
                  <td>
                    {r.estimatedUsd === null ? "Неизвестен" : Number(r.estimatedUsd).toFixed(4)}
                    {Number(r.unpricedRuns) > 0 ? ` · ${r.unpricedRuns} без цена` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <details>
          <summary>Събития и активност</summary>
          <pre className="lab-output">{JSON.stringify(telemetry, null, 2)}</pre>
        </details>
      </section>
    </>
  );
}
