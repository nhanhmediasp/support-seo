import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Air & Sea SEO Command Center",
  description: "SEO operating system for airandseaglobal.vn",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="vi"><body>{children}</body></html>;
}
