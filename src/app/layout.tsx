import type { Metadata } from "next";
import "./globals.css";
import "@fontsource-variable/nunito-sans";
import { bg } from "@/i18n/bg";
import { appUrl } from "@/lib/config";
export const metadata: Metadata = {
  metadataBase: new URL(appUrl()),
  title: { default: "AI Академия — големи идеи за любопитни деца", template: "%s | AI Академия" },
  description: bg.home.description,
  openGraph: {
    type: "website",
    locale: "bg_BG",
    siteName: bg.brand,
    title: bg.brand,
    description: bg.home.description,
  },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="bg">
      <body>
        <a href="#main" className="skip-link">
          Към съдържанието
        </a>
        {children}
      </body>
    </html>
  );
}
