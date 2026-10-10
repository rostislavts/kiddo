import Link from "next/link";
import { count, desc } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { PageTitle } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { bg } from "@/i18n/bg";
import { date } from "@/lib/utils";
export default async function Admin() {
  await requireAdmin();
  const users = await db().select().from(s.users).orderBy(desc(s.users.createdAt)).limit(25);
  const subscriptions = await db()
    .select()
    .from(s.subscriptions)
    .orderBy(desc(s.subscriptions.updatedAt))
    .limit(25);
  const [progress] = await db().select({ value: count() }).from(s.progress);
  return (
    <>
      <PageTitle
        title={bg.admin.title}
        action={
          <Button asChild>
            <Link href="/admin/worlds">{bg.admin.worlds}</Link>
          </Button>
        }
      />
      <p className="notice" style={{ marginBottom: 24 }}>
        {bg.admin.progress}: {progress.value}
      </p>
      <section className="content-card">
        <h2>{bg.admin.recentAccounts}</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{bg.auth.email}</th>
                <th>{bg.admin.status}</th>
                <th>{bg.parent.recent}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.email}</td>
                  <td>{user.role}</td>
                  <td>{date(user.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="content-card">
        <h2>{bg.admin.recentSubscriptions}</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>{bg.admin.status}</th>
                <th>{bg.billing.next}</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((sub) => (
                <tr key={sub.id}>
                  <td>{sub.paddleSubscriptionId}</td>
                  <td>{bg.billing.statuses[sub.status]}</td>
                  <td>{date(sub.periodEnd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
