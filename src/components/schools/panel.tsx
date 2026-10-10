"use client";
import Link from "next/link";
import { useState, useRef } from "react";
import type { SchoolView } from "@/lib/schools/view";
import { SchoolForm, Field, value, number } from "./forms";
import { PageTitle, Badge } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
const date = (v: Date | string) => new Date(v).toLocaleDateString("bg-BG");
const states = { active: "Активен", suspended: "Спрян", draft: "Чернова" };
const actions: Record<string, string> = {
  school_saved: "Обновени данни за училището",
  contract_created: "Добавен договор",
  contract_active: "Активиран договор",
  contract_suspended: "Спрян договор",
  staff_saved: "Промяна в екипа",
  class_saved: "Обновен клас",
  invites_created: "Създадени покани",
  invite_revoked: "Отменена покана",
  invite_batch_revoked: "Отменена група неизползвани покани",
  enrollment_activated: "Активирано ученическо място",
  enrollment_left: "Прекратено ученическо място",
  enrollment_moved: "Преместване в клас",
  parent_left_school: "Родителят прекрати връзката",
};
type Batch = { expiresAt: string; invites: { id: string; code: string }[] };
export function SchoolPanel({ view }: { view: SchoolView }) {
  const { school, actor } = view,
    schoolId = school.id,
    [batch, setBatch] = useState<Batch | null>(null);
  const pendingBatch = useRef<string | null>(null);
  const path = `/school/${schoolId}`;
  const query = (page: number, invitePage = view.invitePage) =>
    `${path}?${new URLSearchParams({ page: String(page), invitePage: String(invitePage), ...(view.classId ? { classId: view.classId } : {}) })}`;
  function download() {
    if (!batch) return;
    const rows = [
      ["Училище", "Код", "Валидна до", "Активиране"],
      ...batch.invites.map((i) => [
        school.name,
        i.code,
        date(batch.expiresAt),
        `${location.origin}/parent/school`,
      ]),
    ];
    const csv =
      "\uFEFF" +
      rows
        .map((r) =>
          r
            .map((c) => '"' + (/^[=+@-]/.test(c) ? "'" : "") + c.replaceAll('"', '""') + '"')
            .join(";"),
        )
        .join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "school-invitations.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <PageTitle
        eyebrow="УЧИЛИЩЕН ПАНЕЛ"
        title={school.name}
        description={
          actor.role === "manager"
            ? "Управлявай екипа, класовете и ученическите места."
            : "Твоите класове и учебният напредък на учениците."
        }
        action={<Link href="/school">Всички училища →</Link>}
      />
      <section className="content-card">
        <div className="lab-section-heading">
          <h2>Училищен лиценз</h2>
          <Badge>{view.license ? "Premium е активен" : "Няма активен лиценз"}</Badge>
        </div>
        {view.license && (
          <p>
            Валиден до {date(view.license.endsAt)} · {view.license.monthlyEnergy} Energy месечно на
            ученик.
          </p>
        )}
        {view.usage && (
          <div className="school-stats">
            <p>
              <strong>{view.usage.enrolled}</strong> активирани места
            </p>
            <p>
              <strong>{view.usage.reserved}</strong> резервирани с покани
            </p>
            <p>
              <strong>
                {Math.max(
                  0,
                  (view.license?.seatLimit ?? 0) - view.usage.enrolled - view.usage.reserved,
                )}
              </strong>{" "}
              свободни места
            </p>
          </div>
        )}
        {view.license && view.license.seatLimit < view.license.seats && (
          <p className="notice">
            Предстоящ договор ограничава общия брой активирани и резервирани места до{" "}
            {view.license.seatLimit}.
          </p>
        )}
        {view.energyBudget && (
          <p>
            Общо за училището през текущия период:{" "}
            {view.energyBudget.total - (view.energyBudget.remaining ?? 0)} използвани ·{" "}
            {view.energyBudget.remaining} от {view.energyBudget.total} Energy остават.
          </p>
        )}
        <p className="muted">
          Ученическата Energy се обновява на първо число по UTC, в срока на договора. Няма
          прехвърляне на неизползвана Energy. Общият месечен лимит е броят места по квотата на
          ученик; потреблението на напуснали ученици се включва в него. При включване през месеца
          ученикът получава пълната квота за оставащия период.
        </p>
        {view.cost && (
          <p>
            Оценен AI разход за текущия месец: ${Number(view.cost.estimated).toFixed(4)}
            {view.cost.unknown > 0 ? ` + ${view.cost.unknown} заявки с неизвестен разход` : ""}.
            Включва и анонимизираните записи след изтриване на профили.
          </p>
        )}
      </section>
      {actor.platformAdmin && (
        <section className="content-card">
          <h2>Данни за училището</h2>
          <SchoolForm
            action="school"
            label="Запази училището"
            values={(f) => ({
              id: schoolId,
              name: value(f, "name"),
              contactName: value(f, "contactName"),
              contactEmail: value(f, "contactEmail"),
              status: value(f, "status"),
            })}
          >
            <Field name="name" label="Име" value={school.name} />
            <Field name="contactName" label="Лице за контакт" value={school.contactName} />
            <Field
              name="contactEmail"
              label="Имейл за контакт"
              type="email"
              value={school.contactEmail}
            />
            <label className="field">
              Състояние
              <select name="status" defaultValue={school.status}>
                <option value="active">Активно</option>
                <option value="suspended">Спряно — нови Premium заявки са блокирани</option>
              </select>
            </label>
          </SchoolForm>
        </section>
      )}
      {actor.role === "manager" && (
        <section className="content-card">
          <h2>Договори</h2>
          <div className="lab-grid">
            {view.contracts.map((c) => (
              <article className="lab-mini-card" key={c.id}>
                <h3>{c.reference}</h3>
                <Badge>{c.endsAt <= new Date() ? "Изтекъл" : states[c.status]}</Badge>
                <p>
                  {date(c.startsAt)} – {date(c.endsAt)}
                </p>
                <p>
                  {c.seats} места · {c.monthlyEnergy} Energy на ученик
                </p>
                {actor.platformAdmin && (
                  <SchoolForm
                    action="contract_status"
                    label={c.status === "active" ? "Спри договора" : "Активирай договора"}
                    values={() => ({
                      schoolId,
                      id: c.id,
                      status: c.status === "active" ? "suspended" : "active",
                    })}
                  />
                )}
              </article>
            ))}
          </div>
          {actor.platformAdmin && (
            <details>
              <summary>Добави нов договор</summary>
              <SchoolForm
                action="contract"
                label="Запази договор като чернова"
                values={(f) => ({
                  schoolId,
                  reference: value(f, "reference"),
                  startsAt: `${value(f, "startsAt")}:00Z`,
                  endsAt: `${value(f, "endsAt")}:00Z`,
                  seats: number(f, "seats"),
                  monthlyEnergy: number(f, "monthlyEnergy"),
                })}
              >
                <Field name="reference" label="Номер / референция на договора" />
                <Field name="startsAt" label="Начало (UTC)" type="datetime-local" />
                <Field
                  name="endsAt"
                  label="Край (UTC, без включване на този час)"
                  type="datetime-local"
                />
                <Field
                  name="seats"
                  label="Ученически места"
                  type="number"
                  min={1}
                  max={10000}
                  value={100}
                />
                <Field
                  name="monthlyEnergy"
                  label="Месечна Energy на ученик"
                  type="number"
                  min={1}
                  max={10000}
                  value={200}
                />
              </SchoolForm>
              <p className="muted">
                Активирай след проверка на условията. За подновяване добави следващ период.
                Активните периоди не могат да се застъпват.
              </p>
            </details>
          )}
        </section>
      )}
      {actor.role === "manager" && (
        <section className="content-card">
          <h2>Екип</h2>
          <p>
            Служителят влиза с посочения имейл през <Link href="/school">училищния панел</Link>.
            Раздай връзката лично; платформата не изпраща покани по имейл.
          </p>
          <div className="school-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Имейл</th>
                  <th>Роля</th>
                  <th>Достъп</th>
                </tr>
              </thead>
              <tbody>
                {view.staff.map((m) => (
                  <tr key={m.id}>
                    <td>{m.email}</td>
                    <td>{m.role === "manager" ? "Отговорник" : "Учител"}</td>
                    <td>
                      {actor.platformAdmin || m.role === "teacher" ? (
                        <SchoolForm
                          action="staff"
                          label={m.active ? "Спри достъпа" : "Възстанови"}
                          values={() => ({
                            schoolId,
                            email: m.email,
                            role: m.role,
                            active: m.active ? 0 : 1,
                          })}
                        />
                      ) : m.active ? (
                        "Активен"
                      ) : (
                        "Спрян"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <SchoolForm
            action="staff"
            label="Добави / обнови служител"
            values={(f) => ({ schoolId, email: value(f, "email"), role: value(f, "role") })}
          >
            <Field label="Служебен имейл" name="email" type="email" />
            <label className="field">
              Роля
              <select name="role">
                <option value="teacher">Учител</option>
                {actor.platformAdmin && <option value="manager">Училищен отговорник</option>}
              </select>
            </label>
          </SchoolForm>
        </section>
      )}
      <section className="content-card">
        <h2>Класове</h2>
        <div className="lab-grid">
          {view.classes.map((c) => (
            <article key={c.id} className="lab-mini-card">
              <h3>
                <Link href={`${path}?classId=${c.id}`}>{c.name}</Link>
              </h3>
              {actor.role === "manager" && (
                <details>
                  <summary>Редактирай клас</summary>
                  <SchoolForm
                    action="class"
                    label="Запази класа"
                    values={(f) => ({
                      id: c.id,
                      schoolId,
                      name: value(f, "name"),
                      teacherId: value(f, "teacherId") || null,
                    })}
                  >
                    <Field label="Име на класа" name="name" value={c.name} />
                    <label className="field">
                      Учител
                      <select name="teacherId" defaultValue={c.teacherId ?? ""}>
                        <option value="">Без назначен учител</option>
                        {view.staff
                          .filter((m) => m.active)
                          .map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.email}
                            </option>
                          ))}
                      </select>
                    </label>
                  </SchoolForm>
                </details>
              )}
            </article>
          ))}
        </div>
        {actor.role === "manager" && (
          <SchoolForm
            action="class"
            label="Създай клас"
            values={(f) => ({
              schoolId,
              name: value(f, "name"),
              teacherId: value(f, "teacherId") || null,
            })}
          >
            <Field label="Име на новия клас" name="name" />
            <label className="field">
              Учител
              <select name="teacherId">
                <option value="">Без назначен учител</option>
                {view.staff
                  .filter((m) => m.active)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.email}
                    </option>
                  ))}
              </select>
            </label>
          </SchoolForm>
        )}
      </section>
      <section className="content-card">
        <h2>Покани за ученици</h2>
        <p>
          Всяка покана резервира едно място. Родителят активира кода за избран детски профил в
          „Училище и Energy“.
        </p>
        {view.classes.length > 0 && (
          <SchoolForm
            action="invites"
            label="Генерирай покани"
            values={(f) => ({
              schoolId,
              classId: value(f, "classId"),
              count: number(f, "count"),
              days: number(f, "days"),
              batchId: (pendingBatch.current ??= crypto.randomUUID()),
            })}
            onDone={(v) => {
              setBatch(v as Batch);
              pendingBatch.current = null;
            }}
          >
            <label className="field">
              Клас за поканите
              <select name="classId" defaultValue={view.classId ?? view.classes[0].id}>
                {view.classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <Field label="Брой покани" name="count" type="number" value={1} min={1} max={100} />
            <Field label="Валидност в дни" name="days" type="number" value={7} min={1} max={14} />
          </SchoolForm>
        )}
        {batch && (
          <div className="school-invite-print">
            <h3>Запази кодовете сега</h3>
            <p>
              Кодовете се показват само тук, до напускане на страницата. Валидни до{" "}
              {date(batch.expiresAt)}.
            </p>
            <div className="inline-actions">
              <Button onClick={download}>Изтегли CSV</Button>
              <Button variant="secondary" onClick={() => window.print()}>
                Отпечатай поканите
              </Button>
            </div>
            <div className="lab-grid">
              {batch.invites.map((i) => (
                <article className="school-code-card" key={i.id}>
                  <strong>{school.name}</strong>
                  <p>Влез в родителския си акаунт → Училище и Energy → Активирай покана.</p>
                  <code>{i.code}</code>
                  <p>Един код за едно дете · до {date(batch.expiresAt)}</p>
                </article>
              ))}
            </div>
          </div>
        )}
        <details>
          <summary>Неизползвани покани ({view.inviteTotal})</summary>
          <p>
            При изгубени кодове отмени съответната група и генерирай нови. Вече активираните ученици
            запазват достъпа си.
          </p>
          {[...new Set(view.invites.map((i) => i.batchId))].map((batchId) => (
            <SchoolForm
              key={batchId}
              action="revoke_batch"
              label={`Отмени неизползваните от група ${batchId.slice(0, 8)}`}
              values={() => ({ schoolId, batchId })}
              onDone={() => {
                pendingBatch.current = null;
                setBatch(null);
              }}
            />
          ))}
          {view.invites.map((i) => (
            <div className="school-invite-row" key={i.id}>
              <span>
                {view.classes.find((c) => c.id === i.classId)?.name} · {date(i.expiresAt)} ·{" "}
                {new Date(i.expiresAt) <= new Date() ? "Изтекла" : "Резервира място"} ·{" "}
                {i.id.slice(0, 8)} · група {i.batchId.slice(0, 8)}
              </span>
              <SchoolForm
                action="revoke_invite"
                label="Отмени поканата"
                values={() => ({ schoolId, id: i.id })}
              />
            </div>
          ))}
          <div className="inline-actions">
            {view.invitePage > 1 && (
              <Link href={query(view.page, view.invitePage - 1)}>← Предишни покани</Link>
            )}
            {view.invitePage * 50 < view.inviteTotal && (
              <Link href={query(view.page, view.invitePage + 1)}>Следващи покани →</Link>
            )}
          </div>
        </details>
      </section>
      <section className="content-card">
        <div className="lab-section-heading">
          <h2>Ученици · {view.total}</h2>
          <Link href={path}>Всички мои класове</Link>
        </div>
        <p className="muted">
          Учебен напредък и училищно потребление за текущия месец. Частните разговори, инструкции и
          творби не се показват.
        </p>
        <div className="school-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ученик / клас</th>
                <th>Уроци / XP</th>
                <th>Мисии</th>
                <th>Energy</th>
                <th>Място</th>
              </tr>
            </thead>
            <tbody>
              {view.pupils.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.nickname}</strong>
                    <br />
                    {view.classes.find((c) => c.id === p.classId)?.name}
                  </td>
                  <td>
                    {p.lessons} завършени · {p.xp} XP
                  </td>
                  <td>
                    {p.missions.length ? p.missions.join(", ") : "Все още няма завършени мисии"}
                  </td>
                  <td>{p.energy}</td>
                  <td>
                    <details>
                      <summary>Управление</summary>
                      <SchoolForm
                        action="enrollment"
                        label="Прекрати училищния достъп"
                        values={() => ({ schoolId, id: p.id })}
                      />
                      {actor.role === "manager" && (
                        <SchoolForm
                          action="enrollment"
                          label="Премести"
                          values={(f) => ({ schoolId, id: p.id, classId: value(f, "classId") })}
                        >
                          <label className="field">
                            Нов клас
                            <select name="classId" defaultValue={p.classId}>
                              {view.classes.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </label>
                        </SchoolForm>
                      )}
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!view.pupils.length && <p>Няма активирани ученици в избраните класове.</p>}
        <nav className="inline-actions" aria-label="Страници с ученици">
          {view.page > 1 && <Link href={query(view.page - 1)}>← Предишни</Link>}
          <span>Страница {view.page}</span>
          {view.page * 50 < view.total && <Link href={query(view.page + 1)}>Следващи →</Link>}
        </nav>
      </section>
      {view.audit.length > 0 && (
        <section className="content-card">
          <h2>Последни промени</h2>
          <ul>
            {view.audit.map((a, i) => (
              <li key={i}>
                {date(a.createdAt)} · {actions[a.action] ?? "Промяна в училището"}
                {a.details.count ? ` · ${a.details.count} покани` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
