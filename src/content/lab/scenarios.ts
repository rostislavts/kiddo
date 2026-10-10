export type Scenario = {
  id: string;
  title: string;
  answer: string;
  clues: Record<string, string>;
  characters: Record<string, string>;
  items: Record<string, string>;
  finish: string;
};
const animals = [
  {
    answer: "жираф",
    clues: {
      habitat: "Живее в Африка.",
      body: "Има много дълга шия.",
      food: "Яде листа от високи дървета.",
    },
  },
  {
    answer: "пингвин",
    clues: {
      habitat: "Живее в Южното полукълбо.",
      body: "Птица е, но не лети.",
      food: "Лови риба и плува отлично.",
    },
  },
  {
    answer: "слон",
    clues: { habitat: "Живее в Африка или Азия.", body: "Има хобот.", food: "Яде растения." },
  },
];
export function scenarioFor(kind: string, seed: number): Scenario {
  if (kind === "museum-mystery") {
    const answer = seed % 2 ? "робот Лъч" : "робот Искра";
    return {
      id: kind,
      title: "Загадка в музея",
      answer,
      clues: {
        note: `До преместения експонат има бележка с подпис „${answer}“.`,
        map: "Това е измислена игра. Експонатът е преместен, не откраднат.",
      },
      characters: { guard: `Видях ${answer} да подрежда залата.` },
      items: {
        vase: "Експонатът е здрав и е в склада.",
        label: `На етикета пише: преместено от ${answer}.`,
      },
      finish: "Назови робота, който е преместил експоната.",
    };
  }
  if (kind === "space-repair") {
    const answer = seed % 2 ? "антена" : "соларен панел";
    return {
      id: kind,
      title: "Космически ремонт",
      answer,
      clues: {
        manual: `Учебна симулация: провери модулите; подай за ремонт модула „${answer}“.`,
        safety: "Само измислени модули. Няма управление на истинска техника.",
      },
      characters: { engineer: `Диагностиката сочи: ${answer}.` },
      items: {
        antenna: answer === "антена" ? "Антената няма връзка." : "Антената работи.",
        solar:
          answer === "соларен панел"
            ? "Соларният панел не подава енергия."
            : "Соларният панел работи.",
      },
      finish: "Посочи повредения модул за симулирания ремонт.",
    };
  }
  const a = animals[Math.abs(seed) % animals.length];
  return {
    id: "secret-animal",
    title: "Тайното животно",
    answer: a.answer,
    clues: a.clues,
    characters: { guide: a.clues.body },
    items: { footprint: a.clues.habitat },
    finish: "Открий животното с помощта на уликите.",
  };
}
