"use client";
import { useState } from "react";
import { ArrowDown, ArrowUp, Check, Lightbulb } from "lucide-react";
import type { Answer, PublicQuestion } from "@/lib/content/schema";
import { bg } from "@/i18n/bg";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function QuestionInput({
  question,
  onSubmit,
  busy,
  submitted = false,
  savedAnswer,
}: {
  question: PublicQuestion;
  onSubmit: (answer: Answer) => void;
  busy: boolean;
  submitted?: boolean;
  savedAnswer?: Answer;
}) {
  const [answer, setAnswer] = useState<Answer>(
    savedAnswer ??
      (question.type === "ordering"
        ? question.options.map((o) => o.id)
        : question.type === "categorization"
          ? {}
          : []),
  );
  const disabled = submitted || busy;
  const ready =
    question.type === "categorization"
      ? Object.keys(answer).length === question.options.length
      : Object.keys(answer).length > 0;
  function move(index: number, delta: number) {
    if (!Array.isArray(answer)) return;
    const next = [...answer];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    setAnswer(next);
  }
  return (
    <div className="question-input">
      {question.context && <p className="question-context">{question.context}</p>}
      {question.type === "multiple_choice" && <p className="tiny-copy">{bg.player.selectMany}</p>}
      {question.type === "ordering" ? (
        <>
          <p className="tiny-copy">{bg.player.order}</p>
          <div className="answer-list">
            {(answer as string[]).map((id, i) => (
              <div className="ordering-item" key={id}>
                <span className="answer-letter">{i + 1}</span>
                <span>{question.options.find((o) => o.id === id)?.label}</span>
                <div className="ordering-controls">
                  <button
                    aria-label={`${bg.player.up}: ${question.options.find((o) => o.id === id)?.label}`}
                    className="icon-button"
                    disabled={disabled || i === 0}
                    onClick={() => move(i, -1)}
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    aria-label={`${bg.player.down}: ${question.options.find((o) => o.id === id)?.label}`}
                    className="icon-button"
                    disabled={disabled || i === question.options.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDown size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : question.type === "categorization" ? (
        <>
          <p className="tiny-copy">{bg.player.categorize}</p>
          <div className="answer-list">
            {question.options.map((o) => (
              <label key={o.id} className="categorize-item">
                <span>{o.label}</span>
                <select
                  disabled={disabled}
                  value={(answer as Record<string, string>)[o.id] || ""}
                  onChange={(e) => {
                    const next = { ...(answer as Record<string, string>) };
                    if (e.target.value) next[o.id] = e.target.value;
                    else delete next[o.id];
                    setAnswer(next);
                  }}
                >
                  <option value="">{bg.player.category}</option>
                  {question.categories?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </>
      ) : (
        <div className="answer-list" role="group" aria-label={question.prompt}>
          {question.options.map((option, i) => {
            const selected = Array.isArray(answer) && answer.includes(option.id);
            return (
              <button
                key={option.id}
                data-testid={`option-${option.id}`}
                className={cn("answer-option", selected && "selected")}
                aria-pressed={selected}
                disabled={disabled}
                onClick={() =>
                  setAnswer(
                    question.type === "multiple_choice"
                      ? selected
                        ? (answer as string[]).filter((id) => id !== option.id)
                        : [...(answer as string[]), option.id]
                      : [option.id],
                  )
                }
              >
                <span className="answer-letter">
                  {selected ? <Check size={16} /> : String.fromCharCode(1040 + i)}
                </span>
                {option.label}
              </button>
            );
          })}
        </div>
      )}
      <details className="hint-box">
        <summary>
          <Lightbulb size={16} />
          {bg.player.hint}
        </summary>
        <p>{question.hint}</p>
      </details>
      {!submitted && (
        <Button disabled={busy || !ready} onClick={() => onSubmit(answer)}>
          {busy ? bg.common.saving : bg.player.check}
          <Check size={17} />
        </Button>
      )}
    </div>
  );
}
