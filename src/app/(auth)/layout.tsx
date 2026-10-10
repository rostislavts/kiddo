import { MarketingHeader } from "@/components/marketing-shell";
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MarketingHeader />
      <main className="auth-page" id="main">
        {children}
      </main>
    </>
  );
}
