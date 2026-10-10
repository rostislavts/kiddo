import { db } from "@/db";
import { selectedChild } from "@/lib/auth/session";
import { labView } from "@/lib/lab/view";
import { LabOverview } from "@/components/lab/overview";
export default async function Lab() {
  const { user, child } = await selectedChild();
  return <LabOverview view={await labView(db(), user.id, child.id)} />;
}
