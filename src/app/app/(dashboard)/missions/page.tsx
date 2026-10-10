import { db } from "@/db";
import { selectedChild } from "@/lib/auth/session";
import { labView } from "@/lib/lab/view";
import { LabOverview } from "@/components/lab/overview";
export default async function Missions() {
  const { user, child } = await selectedChild();
  return <LabOverview mode="missions" view={await labView(db(), user.id, child.id)} />;
}
