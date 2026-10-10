import { selectedChild } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
export default async function Layout({ children }: { children: React.ReactNode }) {
  const { user, child } = await selectedChild();
  return (
    <AppShell nickname={child.nickname} avatar={child.avatar} admin={user.role === "admin"}>
      {children}
    </AppShell>
  );
}
