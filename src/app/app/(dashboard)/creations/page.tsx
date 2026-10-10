import { db } from "@/db";
import { selectedChild } from "@/lib/auth/session";
import { labView } from "@/lib/lab/view";
import { LabOverview } from "@/components/lab/overview";
export default async function Creations() {
  const { user, child } = await selectedChild();
  return <LabOverview mode="creations" view={await labView(db(), user.id, child.id)} />;
}
