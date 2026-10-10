import { notFound } from "next/navigation";
import { db } from "@/db";
import { selectedChild } from "@/lib/auth/session";
import { labView } from "@/lib/lab/view";
import { labTiles } from "@/content/lab/catalog";
import { LabWorkspace } from "@/components/lab/workspace";
export default async function Workspace({
  params,
  searchParams,
}: {
  params: Promise<{ feature: string }>;
  searchParams: Promise<{ project?: string; challenge?: string; mission?: string; room?: string }>;
}) {
  const { feature } = await params;
  const query = await searchParams;
  if (!labTiles.some((t) => t.slug === feature)) notFound();
  const { user, child } = await selectedChild();
  return (
    <LabWorkspace
      key={[child.id, feature, ...Object.values(query)].join(":")}
      feature={feature}
      initial={await labView(db(), user.id, child.id)}
      selection={query}
    />
  );
}
