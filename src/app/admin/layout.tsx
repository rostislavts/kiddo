import { requireAdmin } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
export const dynamic = "force-dynamic";
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <AppShell mode="admin">{children}</AppShell>;
}
