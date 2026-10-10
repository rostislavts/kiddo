"use client";
import { useState, type ReactNode, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/client-api";
import { Button } from "@/components/ui/button";
export function SchoolForm({
  action,
  values,
  children,
  label,
  onDone,
}: {
  action: string;
  values: (form: FormData) => Record<string, unknown>;
  children?: ReactNode;
  label: string;
  onDone?: (value: unknown) => void;
}) {
  const router = useRouter(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setError("");
    setSuccess(false);
    try {
      const result = await postJson("/api/schools", { action, data: values(new FormData(form)) });
      onDone?.(result);
      setSuccess(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Неуспешен запис.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="form-stack school-form" onSubmit={submit}>
      {children}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="form-success">
          Готово. Промяната е запазена.
        </p>
      )}
      <Button disabled={busy} type="submit">
        {busy ? "Запазваме…" : label}
      </Button>
    </form>
  );
}
export function Field({
  label,
  name,
  type = "text",
  value,
  required = true,
  min,
  max,
}: {
  label: string;
  name: string;
  type?: string;
  value?: string | number;
  required?: boolean;
  min?: number;
  max?: number;
}) {
  return (
    <label className="field">
      {label}
      <input
        name={name}
        type={type}
        defaultValue={value}
        required={required}
        min={min}
        max={max}
        maxLength={type === "email" ? 254 : type === "password" ? 128 : 120}
      />
    </label>
  );
}
export const value = (form: FormData, key: string) => String(form.get(key) || "");
export const number = (form: FormData, key: string) => Number(form.get(key));
