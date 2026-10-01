"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ReportBuilder, { PublicSeoReportPayload } from "../../report-builder";
import { supabase, supabaseConfigured } from "../../../lib/supabase";

export default function PublicReportPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [payload, setPayload] = useState<PublicSeoReportPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadReport = async () => {
      const local = localStorage.getItem(`seo-public-report-${token}`);
      if (local) {
        try { if (!cancelled) setPayload(JSON.parse(local) as PublicSeoReportPayload); } catch { /* continue with cloud */ }
      }
      if (supabaseConfigured && supabase) {
        const { data } = await supabase.rpc("get_public_seo_report", { p_share_token: token });
        if (!cancelled && data) setPayload(data as PublicSeoReportPayload);
      }
      if (!cancelled) setLoading(false);
    };
    void loadReport();
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    if (payload?.report?.title) {
      const site = payload.settings?.name || payload.settings?.domain;
      document.title = site ? `${payload.report.title} — ${site}` : payload.report.title;
    }
  }, [payload]);

  if (loading) return <main className="public-report-state"><div className="loading-card"><span className="loading-mark">SEO</span><b>Đang mở báo cáo…</b></div></main>;
  if (!payload) return <main className="public-report-state"><div className="public-report-error"><span>!</span><h1>Không tìm thấy báo cáo</h1><p>Đường dẫn có thể chưa được xuất bản, đã hết hiệu lực hoặc nhập chưa chính xác.</p></div></main>;

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return <main className="public-report-page">
    <header className="public-report-toolbar print-hide">
      <div>
        <span>SEO REPORT</span>
        <b>{payload.report.title}</b>
        {payload.settings.domain && (
          <a
            href={payload.settings.domain.startsWith("http") ? payload.settings.domain : `https://${payload.settings.domain}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ marginLeft: "10px", color: "#94a3b8", fontSize: "12px", textDecoration: "none", fontWeight: 500 }}
            title="Mở website trong tab mới"
          >
            ↗ {payload.settings.domain}
          </a>
        )}
      </div>
      <div>
        <button className="secondary" onClick={copyLink}>{copied ? "✓ Đã sao chép" : "Sao chép link"}</button>
        <button className="primary" onClick={() => window.print()}>In / Lưu PDF</button>
      </div>
    </header>
    <div className="public-report-wrap"><ReportBuilder data={payload.report.snapshot} settings={payload.settings} viewOnlyReport={payload.report} /></div>
  </main>;
}
