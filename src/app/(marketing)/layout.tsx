import { MarketingHeader, MarketingFooter } from "@/components/marketing-shell";
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MarketingHeader />
      <main id="main">{children}</main>
      <MarketingFooter />
    </>
  );
}
