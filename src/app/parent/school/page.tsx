import { db } from "@/db";
import { requireUser } from "@/lib/auth/session";
import { parentSchoolView } from "@/lib/schools/view";
import { ParentSchool } from "@/components/schools/parent";
import { PageTitle } from "@/components/ui/primitives";
export default async function School() {
  const user = await requireUser();
  return (
    <>
      <PageTitle
        title="Училище и Energy"
        description="Активирай училищна покана за детето и управлявай източника на неговия Premium достъп."
      />
      <ParentSchool profiles={await parentSchoolView(db(), user.id)} />
    </>
  );
}
