import { Award, Orbit, Zap } from "lucide-react";
import { ProgressBar, Badge } from "./ui/primitives";
import { bg } from "@/i18n/bg";
import type { LearningSnapshot } from "@/lib/learning/service";
import { date } from "@/lib/utils";
export function Stats({ state }: { state: LearningSnapshot }) {
  return (
    <div className="stats-grid">
      <div className="stat">
        <span className="stat-icon tone-yellow">
          <Zap size={21} />
        </span>
        <div>
          <strong>{state.totalXp}</strong>
          <span>{bg.dashboard.totalXp}</span>
        </div>
      </div>
      <div className="stat">
        <span className="stat-icon tone-violet">
          <Award size={21} />
        </span>
        <div>
          <strong>{state.completed.size}</strong>
          <span>{bg.dashboard.completedLessons}</span>
        </div>
      </div>
      <div className="stat">
        <span className="stat-icon tone-mint">
          <Orbit size={21} />
        </span>
        <div>
          <strong>{state.completedWorlds.size}</strong>
          <span>{bg.dashboard.completedWorlds}</span>
        </div>
      </div>
    </div>
  );
}
export function TopicProgress({
  state,
  completionThreshold = 80,
}: {
  state: LearningSnapshot;
  completionThreshold?: number;
}) {
  return (
    <div>
      {state.worlds.map((world) => {
        const ids = new Set(state.lessons.filter((l) => l.worldId === world.id).map((l) => l.id));
        const scores = state.progress.filter((p) => ids.has(p.lessonId));
        const value = scores.length
          ? Math.round(scores.reduce((total, p) => total + p.bestScore, 0) / scores.length)
          : 0;
        return (
          <div className="topic-row" key={world.id}>
            <div>
              <strong>{world.title}</strong>
              {scores.length ? <span>{value}%</span> : <small>{bg.progress.notStarted}</small>}
            </div>
            <ProgressBar
              value={value}
              label={world.title}
              className={value >= completionThreshold ? "green" : ""}
            />
            {scores.length > 0 && value < completionThreshold && (
              <small>{bg.progress.review}</small>
            )}
          </div>
        );
      })}
    </div>
  );
}
export function RecentActivity({
  items,
}: {
  items: { title: string; at: Date; score: number; status: string }[];
}) {
  if (!items.length) return <p className="tiny-copy">{bg.progress.empty}</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>{bg.admin.lessons}</th>
            <th>{bg.progress.mastery}</th>
            <th>{bg.admin.status}</th>
            <th>{bg.parent.recent}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={index}>
              <td>{item.title}</td>
              <td>{item.score}%</td>
              <td>
                <Badge className={item.status === "completed" ? "badge-green" : "badge-neutral"}>
                  {item.status === "completed" ? bg.dashboard.completed : bg.progress.started}
                </Badge>
              </td>
              <td>{date(item.at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
