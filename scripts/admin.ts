import "./load-env";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { users } from "../src/db/schema";
const email = process.argv[2];
if (!email || !process.env.DATABASE_URL)
  throw new Error(
    "Употреба: npm run db:admin -- parent@example.com (след регистрация и първи вход)",
  );
const client = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
try {
  const result = await drizzle(client)
    .update(users)
    .set({ role: "admin" })
    .where(eq(users.email, email.toLowerCase()))
    .returning({ id: users.id });
  if (!result.length) throw new Error("Акаунтът не е намерен. Влез веднъж в приложението.");
  console.log("Администраторската роля е зададена.");
} finally {
  await client.end();
}
