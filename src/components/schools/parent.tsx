"use client";
import Link from "next/link";
import type { parentSchoolView } from "@/lib/schools/view";
import { SchoolForm, Field, value } from "./forms";
import { EnergyMeter } from "@/components/lab/overview";
export function ParentSchool({
  profiles,
}: {
  profiles: Awaited<ReturnType<typeof parentSchoolView>>;
}) {
  return (
    <>
      {profiles.length ? (
        <section className="content-card">
          <h2>Активирай училищна покана</h2>
          <SchoolForm
            action="redeem"
            label="Активирай Premium за детето"
            values={(f) => ({ childId: value(f, "childId"), code: value(f, "code") })}
          >
            <label className="field">
              Детски профил
              <select name="childId">
                {profiles.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.nickname}
                  </option>
                ))}
              </select>
            </label>
            <Field label="Код от училището" name="code" />
          </SchoolForm>
          <p className="muted">
            Свързването позволява на училището да вижда учебния напредък и общата активност на това
            дете. Частните разговори и prompts не се споделят.
          </p>
        </section>
      ) : (
        <p className="notice">
          Първо <Link href="/parent/children">създай детски профил</Link>, след което активирай
          поканата за него.
        </p>
      )}
      {profiles.map((p) => (
        <section key={p.id} className="content-card">
          <h2>{p.nickname}</h2>
          <p>{p.school ? `${p.school.name} · ${p.school.className}` : "Няма връзка с училище"}</p>
          <EnergyMeter energy={p.energy} />
          <p>
            {p.energy.premium
              ? "Premium достъпът е активен."
              : "В момента няма активен Premium достъп. Академията остава безплатна."}
          </p>
          <p>
            Семеен абонамент: {p.energy.familyAvailable ? "активен" : "няма активен"}. Училищен
            лиценз: {p.energy.schoolAvailable ? "активен" : "няма активен"}.
          </p>
          <p className="muted">
            При изчерпване на училищната Energy не използваме автоматично семейния бюджет. Изборът
            по-долу се потвърждава с родителската парола. При изтичане на избрания достъп се
            използва другият, ако е активен.
          </p>
          <SchoolForm
            action="funding"
            label="Запази избора на бюджет"
            values={(f) => ({
              childId: p.id,
              preference: value(f, "preference"),
              password: value(f, "password"),
            })}
          >
            <label className="field">
              Предпочитан бюджет
              <select name="preference" defaultValue={p.preference}>
                <option value="auto">Училищен, когато има активен лиценз</option>
                <option value="family" disabled={!p.energy.familyAvailable}>
                  Семеен
                </option>
              </select>
            </label>
            <Field label="Родителска парола" name="password" type="password" />
          </SchoolForm>
          {p.school && (
            <details>
              <summary>Прекрати връзката с училището</summary>
              <p>Училищният достъп ще спре. Напредъкът и творбите остават запазени.</p>
              <SchoolForm
                action="leave"
                label="Прекрати връзката"
                values={(f) => ({ childId: p.id, password: value(f, "password") })}
              >
                <Field label="Потвърди с родителската парола" name="password" type="password" />
              </SchoolForm>
            </details>
          )}
        </section>
      ))}
      <p>
        <Link href="/parent/billing">Управление на семейния абонамент →</Link>
      </p>
    </>
  );
}
