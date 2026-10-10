"use client";
import Link from "next/link";
import { SchoolForm, Field, value } from "./forms";
export function SchoolCreator() {
  return (
    <section className="content-card">
      <h2>Добави училище</h2>
      <SchoolForm
        action="school"
        label="Създай училище"
        values={(f) => ({
          name: value(f, "name"),
          contactName: value(f, "contactName"),
          contactEmail: value(f, "contactEmail"),
        })}
      >
        <Field name="name" label="Име на училището" />
        <Field name="contactName" label="Лице за контакт" />
        <Field name="contactEmail" label="Имейл за контакт" type="email" />
      </SchoolForm>
      <p className="muted">
        След създаване добави договор и училищен отговорник. Договарянето и плащането се извършват
        извън платформата.
      </p>
      <Link href="/school">Училищен панел →</Link>
    </section>
  );
}
