"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CloudCheck,
  Lightbulb,
  Trophy,
  X,
  Zap,
} from "lucide-react";
import type { LessonSession, QuizResult } from "@/lib/learning/service";
import {
  publicBlocks,
  publicQuestion,
  type Answer,
  type LessonContent,
} from "@/lib/content/schema";
import { isCorrect, mastery, quizPercentage } from "@/lib/quiz/scoring";
import { postJson } from "@/lib/client-api";
import { bg } from "@/i18n/bg";
import { Button } from "@/components/ui/button";
import { ProgressBar, Badge } from "@/components/ui/primitives";
import { WorldArt } from "@/components/illustration";
import { QuestionInput } from "./question-input";
import { cn } from "@/lib/utils";

type Feedback = { isCorrect: boolean; explanation: string; xpAwarded?: number };
type SavedAnswer = LessonSession["answers"][number];
export function LessonPlayer({
  childId,
  lessonId,
  title,
  worldSlug,
  preview,
}: {
  childId?: string;
  lessonId: string;
  title: string;
  worldSlug: string;
  preview?: LessonContent;
}) {
  const [session, setSession] = useState<LessonSession | null>(null);
  const [step, setStep] = useState(0);
  const [quiz, setQuiz] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [attempt, setAttempt] = useState<{ id: string; number: number } | null>(null);
  const [answers, setAnswers] = useState<SavedAnswer[]>([]);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<QuizResult | null>(null);
  const load = useCallback(
    async (): Promise<LessonSession> =>
      preview
        ? {
            lesson: { id: lessonId, title, xpReward: 0 },
            version: 1,
            currentStep: 0,
            completed: false,
            bestScore: 0,
            blocks: publicBlocks(preview.blocks),
            questions: preview.questions.map(publicQuestion),
            attempt: null,
            answers: [],
          }
        : postJson("/api/learning", { action: "start", childId, lessonId }),
    [childId, lessonId, title, preview],
  );
  const receiveSession = useCallback((data: LessonSession) => {
    setError("");
    setSession(data);
    setStep(data.currentStep);
    setAttempt(data.attempt);
    setAnswers(data.answers);
    setQuiz(!!data.attempt);
    setQuestionIndex(data.answers.length);
  }, []);
  const loadFailed = useCallback(
    (err: unknown) => setError(err instanceof Error ? err.message : bg.common.offline),
    [],
  );
  useEffect(() => {
    let alive = true;
    void load()
      .then((data) => {
        if (alive) receiveSession(data);
      })
      .catch((err: unknown) => {
        if (alive) loadFailed(err);
      });
    return () => {
      alive = false;
    };
  }, [load, receiveSession, loadFailed]);
  async function perform(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : bg.common.offline);
    } finally {
      setBusy(false);
    }
  }
  async function nextStep(answer?: Answer) {
    if (!session) return;
    await perform(async () => {
      const block = session.blocks[step];
      let nextFeedback: Feedback | null = null;
      if (preview) {
        const original = preview.blocks[step];
        if ("question" in original && answer)
          nextFeedback = {
            isCorrect: isCorrect(original.question, answer),
            explanation: original.question.explanation,
          };
      } else {
        const data = await postJson<{ feedback: Feedback | null }>("/api/learning", {
          action: "step",
          childId,
          lessonId,
          step,
          version: session.version,
          answer,
        });
        nextFeedback = data.feedback;
      }
      if ("question" in block) setFeedback(nextFeedback);
      else {
        setStep(step + 1);
        setFeedback(null);
      }
    });
  }
  async function beginQuiz() {
    await perform(async () => {
      const data = preview
        ? { id: "preview", number: 1 }
        : await postJson<{ id: string; number: number }>("/api/learning", {
            action: "quiz",
            childId,
            lessonId,
          });
      setAttempt(data);
      setQuiz(true);
      setQuestionIndex(0);
      setAnswers([]);
      setFeedback(null);
      setResult(null);
    });
  }
  async function answerQuiz(answer: Answer) {
    if (!session || !attempt) return;
    await perform(async () => {
      const q = session.questions[questionIndex];
      const original = preview?.questions[questionIndex];
      const data: SavedAnswer = original
        ? {
            questionId: q.id,
            answer,
            isCorrect: isCorrect(original, answer),
            explanation: original.explanation,
            xpAwarded: 0,
          }
        : await postJson("/api/learning", {
            action: "answer",
            childId,
            attemptId: attempt.id,
            questionId: q.id,
            answer,
          });
      setAnswers((old) => [...old.filter((a) => a.questionId !== q.id), data]);
      setFeedback(data);
    });
  }
  async function finish() {
    if (!attempt || !session) return;
    await perform(async () => {
      const percentage = quizPercentage(
        answers.filter((a) => a.isCorrect).length,
        session.questions.length,
      );
      const data: QuizResult = preview
        ? {
            percentage,
            result: mastery(percentage),
            score: answers.filter((a) => a.isCorrect).length,
            total: session.questions.length,
            xpAwarded: 0,
            totalXp: 0,
            newAchievements: [],
            worldSlug,
          }
        : await postJson("/api/learning", { action: "finish", childId, attemptId: attempt.id });
      setResult(data);
      setFeedback(null);
    });
  }
  const exitHref = preview ? `/admin/lessons/${lessonId}` : `/app/world/${worldSlug}`;
  const progress = session
    ? result
      ? 100
      : ((quiz ? session.blocks.length + questionIndex : step) /
          (session.blocks.length + session.questions.length)) *
        100
    : 0;
  const block = session?.blocks[step];
  const q = session?.questions[questionIndex];
  return (
    <div className="player-shell" id={preview ? undefined : "main"}>
      <header className="player-header">
        <Link href={exitHref} className="icon-button" aria-label={bg.player.exit}>
          <X size={20} />
        </Link>
        <ProgressBar value={progress} label={title} />
        <span>
          {quiz ? bg.player.question : bg.player.step}{" "}
          {session
            ? Math.min(
                (quiz ? questionIndex : step) + 1,
                quiz ? session.questions.length : session.blocks.length,
              )
            : 0}{" "}
          / {session ? (quiz ? session.questions.length : session.blocks.length) : "…"}
        </span>
      </header>
      {preview && (
        <p className="notice" style={{ marginBottom: 25 }}>
          {bg.player.preview}
        </p>
      )}
      {error && (
        <div className="form-error" role="alert" style={{ marginBottom: 24 }}>
          {error}
          {!session && (
            <Button
              variant="ghost"
              onClick={() => void load().then(receiveSession).catch(loadFailed)}
            >
              {bg.common.retry}
            </Button>
          )}
        </div>
      )}
      {!session && !error ? (
        <div className="empty-state">
          <WorldArt visual="robot" />
          <p>{bg.player.loading}</p>
        </div>
      ) : result ? (
        <div className="quiz-result">
          <div className="result-medal">
            <Trophy size={58} />
          </div>
          <h1>{result.result === "retry" ? bg.player.retryTitle : bg.player.resultTitle}</h1>
          <p>
            {result.result === "mastered"
              ? bg.player.mastered
              : result.result === "completed"
                ? bg.player.completed
                : bg.player.retryText}
          </p>
          <div className="result-stats">
            <div className="result-stat">
              <strong>{result.percentage}%</strong>
              <span>
                {result.score}/{result.total} {bg.player.rightAnswers}
              </span>
            </div>
            <div className="result-stat">
              <strong>{result.totalXp} XP</strong>
              <span>{bg.player.totalXp}</span>
            </div>
          </div>
          {result.newAchievements.length > 0 && (
            <div className="notice">
              <strong>{bg.player.newBadges}</strong>
              <div className="inline-actions" style={{ justifyContent: "center", marginTop: 10 }}>
                {result.newAchievements.map((a) => (
                  <Badge key={a}>{a}</Badge>
                ))}
              </div>
            </div>
          )}
          <div className="result-actions">
            <Button asChild>
              <Link href={exitHref}>
                {bg.player.backWorld}
                <ArrowRight size={17} />
              </Link>
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => void beginQuiz()}>
              {bg.player.replay}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setQuiz(false);
                setResult(null);
                setStep(0);
                setFeedback(null);
              }}
            >
              {bg.player.readAgain}
            </Button>
          </div>
        </div>
      ) : (
        session && (
          <div className="lesson-player">
            <p className="eyebrow">{title}</p>
            {quiz ? (
              q ? (
                <>
                  <h1>{q.prompt}</h1>
                  <QuestionInput
                    key={`${attempt?.id}-${q.id}`}
                    question={q}
                    onSubmit={(a) => void answerQuiz(a)}
                    busy={busy}
                    submitted={!!feedback}
                    savedAnswer={answers.find((a) => a.questionId === q.id)?.answer}
                  />
                </>
              ) : (
                <>
                  <h1>{bg.player.finish}</h1>
                  <p className="muted">{bg.player.saved}</p>
                  <Button className="section-gap" disabled={busy} onClick={() => void finish()}>
                    {bg.player.finish}
                    <Trophy size={18} />
                  </Button>
                </>
              )
            ) : block ? (
              <>
                {!("question" in block) && (
                  <WorldArt
                    visual={"visual" in block ? block.visual : "sparkles"}
                    color={block.type === "callout" ? "yellow" : "violet"}
                  />
                )}
                <h1>{"question" in block ? block.question.prompt : block.title}</h1>
                {"question" in block ? (
                  <QuestionInput
                    key={`block-${step}`}
                    question={block.question}
                    onSubmit={(a) => void nextStep(a)}
                    busy={busy}
                    submitted={!!feedback}
                  />
                ) : (
                  <p className={cn("prose-block", block.type)}>{block.body}</p>
                )}
              </>
            ) : (
              <>
                <WorldArt visual="sparkles" />
                <h1>{bg.player.startQuiz}</h1>
                {session.completed && <p className="notice">{bg.player.completedBefore}</p>}
                <div className="result-actions">
                  <Button disabled={busy} onClick={() => void beginQuiz()}>
                    {bg.player.startQuiz}
                    <ArrowRight size={17} />
                  </Button>
                  <Button variant="ghost" onClick={() => setStep(0)}>
                    {bg.player.readAgain}
                  </Button>
                </div>
              </>
            )}
            {feedback && (
              <div className={cn("feedback", !feedback.isCorrect && "incorrect")} role="status">
                <strong>
                  {feedback.isCorrect ? <CheckCircle2 size={21} /> : <Lightbulb size={21} />}
                  {feedback.isCorrect ? bg.player.correct : bg.player.incorrect}
                  {!!feedback.xpAwarded && (
                    <Badge>
                      <Zap size={12} />+{feedback.xpAwarded} XP
                    </Badge>
                  )}
                </strong>
                <p>{feedback.explanation}</p>
              </div>
            )}
            {((block && !quiz) || feedback) && (
              <footer className="player-footer">
                <span>
                  <CloudCheck size={16} />
                  {bg.player.saved}
                </span>
                <div className="inline-actions">
                  {!quiz && step > 0 && !feedback && (
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() => {
                        setStep(step - 1);
                        setFeedback(null);
                      }}
                    >
                      <ArrowLeft size={16} />
                      {bg.common.back}
                    </Button>
                  )}
                  {feedback ? (
                    <Button
                      disabled={busy}
                      onClick={() => {
                        if (quiz && questionIndex === session.questions.length - 1) void finish();
                        else {
                          if (quiz) setQuestionIndex(questionIndex + 1);
                          else setStep(step + 1);
                          setFeedback(null);
                        }
                      }}
                    >
                      {quiz
                        ? questionIndex === session.questions.length - 1
                          ? bg.player.finish
                          : bg.player.next
                        : bg.common.continue}
                      <ArrowRight size={18} />
                    </Button>
                  ) : (
                    block &&
                    !("question" in block) && (
                      <Button disabled={busy} onClick={() => void nextStep()}>
                        {bg.common.continue}
                        <ArrowRight size={18} />
                      </Button>
                    )
                  )}
                </div>
              </footer>
            )}
          </div>
        )
      )}
    </div>
  );
}
