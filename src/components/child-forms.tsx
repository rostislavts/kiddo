"use client";
import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Plus } from "lucide-react";
import { Button } from "./ui/button";
import { bg, avatars, avatarLabels, type AvatarKey } from "@/i18n/bg";
import { postJson } from "@/lib/client-api";
type Child = { id: string; nickname: string; avatar: string; ageBand: string | null };
export function ChildForm({
  child,
  needsConsent = false,
}: {
  child?: Child;
  needsConsent?: boolean;
}) {
  const helpId = useId();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const requestId = useRef<string | null>(null);
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const data = new FormData(form);
        setBusy(true);
        setError("");
        setSuccess(false);
        requestId.current ??= crypto.randomUUID();
        try {
          await postJson("/api/account", {
            action: child ? "update_child" : "create_child",
            ...(child ? { id: child.id } : { requestId: requestId.current }),
            nickname: data.get("nickname"),
            avatar: data.get("avatar"),
            ageBand: data.get("ageBand"),
            ...(!child ? { guardianConsent: data.get("guardianConsent") === "on" } : {}),
          });
          setSuccess(true);
          router.refresh();
          if (!child) {
            form.reset();
            requestId.current = null;
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : bg.common.error);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="field">
        {bg.children.nickname}
        <input
          name="nickname"
          aria-label={bg.children.nickname}
          aria-describedby={helpId}
          defaultValue={child?.nickname}
          placeholder={bg.children.nicknamePlaceholder}
          minLength={2}
          maxLength={24}
          required
        />
        <small id={helpId}>{bg.children.nicknameHelp}</small>
      </label>
      <fieldset>
        <legend className="field" style={{ marginBottom: 10 }}>
          {bg.children.avatar}
        </legend>
        <div className="avatar-options">
          {Object.entries(avatars).map(([key, icon]) => (
            <label key={key} className="avatar-option">
              <input
                type="radio"
                name="avatar"
                value={key}
                defaultChecked={(child?.avatar || "robot") === key}
                aria-label={avatarLabels[key as AvatarKey]}
              />
              <span>{icon}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="field">
        {bg.children.age}
        <select name="ageBand" defaultValue={child?.ageBand || ""}>
          <option value="">{bg.children.noAge}</option>
          <option value="8-9">8–9</option>
          <option value="10-11">10–11</option>
        </select>
      </label>
      {needsConsent && !child && (
        <label className="checkbox-field">
          <input type="checkbox" name="guardianConsent" required />
          <span>
            Аз съм родител или настойник на това дете и приемам условията за родителски акаунт.
          </span>
        </label>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="form-success">
          {bg.common.saved}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {child ? bg.common.save : bg.children.create}
        {!child && <Plus size={17} />}
      </Button>
    </form>
  );
}
export function SelectChild({ id, label = bg.children.start }: { id: string; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <Button
        disabled={busy}
        aria-busy={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await postJson("/api/account", { action: "select_child", id });
            // The API sets a profile cookie. Start one fresh navigation so cached
            // dashboard data from the previous child cannot be reused.
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- Profile changes deliberately reset the entire client router cache.
            window.location.assign("/app");
          } catch (err) {
            setError(err instanceof Error ? err.message : bg.common.error);
            setBusy(false);
          }
        }}
      >
        {busy ? bg.common.loading : label}
        <ArrowRight size={16} />
      </Button>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
export function DeleteChild({ child }: { child: Child }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <details className="section-gap">
      <summary className="text-link">{bg.children.deleteTitle}</summary>
      <form
        className="form-stack section-gap"
        onSubmit={async (e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          setBusy(true);
          setError("");
          try {
            await postJson("/api/account", {
              action: "delete_child",
              id: child.id,
              confirmation: data.get("confirmation"),
            });
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : bg.common.error);
          } finally {
            setBusy(false);
          }
        }}
      >
        <p className="tiny-copy">{bg.children.deleteHelp}</p>
        <label className="field">
          {bg.children.confirm}
          <input name="confirmation" required autoComplete="off" placeholder={child.nickname} />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <Button disabled={busy} variant="danger">
          {bg.common.delete}
        </Button>
      </form>
    </details>
  );
}
export function DeleteAccount() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        setError("");
        setBusy(true);
        try {
          await postJson("/api/account", {
            action: "delete_account",
            confirmation: data.get("confirmation"),
            password: data.get("password"),
          });
          router.replace("/");
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : bg.common.error);
          setBusy(false);
        }
      }}
    >
      <p className="tiny-copy">{bg.parent.deleteDescription}</p>
      <label className="field">
        {bg.parent.deleteConfirm}
        <input name="confirmation" required pattern="ИЗТРИЙ" autoComplete="off" />
      </label>
      <label className="field">
        {bg.parent.passwordConfirm}
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={8}
        />
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Button disabled={busy} variant="danger">
        {bg.parent.deleteAccount}
      </Button>
    </form>
  );
}
