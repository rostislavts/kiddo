import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { getUser } from "@/lib/auth/session";
import { schoolView } from "@/lib/schools/view";
import { SchoolPanel } from "@/components/schools/panel";
import { AppShell } from "@/components/app-shell";
import { DomainError } from "@/lib/errors";
export const dynamic = "force-dynamic";
export default async function School({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ classId?: string; page?: string; invitePage?: string }>;
}) {
  const user = await getUser();
  if (!user) redirect("/login?school=1");
  const { id } = await params,
    q = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();
  const query = z
    .object({
      classId: z.uuid().optional(),
      page: z.coerce.number().int().min(1).max(10000).default(1),
      invitePage: z.coerce.number().int().min(1).max(10000).default(1),
    })
    .safeParse(q);
  if (!query.success) notFound();
  let view;
  try {
    view = await schoolView(
      db(),
      user.id,
      id,
      query.data.classId,
      query.data.page,
      query.data.invitePage,
    );
  } catch (e) {
    if (e instanceof DomainError && (e.status === 403 || e.status === 404)) notFound();
    throw e;
  }
  return (
    <AppShell mode="school" admin={user.role === "admin"}>
      <SchoolPanel view={view} />
    </AppShell>
  );
}
