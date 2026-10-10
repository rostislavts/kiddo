import { seedLab } from "@/content/lab/seed";
import type { Database } from "./index";
import * as s from "./schema";
import {
  achievementSeeds,
  lessonSeeds,
  levelSeeds,
  seedId,
  worldSeeds,
} from "@/content/seed/curriculum";

export async function seedDatabase(database: Database) {
  await database.transaction(async (tx) => {
    await seedLab(tx);
    await tx
      .insert(s.tracks)
      .values({
        id: seedId(1),
        slug: "ai-explorer",
        title: "AI изследовател",
        description: "Малки мисии. Големи открития. За любопитни умове от 8 до 11 години.",
        published: true,
      })
      .onConflictDoNothing();
    await tx.insert(s.worlds).values(worldSeeds).onConflictDoNothing();
    for (const { content, ...lesson } of lessonSeeds) {
      await tx.insert(s.lessons).values(lesson).onConflictDoNothing();
      await tx
        .insert(s.lessonVersions)
        .values({ lessonId: lesson.id, version: 1, content })
        .onConflictDoNothing();
    }
    await tx.insert(s.levels).values(levelSeeds).onConflictDoNothing();
    await tx
      .insert(s.achievements)
      .values(achievementSeeds.map((a, i) => ({ ...a, id: seedId(300 + i) })))
      .onConflictDoNothing();
  });
}
