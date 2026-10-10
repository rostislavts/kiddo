"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUp, ArrowDown, Plus, Trash2, Eye } from "lucide-react";
import { Button } from "./ui/button";
import { postJson } from "@/lib/client-api";
import { bg } from "@/i18n/bg";
import type { worlds, lessons } from "@/db/schema";
import type { LessonContent } from "@/lib/content/schema";
type World = typeof worlds.$inferSelect;
type Lesson = typeof lessons.$inferSelect;
export function WorldForm({
  world,
  tracks,
  worlds: allWorlds,
}: {
  world?: World;
  tracks: { id: string; title: string }[];
  worlds: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        setSaved(false);
        const f = new FormData(e.currentTarget);
        try {
          const result = await postJson<{ id: string }>("/api/admin", {
            action: "world",
            data: {
              id: world?.id,
              title: f.get("title"),
              slug: f.get("slug"),
              description: f.get("description"),
              trackId: f.get("trackId"),
              sortOrder: Number(f.get("sortOrder")),
              xpReward: Number(f.get("xpReward")),
              isFree: true,
              published: f.has("published"),
              sequentialLessons: f.has("sequentialLessons"),
              requiredWorldId: f.get("requiredWorldId") || null,
              visual: f.get("visual"),
              color: f.get("color"),
            },
          });
          setSaved(true);
          if (!world) router.push(`/admin/worlds/${result.id}`);
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : bg.common.error);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="form-row">
        <label className="field">
          {bg.admin.titleLabel}
          <input name="title" defaultValue={world?.title} required maxLength={160} />
        </label>
        <label className="field">
          {bg.admin.slug}
          <input name="slug" defaultValue={world?.slug} required pattern="[a-z0-9]+(-[a-z0-9]+)*" />
        </label>
      </div>
      <label className="field">
        {bg.admin.description}
        <textarea name="description" defaultValue={world?.description} required maxLength={1000} />
      </label>
      <div className="form-row">
        <label className="field">
          {bg.admin.track}
          <select name="trackId" defaultValue={world?.trackId}>
            {tracks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          {bg.admin.requiredWorld}
          <select name="requiredWorldId" defaultValue={world?.requiredWorldId || ""}>
            <option value="">{bg.admin.none}</option>
            {allWorlds
              .filter((w) => w.id !== world?.id)
              .map((w) => (
                <option key={w.id} value={w.id}>
                  {w.title}
                </option>
              ))}
          </select>
        </label>
      </div>
      <div className="form-row">
        <label className="field">
          {bg.admin.order}
          <input
            name="sortOrder"
            type="number"
            min={0}
            max={10000}
            defaultValue={world?.sortOrder ?? 0}
            required
          />
        </label>
        <label className="field">
          {bg.admin.xp}
          <input
            name="xpReward"
            type="number"
            min={0}
            max={10000}
            defaultValue={world?.xpReward ?? 100}
            required
          />
        </label>
      </div>
      <div className="form-row">
        <label className="field">
          {bg.admin.visual}
          <select name="visual" defaultValue={world?.visual ?? "robot"}>
            {["robot", "brain", "data", "detective", "shield", "sparkles"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label className="field">
          {bg.admin.color}
          <select name="color" defaultValue={world?.color ?? "violet"}>
            {["violet", "mint", "peach", "blue", "yellow", "pink"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="checkbox-field">
        <input name="isFree" type="checkbox" checked disabled />
        {bg.admin.free}
      </label>
      <label className="checkbox-field">
        <input
          name="sequentialLessons"
          type="checkbox"
          defaultChecked={world?.sequentialLessons ?? true}
        />
        {bg.admin.sequential}
      </label>
      <label className="checkbox-field">
        <input name="published" type="checkbox" defaultChecked={world?.published} />
        {bg.admin.published}
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {saved && (
        <p className="form-success" role="status">
          {bg.common.saved}
        </p>
      )}
      <Button disabled={busy}>{bg.admin.save}</Button>
    </form>
  );
}
function JsonList({
  title,
  items,
  setItems,
  template,
}: {
  title: string;
  items: string[];
  setItems: (items: string[]) => void;
  template: string;
}) {
  return (
    <section>
      <div className="section-heading">
        <h3>{title}</h3>
        <Button
          variant="secondary"
          size="small"
          type="button"
          onClick={() => {
            const value = JSON.parse(template);
            value.id = `item-${crypto.randomUUID().slice(0, 8)}`;
            setItems([...items, JSON.stringify(value, null, 2)]);
          }}
        >
          <Plus size={15} />
          {bg.common.edit}
        </Button>
      </div>
      {items.map((item, index) => (
        <details className="content-card" key={index} open={items.length === 1}>
          <summary>
            {title} {index + 1}
          </summary>
          <div className="inline-actions" style={{ margin: "15px 0" }}>
            <Button
              type="button"
              size="small"
              variant="secondary"
              disabled={index === 0}
              aria-label={bg.player.up}
              onClick={() => {
                const next = [...items];
                [next[index], next[index - 1]] = [next[index - 1], next[index]];
                setItems(next);
              }}
            >
              <ArrowUp size={16} />
            </Button>
            <Button
              type="button"
              size="small"
              variant="secondary"
              disabled={index === items.length - 1}
              aria-label={bg.player.down}
              onClick={() => {
                const next = [...items];
                [next[index], next[index + 1]] = [next[index + 1], next[index]];
                setItems(next);
              }}
            >
              <ArrowDown size={16} />
            </Button>
            <Button
              type="button"
              size="small"
              variant="danger"
              aria-label={bg.common.delete}
              onClick={() => setItems(items.filter((_, i) => i !== index))}
            >
              <Trash2 size={16} />
            </Button>
          </div>
          <textarea
            className="code-editor"
            aria-label={`${title} ${index + 1} JSON`}
            value={item}
            spellCheck={false}
            onChange={(e) =>
              setItems(items.map((value, i) => (i === index ? e.target.value : value)))
            }
          />
        </details>
      ))}
    </section>
  );
}
export function LessonForm({
  lesson,
  content,
  worldId,
}: {
  lesson?: Lesson;
  content: LessonContent;
  worldId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [blocks, setBlocks] = useState(content.blocks.map((b) => JSON.stringify(b, null, 2)));
  const [questions, setQuestions] = useState(
    content.questions.map((q) => JSON.stringify(q, null, 2)),
  );
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        setSaved(false);
        const f = new FormData(e.currentTarget);
        try {
          const result = await postJson<{ id: string }>("/api/admin", {
            action: "lesson",
            data: {
              id: lesson?.id,
              expectedVersion: lesson?.contentVersion,
              worldId,
              title: f.get("title"),
              slug: f.get("slug"),
              description: f.get("description"),
              sortOrder: Number(f.get("sortOrder")),
              estimatedMinutes: Number(f.get("estimatedMinutes")),
              xpReward: Number(f.get("xpReward")),
              published: f.has("published"),
              content: {
                locale: "bg-BG",
                blocks: blocks.map((b) => JSON.parse(b)),
                questions: questions.map((q) => JSON.parse(q)),
              },
            },
          });
          setSaved(true);
          if (!lesson) router.push(`/admin/lessons/${result.id}`);
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : bg.common.error);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="form-row">
        <label className="field">
          {bg.admin.titleLabel}
          <input name="title" defaultValue={lesson?.title} required maxLength={160} />
        </label>
        <label className="field">
          {bg.admin.slug}
          <input
            name="slug"
            defaultValue={lesson?.slug}
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
          />
        </label>
      </div>
      <label className="field">
        {bg.admin.description}
        <textarea name="description" defaultValue={lesson?.description} required maxLength={1000} />
      </label>
      <div className="three-columns">
        <label className="field">
          {bg.admin.order}
          <input
            name="sortOrder"
            type="number"
            min={0}
            max={10000}
            defaultValue={lesson?.sortOrder ?? 0}
            required
          />
        </label>
        <label className="field">
          {bg.admin.minutes}
          <input
            name="estimatedMinutes"
            type="number"
            min={1}
            max={60}
            defaultValue={lesson?.estimatedMinutes ?? 7}
            required
          />
        </label>
        <label className="field">
          {bg.admin.xp}
          <input
            name="xpReward"
            type="number"
            min={0}
            max={10000}
            defaultValue={lesson?.xpReward ?? 50}
            required
          />
        </label>
      </div>
      <label className="checkbox-field">
        <input name="published" type="checkbox" defaultChecked={lesson?.published ?? false} />
        {bg.admin.published}
      </label>
      <p className="notice">{bg.admin.contentHelp}</p>
      <JsonList
        title="Блок"
        items={blocks}
        setItems={setBlocks}
        template={JSON.stringify(content.blocks[0])}
      />
      <JsonList
        title="Въпрос"
        items={questions}
        setItems={setQuestions}
        template={JSON.stringify(content.questions[0])}
      />
      {error && (
        <p className="form-error" role="alert" style={{ whiteSpace: "pre-wrap" }}>
          {error}
        </p>
      )}
      {saved && (
        <p className="form-success" role="status">
          {bg.common.saved}
        </p>
      )}
      <div className="inline-actions">
        <Button disabled={busy}>{bg.admin.save}</Button>
        {lesson && (
          <Button asChild variant="secondary">
            <Link href={`/admin/lessons/${lesson.id}/preview`}>
              <Eye size={17} />
              {bg.admin.preview}
            </Link>
          </Button>
        )}
      </div>
    </form>
  );
}
