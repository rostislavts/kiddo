import { randomUUID } from "node:crypto";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { it, expect } from "vitest";

it("upgrades populated v2 balances without rewriting ledger history or granting twice", async () => {
  const folder = mkdtempSync(join(tmpdir(), "academy-v2-upgrade-"));
  const client = await PGlite.create();
  let stage = "prepare";
  try {
    cpSync("src/db/migrations", folder, { recursive: true });
    const path = join(folder, "meta/_journal.json");
    const journal = JSON.parse(readFileSync(path, "utf8"));
    journal.entries = journal.entries.filter((e: { idx: number }) => e.idx < 6);
    writeFileSync(path, JSON.stringify(journal));
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: folder });
    const user = randomUUID(),
      child = randomUUID(),
      period = randomUUID();
    await client.query("INSERT INTO users(id,email) VALUES ($1,'migration@example.test')", [user]);
    await client.query(
      "INSERT INTO child_profiles(id,parent_user_id,nickname,avatar_key) VALUES ($1,$2,'Миграция','robot')",
      [child, user],
    );
    await client.query(
      "INSERT INTO ai_energy_periods(id,user_id,subscription_id,starts_at,ends_at) VALUES ($1,$2,'sub_legacy',now()-interval '1 day',now()+interval '29 days')",
      [period, user],
    );
    await client.query(
      `INSERT INTO ai_energy_events(user_id,child_profile_id,period_id,event_type,feature,amount,idempotency_key)
      VALUES ($1,NULL,$3,'monthly_grant','account',1000,'legacy-grant'), ($1,$2,$3,'usage_reservation','prompts',-2,'legacy-usage')`,
      [user, child, period],
    );
    stage = "migration";
    const before = (await client.query("SELECT * FROM ai_energy_events ORDER BY id")).rows;
    await migrate(db, { migrationsFolder: "src/db/migrations" });
    await migrate(db, { migrationsFolder: "src/db/migrations" });
    expect((await client.query("SELECT * FROM ai_energy_events ORDER BY id")).rows).toEqual(before);
    const rows = (
      await client.query<{
        id: string;
        kind: string;
        user_id: string;
        balance: number;
      }>(`SELECT p.id,a.kind,a.user_id,sum(e.amount)::integer balance
      FROM ai_energy_periods p JOIN ai_energy_accounts a ON a.id=p.account_id
      JOIN ai_energy_events e ON e.period_id=p.id GROUP BY p.id,a.id`)
    ).rows;
    expect(rows).toEqual([{ id: period, kind: "family", user_id: user, balance: 998 }]);
    expect((await client.query("SELECT energy_preference FROM child_profiles")).rows).toEqual([
      { energy_preference: "auto" },
    ]);
    stage = "previous deployment compatibility";
    const legacyPeriod = randomUUID();
    await client.query(
      "INSERT INTO ai_energy_periods(id,user_id,subscription_id,starts_at,ends_at) VALUES ($1,$2,'sub_legacy',now()+interval '29 days',now()+interval '59 days')",
      [legacyPeriod, user],
    );
    expect(
      (await client.query("SELECT DISTINCT account_id FROM ai_energy_periods")).rows,
    ).toHaveLength(1);
    const newUser = randomUUID();
    await client.query("INSERT INTO users(id,email) VALUES ($1,'legacy-new@example.test')", [
      newUser,
    ]);
    await client.query(
      "INSERT INTO ai_energy_periods(user_id,subscription_id,starts_at,ends_at) VALUES ($1,'sub_legacy_new',now(),now()+interval '30 days')",
      [newUser],
    );
    expect(
      (
        await client.query("SELECT kind,user_id FROM ai_energy_accounts WHERE user_id=$1", [
          newUser,
        ])
      ).rows,
    ).toEqual([{ kind: "family", user_id: newUser }]);
    stage = "delete";
    await client.query("DELETE FROM users WHERE id=$1", [user]);
    await client.query("DELETE FROM users WHERE id=$1", [newUser]);
    expect((await client.query("SELECT * FROM ai_energy_periods")).rows).toEqual([]);
    expect((await client.query("SELECT * FROM ai_energy_events")).rows).toEqual([]);
  } catch (error) {
    throw new Error(`Migration test stage: ${stage}`, { cause: error });
  } finally {
    await client.close();
    rmSync(folder, { recursive: true, force: true });
  }
});
