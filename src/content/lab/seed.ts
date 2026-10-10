import type { QueryDb } from "@/db";
import * as s from "@/db/schema";
import { defaultAIConfig } from "@/lib/ai/models";
const id = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const labSeedId = id;
export const labChallengeSeeds = [
  {
    id: id(1),
    slug: "dragon-sofia-robot",
    type: "prompt-battles",
    title: "Дракон над София",
    description: "История от 100–150 думи с дракон, София, робот и щастлив край. Имаш три опита.",
    xpReward: 40,
    configuration: {
      instructions:
        "Напиши инструкция за приказка с дракон, София и робот. Крайният текст трябва да съдържа думите „щастлив край“.",
      requirements: [
        { type: "word_count", min: 100, max: 150 },
        { type: "required_terms", terms: ["дракон", "София", "робот", "щастлив край"] },
      ],
      forbiddenElements: ["война"],
      maxAttempts: 3,
      difficulty: "easy",
      energyCost: 3,
    },
  },
  {
    id: id(2),
    slug: "mars-repair-guide",
    type: "prompt-battles",
    title: "Инструкция за Марс",
    description: "Извлечи три кратки стъпки за ремонт на измислен робот.",
    xpReward: 30,
    configuration: {
      instructions:
        "Поискай номериран списък от точно 3 стъпки за симулиран ремонт. Включи думите „провери“, „свържи“ и „тествай“.",
      requirements: [
        { type: "item_count", count: 3 },
        { type: "required_terms", terms: ["провери", "свържи", "тествай"] },
      ],
      forbiddenElements: [],
      maxAttempts: 5,
      difficulty: "easy",
      energyCost: 3,
    },
  },
  {
    id: id(10),
    slug: "secret-animal",
    type: "agent-missions",
    title: "Тайното животно",
    description:
      "Нека агентът чете улики и проверява предположенията си. Всяко ново изпълнение може да крие друго животно.",
    xpReward: 40,
    configuration: {
      scenario: "secret-animal",
      maxSteps: 6,
      requiredTools: ["read_clue", "check_answer"],
    },
  },
  {
    id: id(11),
    slug: "museum-mystery",
    type: "agent-missions",
    title: "Музейната загадка",
    description: "Кой робот е преместил експоната? Разпитай свидетел и огледай предметите.",
    xpReward: 40,
    configuration: {
      scenario: "museum-mystery",
      maxSteps: 6,
      requiredTools: ["inspect_item", "ask_character", "check_answer"],
    },
  },
  {
    id: id(12),
    slug: "space-repair",
    type: "agent-missions",
    title: "Космически ремонт",
    description: "Провери уредите и поправи правилния измислен модул.",
    xpReward: 40,
    configuration: {
      scenario: "space-repair",
      maxSteps: 6,
      requiredTools: ["read_clue", "inspect_item", "check_answer"],
    },
  },
  {
    id: id(20),
    slug: "sun-mistake",
    type: "detective",
    title: "Звезда или планета?",
    description: "Открий грешното твърдение с помощта на проверен източник.",
    xpReward: 20,
    configuration: {
      mode: "mistake",
      question: "Кое твърдение е грешно?",
      claims: ["Слънцето е планета.", "Слънцето е звезда.", "Земята обикаля около Слънцето."],
      correctIndex: 0,
      fact: "Слънцето е звезда.",
      source: "https://science.nasa.gov/sun/facts/",
      explanation:
        "Слънцето е звезда, а Земята е планета. Увереният тон не прави грешния отговор верен.",
      dynamic: false,
    },
  },
  {
    id: id(21),
    slug: "moon-better",
    type: "detective",
    title: "Кой отговор е по-добър?",
    description: "Избери отговор, подкрепен от факти.",
    xpReward: 20,
    configuration: {
      mode: "better",
      question: "Защо виждаме Луната да свети?",
      claims: [
        "Луната произвежда собствена светлина като звезда.",
        "Луната отразява светлината на Слънцето.",
      ],
      correctIndex: 1,
      fact: "Луната отразява светлината на Слънцето.",
      source: "https://science.nasa.gov/moon/facts/",
      explanation:
        "Отразената слънчева светлина прави Луната видима. Вторият отговор обяснява наблюдението.",
      dynamic: false,
    },
  },
  {
    id: id(22),
    slug: "moon-evidence",
    type: "detective",
    title: "Къде е доказателството?",
    description: "Различи проверен факт от недоказано предположение.",
    xpReward: 20,
    configuration: {
      mode: "evidence",
      question: "Кое твърдение не се подкрепя от посочения факт за Луната?",
      claims: [
        "Луната отразява слънчева светлина.",
        "Щом Луната свети, тя сигурно е направена от лампи.",
      ],
      correctIndex: 1,
      fact: "Луната отразява светлината на Слънцето.",
      source: "https://science.nasa.gov/moon/facts/",
      explanation:
        "Източникът обяснява отразената светлина. Той не дава доказателство за измисленото твърдение за лампи.",
      dynamic: false,
    },
  },
  {
    id: id(23),
    slug: "sun-fix",
    type: "detective",
    title: "Поправи AI отговора",
    description: "Замени грешното изречение с провереното обяснение.",
    xpReward: 20,
    configuration: {
      mode: "fix",
      question: "Поправи „Слънцето е планета“. Напиши вярното изречение от предложените варианти.",
      claims: ["Слънцето е звезда.", "Слънцето е планета."],
      correctIndex: 0,
      fact: "Слънцето е звезда.",
      source: "https://science.nasa.gov/sun/facts/",
      explanation: "Поправката заменя грешната категория с вярната: звезда.",
      dynamic: true,
    },
  },
  {
    id: id(30),
    slug: "mars-knowledge",
    type: "knowledge",
    title: "Научи бордовия AI",
    description: "Добави карта за измисления кораб и попитай кой модул доставя енергия.",
    xpReward: 30,
    configuration: {
      question: "Кой модул доставя енергия на измисления кораб Орбита?",
      requiredTerms: ["соларен панел"],
      starterCards: [
        {
          title: "Кораб Орбита",
          content: "Орбита е измислен учебен кораб. Неговият соларен панел доставя енергия.",
        },
        { title: "Антена", content: "Антената на Орбита предава съобщения в учебната симулация." },
      ],
    },
  },
  {
    id: id(40),
    slug: "robot-library",
    type: "images",
    title: "Нощ в библиотеката",
    description: "Нарисувай измислен робот с червена книга в библиотека през нощта.",
    xpReward: 30,
    configuration: {
      instructions:
        "Включи робот, библиотека, червена книга и нощ в инструкцията за изображението.",
      requiredTerms: ["робот", "библиотека", "червена книга", "нощ"],
      visionCriterion:
        "Има ли робот в библиотека с червена книга и нощна обстановка? Това е приблизителна оценка, не сигурен факт.",
    },
  },
  {
    id: id(50),
    slug: "escape-mars",
    type: "escape-rooms",
    title: "Бягство от Марс",
    description:
      "Пет свързани задачи: инструкция, проверка, знание, инструменти и последен ремонт.",
    xpReward: 100,
    configuration: {
      instructions:
        "Изпълни всяка стъпка подред. Използвай проверените резултати, за да поправиш учебния кораб.",
      challengeIds: [id(2), id(20), id(30), id(10), id(12)],
    },
  },
  {
    id: id(60),
    slug: "my-ai-tutor",
    type: "projects",
    title: "Моят AI учител",
    description: "Свържи собствен бот и Knowledge проект в завършена творба.",
    xpReward: 50,
    configuration: { template: "tutor", requiredFeatures: ["bots", "knowledge"] },
  },
  {
    id: id(61),
    slug: "my-space-agent",
    type: "projects",
    title: "Моят космически агент",
    description: "Създай и изпробвай агент с мисия и инструменти.",
    xpReward: 50,
    configuration: { template: "space-agent", requiredFeatures: ["agents"] },
  },
  {
    id: id(62),
    slug: "my-story-game",
    type: "projects",
    title: "Моята игра с история",
    description: "Създай своя свят и изпробвай приключението.",
    xpReward: 50,
    configuration: { template: "story-game", requiredFeatures: ["games"] },
  },
  {
    id: id(63),
    slug: "my-museum-guide",
    type: "projects",
    title: "Моят AI музеен гид",
    description: "Свържи бот с Knowledge карти и избери илюстрация за твоя музей.",
    xpReward: 50,
    configuration: { template: "museum-guide", requiredFeatures: ["bots", "knowledge"] },
  },
] as const;
const achievementEvents = [
  ["prompt-apprentice", "Prompt Apprentice", "prompt_playground_run", 1],
  ["prompt-master", "Prompt Master", "prompt_battle_completed", 1],
  ["bot-builder", "Bot Builder", "bot_tested", 1],
  ["agent-engineer", "Agent Engineer", "agent_mission_completed", 1],
  ["ai-detective", "AI Detective", "detective_challenge_completed", 1],
  ["knowledge-keeper", "Knowledge Keeper", "knowledge_query_run", 1],
  ["image-creator", "Image Creator", "image_generated", 1],
  ["escape-room-solver", "Escape Room Solver", "escape_room_completed", 1],
  ["ai-creator", "AI Creator", "creator_project_completed", 1],
  ["monthly-mission", "Monthly Mission Complete", "monthly_mission_completed", 1],
] as const;
export async function seedLab(tx: QueryDb) {
  await tx
    .insert(s.aiSettings)
    .values({ id: "lab", configuration: defaultAIConfig() as unknown as Record<string, unknown> })
    .onConflictDoNothing();
  for (const value of labChallengeSeeds)
    await tx
      .insert(s.labChallenges)
      .values({
        ...value,
        configuration: JSON.parse(JSON.stringify(value.configuration)),
        status: "published",
      })
      .onConflictDoNothing();
  const room = labChallengeSeeds.find((c) => c.type === "escape-rooms")!;
  for (const [position, challengeId] of room.configuration.challengeIds.entries())
    await tx
      .insert(s.escapeRoomSteps)
      .values({ id: id(100 + position), roomId: room.id, challengeId, position })
      .onConflictDoNothing();
  for (const [i, [key, title, event, count]] of achievementEvents.entries())
    await tx
      .insert(s.achievements)
      .values({
        id: id(200 + i),
        key,
        title,
        description: `Твоя награда за приключенията в AI Lab.`,
        icon: "sparkles",
        criteria: { type: "lab", event, count },
        published: true,
      })
      .onConflictDoNothing();
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  await tx
    .insert(s.featuredMissions)
    .values({
      id: id(300),
      title: "Мисия на месеца: Дракон над София",
      description: "Твоята първа история с истински AI. Подобри prompt-а и изпълни изискванията.",
      featureType: "prompt-battles",
      challengeId: id(1),
      startsAt: start,
      endsAt: end,
      xpReward: 50,
      achievementId: id(209),
      status: "published",
    })
    .onConflictDoNothing();
}
