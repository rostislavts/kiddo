import type { Answer, Question } from "@/lib/content/schema";

export function isCorrect(question: Question, answer: Answer): boolean {
  if (question.type === "categorization") {
    if (Array.isArray(answer) || Array.isArray(question.correct)) return false;
    return (
      Object.keys(answer).length === question.options.length &&
      Object.entries(question.correct).every(([key, value]) => answer[key] === value)
    );
  }
  if (
    !Array.isArray(answer) ||
    !Array.isArray(question.correct) ||
    new Set(answer).size !== answer.length
  )
    return false;
  const correct = question.correct;
  if (question.type === "ordering")
    return answer.length === correct.length && answer.every((id, i) => id === correct[i]);
  return (
    answer.length === question.correct.length && question.correct.every((id) => answer.includes(id))
  );
}
export function quizPercentage(correct: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((Math.min(Math.max(correct, 0), total) / total) * 100);
}
export function mastery(percentage: number, thresholds = { mastered: 80, completed: 60 }) {
  return percentage >= thresholds.mastered
    ? "mastered"
    : percentage >= thresholds.completed
      ? "completed"
      : "retry";
}
