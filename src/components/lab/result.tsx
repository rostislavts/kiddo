"use client";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { toolLabels } from "./builders";
type RecordValue = Record<string, unknown>;
function records(value: unknown): RecordValue[] {
  return Array.isArray(value)
    ? value.filter((x): x is RecordValue => !!x && typeof x === "object")
    : [];
}
export function LabResult({
  result,
  onChoice,
  disabled,
}: {
  result: RecordValue;
  onChoice?: (choice: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="lab-result">
      {typeof result.assetId === "string" && (
        <>
          <Image
            unoptimized
            width={1024}
            height={1024}
            className="lab-generated"
            src={`/api/lab/assets/${result.assetId}`}
            alt="Твоето генерирано изображение"
          />
          <p className="muted">
            Изображението е лично. Съхранява се до{" "}
            {new Date(String(result.assetExpiresAt)).toLocaleDateString("bg-BG")}.
          </p>
        </>
      )}
      {typeof result.text === "string" && <p className="lab-output">{result.text}</p>}
      {typeof result.explanation === "string" && <p>{result.explanation}</p>}
      {typeof result.passed === "boolean" && (
        <p className={result.passed ? "success-message" : "notice"}>
          {result.passed ? "✓ Успя!" : "Опитай да подобриш решението."}
        </p>
      )}
      {typeof result.fact === "string" && result.fact && (
        <aside className="notice">
          <strong>Проверен факт</strong>
          <p>{result.fact}</p>
          {typeof result.source === "string" && /^https:\/\//.test(result.source) && (
            <a href={result.source} target="_blank" rel="noreferrer">
              Проверен източник ↗
            </a>
          )}
        </aside>
      )}
      {typeof result.assessmentNote === "string" && (
        <p className="muted">{result.assessmentNote}</p>
      )}
      {typeof result.actualPrompt === "string" && (
        <details>
          <summary>Виж действителната инструкция</summary>
          <pre className="lab-output">{result.actualPrompt}</pre>
        </details>
      )}
      {Array.isArray(result.evaluation) && (
        <ul className="lab-evaluation">
          {records(result.evaluation).map((v, i) => (
            <li key={i}>
              <strong>
                {v.passed ? "✓" : "○"} {String(v.label)}
              </strong>
              <span>{String(v.detail)}</span>
            </li>
          ))}
        </ul>
      )}
      {Array.isArray(result.steps) && (
        <>
          <h3>Действия на агента</h3>
          <ol className="lab-trace">
            {records(result.steps).map((v, i) => (
              <li key={i}>
                <strong>{toolLabels[String(v.tool)] ?? String(v.tool)}</strong>
                <p>{String(v.result)}</p>
              </li>
            ))}
          </ol>
        </>
      )}
      {Array.isArray(result.knowledge) && (
        <details open>
          <summary>Кое знание използва AI?</summary>
          <p className="muted">Въпрос → търсене → избрани карти → отговор</p>
          {records(result.knowledge).map((v) => (
            <blockquote key={String(v.id)}>
              <strong>{String(v.title)}</strong>
              <p>{String(v.excerpt)}</p>
            </blockquote>
          ))}
          {!result.knowledge.length && (
            <p>Не е намерена подходяща карта. Добави знание и опитай пак.</p>
          )}
        </details>
      )}
      {Array.isArray(result.knownFacts) && (
        <aside className="notice">
          <h3>Сравни с известните факти</h3>
          <ul>
            {result.knownFacts.map((fact, i) => (
              <li key={i}>{String(fact)}</li>
            ))}
          </ul>
          <p>AI може да греши. Забеляза ли пропуснат детайл?</p>
        </aside>
      )}
      {result.visualFeedback && typeof result.visualFeedback === "object" ? (
        <p className="notice">
          Визуална обратна връзка: {String((result.visualFeedback as RecordValue).summary)}{" "}
          {String(result.validationNote ?? "")}
        </p>
      ) : null}
      {typeof result.turn === "number" && (
        <p>
          Ход {result.turn} от {String(result.maxTurns)} ·{" "}
          {result.missionStatus === "completed" ? "Приключението завърши!" : "Какво избираш?"}
        </p>
      )}
      {onChoice && Array.isArray(result.choices) && (
        <div className="lab-actions">
          {result.choices.map((choice, i) => (
            <Button
              key={i}
              variant="secondary"
              disabled={disabled}
              onClick={() => onChoice(String(choice))}
            >
              {String(choice)}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
