import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Báo cáo SEO",
  robots: { index: false, follow: false },
};

export default function PublicReportLayout({ children }: { children: React.ReactNode }) {
  return children;
}
