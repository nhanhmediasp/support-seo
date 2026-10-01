import type { Metadata } from "next";
import { supabase, supabaseConfigured } from "../../../lib/supabase";
import type { PublicSeoReportPayload } from "../../report-builder";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  if (supabaseConfigured && supabase) {
    try {
      const { data } = await supabase.rpc("get_public_seo_report", { p_share_token: token });
      const payload = data as PublicSeoReportPayload | null;
      if (payload?.report?.title) {
        const site = payload.settings?.name || payload.settings?.domain;
        return {
          title: site ? `${payload.report.title} — ${site}` : payload.report.title,
          robots: { index: false, follow: false },
        };
      }
    } catch {
      // fallback
    }
  }
  return {
    title: "Báo cáo SEO",
    robots: { index: false, follow: false },
  };
}

export default function PublicReportLayout({ children }: { children: React.ReactNode }) {
  return children;
}
