"use client";
import { toolNames } from "@/lib/ai/schemas";
import { creatorTemplates, curatedImages } from "@/content/lab/catalog";
import type { LabView } from "@/lib/lab/view";
export const defaults: Record<string, Record<string, unknown>> = {
  prompts: {
    role: "Разказвач",
    goal: "Напиши кратка история за любопитен робот.",
    context: "Роботът открива библиотека на Луната.",
    audience: "деца на 8–11 години",
    constraints: "Добър край. Без страшни сцени.",
    format: "3 кратки абзаца",
    example: "",
  },
  bots: {
    name: "Библио",
    avatar: "robot",
    role: "Помощник за измислени истории",
    personality: "Любопитен и търпелив",
    goal: "Помагай ми да измислям герои.",
    topic: "Книги, фантазия и роботи",
    rules: "Питай по един въпрос. Не искай лични данни.",
    responseStyle: "До 3 кратки изречения",
    knowledgeProjectId: null,
  },
  agents: {
    mission: "Открий тайното животно с улики.",
    brain: "Избери инструмент, разгледай резултата и провери отговора.",
    tools: ["read_clue", "ask_character", "check_answer"],
    knowledge: "Всички улики са от измисления игрови свят.",
    memory: "run_only",
    rules: "Провери отговора с check_answer, преди да приключиш.",
    finishCondition: "Правилен отговор или изчерпан лимит.",
    scenario: "secret-animal",
    maxSteps: 5,
    maxToolCalls: 5,
    maxEnergy: 15,
  },
  knowledge: { goal: "Отговаряй само с помощта на моите карти." },
  images: {
    subject: "Малък дружелюбен робот",
    setting: "В библиотека през нощта",
    style: "cartoon",
    composition: "Роботът е в центъра",
    details: "Държи червена книга. Топла светлина.",
    restrictions: "Без хора, надписи и лични данни.",
  },
  games: {
    world: "Библиотека на Луната",
    hero: "Роботът Бип",
    goal: "Намери изгубената книга",
    characters: "Усмихнат библиотекар и котка",
    rules: "Без страшни сцени. Давай ясни избори.",
    tone: "curious",
    maxTurns: 8,
  },
  projects: {
    template: "tutor",
    projectIds: [],
    visualIds: [],
    notes: "Свържи свои инструменти в обща идея.",
  },
};
type Field = {
  key: string;
  label: string;
  hint?: string;
  multiline?: boolean;
  number?: [number, number];
  options?: [string, string][];
};
const fields: Record<string, Field[]> = {
  prompts: [
    { key: "role", label: "Роля", hint: "Кой е AI в твоята задача?" },
    { key: "goal", label: "Цел", multiline: true },
    { key: "context", label: "Контекст", multiline: true },
    { key: "audience", label: "За кого е отговорът?" },
    { key: "constraints", label: "Ограничения", multiline: true },
    { key: "format", label: "Формат на отговора" },
    { key: "example", label: "Пример", multiline: true },
  ],
  bots: [
    { key: "name", label: "Име на бота" },
    {
      key: "avatar",
      label: "Аватар",
      options: [
        ["robot", "🤖 Робот"],
        ["cat", "🐱 Котка"],
        ["fox", "🦊 Лисица"],
        ["rocket", "🚀 Ракета"],
      ],
    },
    { key: "role", label: "Роля на бота" },
    { key: "personality", label: "Характер" },
    { key: "goal", label: "Какво да прави?", multiline: true },
    { key: "topic", label: "Теми и знания", multiline: true },
    { key: "rules", label: "Правила на бота", multiline: true },
    { key: "responseStyle", label: "Стил на отговора" },
  ],
  agents: [
    { key: "mission", label: "Мисия", multiline: true },
    { key: "brain", label: "Мозък · как да работи?" },
    { key: "knowledge", label: "Знание", multiline: true },
    {
      key: "memory",
      label: "Памет",
      options: [
        ["run_only", "Само тази задача"],
        ["last_result", "Включи последния резултат"],
      ],
    },
    { key: "rules", label: "Правила", multiline: true },
    { key: "finishCondition", label: "Кога да приключи?" },
    {
      key: "scenario",
      label: "Игрови свят",
      options: [
        ["secret-animal", "Тайно животно"],
        ["museum-mystery", "Музейна загадка"],
        ["space-repair", "Космически ремонт"],
      ],
    },
    { key: "maxSteps", label: "Максимум стъпки", number: [1, 8] },
    { key: "maxToolCalls", label: "Максимум инструменти", number: [1, 8] },
    { key: "maxEnergy", label: "Energy лимит за задачата", number: [1, 50] },
  ],
  knowledge: [{ key: "goal", label: "Как да използва знанието?", multiline: true }],
  images: [
    { key: "subject", label: "Главен обект" },
    { key: "setting", label: "Място и време" },
    {
      key: "style",
      label: "Стил",
      options: [
        ["cartoon", "Илюстрация"],
        ["watercolor", "Акварел"],
        ["pixel-art", "Пиксел арт"],
        ["paper-cut", "Хартиен колаж"],
      ],
    },
    { key: "composition", label: "Композиция" },
    { key: "details", label: "Детайли", multiline: true },
    { key: "restrictions", label: "Ограничения" },
  ],
  games: [
    { key: "world", label: "Свят" },
    { key: "hero", label: "Герой" },
    { key: "goal", label: "Цел" },
    { key: "characters", label: "Персонажи", multiline: true },
    { key: "rules", label: "Правила на играта", multiline: true },
    {
      key: "tone",
      label: "Настроение",
      options: [
        ["curious", "Любопитно"],
        ["funny", "Забавно"],
        ["calm", "Спокойно"],
      ],
    },
    { key: "maxTurns", label: "Максимум ходове", number: [3, 20] },
  ],
  projects: [
    {
      key: "template",
      label: "Шаблон",
      options: Object.entries(creatorTemplates).map(([key, v]) => [key, v.title]),
    },
    { key: "notes", label: "Моята идея", multiline: true },
  ],
};
export const toolLabels: Record<string, string> = {
  read_clue: "Прочети улика",
  ask_character: "Попитай герой",
  inspect_item: "Разгледай предмет",
  search_knowledge: "Потърси в знанието",
  check_answer: "Провери решение",
  calculate: "Пресметни",
  roll_dice: "Хвърли зар",
  get_game_state: "Виж състоянието",
};
export function Builder({
  feature,
  configuration,
  onChange,
  projects,
  disabled,
}: {
  feature: string;
  configuration: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
  projects: LabView["projects"];
  disabled: boolean;
}) {
  function update(key: string, value: unknown) {
    onChange({ ...configuration, [key]: value });
  }
  return (
    <fieldset disabled={disabled} className="lab-fields">
      {(fields[feature] ?? []).map((field) => (
        <label key={field.key}>
          {field.label}
          {field.hint && <small>{field.hint}</small>}
          {field.options ? (
            <select
              value={String(configuration[field.key] ?? "")}
              onChange={(e) => update(field.key, e.target.value)}
            >
              {field.options.map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          ) : field.multiline ? (
            <textarea
              rows={3}
              maxLength={1200}
              value={String(configuration[field.key] ?? "")}
              onChange={(e) => update(field.key, e.target.value)}
            />
          ) : (
            <input
              type={field.number ? "number" : "text"}
              min={field.number?.[0]}
              max={field.number?.[1]}
              maxLength={240}
              value={String(configuration[field.key] ?? "")}
              onChange={(e) =>
                update(field.key, field.number ? Number(e.target.value) : e.target.value)
              }
            />
          )}
        </label>
      ))}
      {feature === "bots" && (
        <label>
          Knowledge проект
          <select
            value={String(configuration.knowledgeProjectId ?? "")}
            onChange={(e) => update("knowledgeProjectId", e.target.value || null)}
          >
            <option value="">Без Knowledge карти</option>
            {projects
              .filter((p) => p.feature === "knowledge")
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
          </select>
        </label>
      )}
      {feature === "agents" && (
        <div>
          <h3>Инструменти</h3>
          <p className="muted">Работят само в избрания измислен свят.</p>
          <div className="lab-checks">
            {toolNames.map((tool) => (
              <label key={tool}>
                <input
                  type="checkbox"
                  checked={((configuration.tools as string[]) ?? []).includes(tool)}
                  onChange={(e) =>
                    update(
                      "tools",
                      e.target.checked
                        ? [...((configuration.tools as string[]) ?? []), tool]
                        : ((configuration.tools as string[]) ?? []).filter((t) => t !== tool),
                    )
                  }
                />
                {toolLabels[tool]}
              </label>
            ))}
          </div>
        </div>
      )}
      {feature === "projects" && configuration.template === "museum-guide" && (
        <div>
          <h3>Илюстрации за музея</h3>
          <div className="lab-checks">
            {curatedImages.map((image) => (
              <label key={image.id}>
                <input
                  type="checkbox"
                  checked={((configuration.visualIds as string[]) ?? []).includes(image.id)}
                  onChange={(e) =>
                    update(
                      "visualIds",
                      e.target.checked
                        ? [...((configuration.visualIds as string[]) ?? []), image.id]
                        : ((configuration.visualIds as string[]) ?? []).filter(
                            (id) => id !== image.id,
                          ),
                    )
                  }
                />
                {image.title}
              </label>
            ))}
          </div>
        </div>
      )}
      {feature === "projects" && (
        <div>
          <h3>Свържи твоите инструменти</h3>
          <p className="muted">
            Нужни са:{" "}
            {creatorTemplates[
              configuration.template as keyof typeof creatorTemplates
            ]?.features.join(" + ")}
            . Първо ги създай и изпробвай.
          </p>
          <div className="lab-checks">
            {projects
              .filter((p) => p.feature !== "projects")
              .map((p) => (
                <label key={p.id}>
                  <input
                    type="checkbox"
                    checked={((configuration.projectIds as string[]) ?? []).includes(p.id)}
                    onChange={(e) =>
                      update(
                        "projectIds",
                        e.target.checked
                          ? [...((configuration.projectIds as string[]) ?? []), p.id]
                          : ((configuration.projectIds as string[]) ?? []).filter(
                              (id) => id !== p.id,
                            ),
                      )
                    }
                  />
                  {p.title}
                </label>
              ))}
          </div>
        </div>
      )}
    </fieldset>
  );
}
