"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase, supabaseConfigured } from "../lib/supabase";

type Row = Record<string, string | number | boolean> & { id: string };
type ReportData = Record<string, Row[]>;
type ReportSettings = { name: string; domain: string; owner: string; email: string; timezone: string };
type SectionKey = "overview" | "gsc" | "analytics" | "keywords" | "pages" | "tasks" | "worklogs" | "content" | "audits" | "indexing" | "backlinks" | "expenses" | "monthlyReview" | "nextPlan" | "notes";
type SectionConfig = { key: SectionKey; title: string; enabled: boolean };
type ReportSignature = { name: string; role: string; imageUrl: string; signedAt: string; verified: boolean };
type ReportSignatures = { freelancer: ReportSignature; reviewer: ReportSignature };

export type ReportImageItem = {
  url: string;
  caption?: string;
};

export type SavedSeoReport = {
  id: string;
  title: string;
  from: string;
  to: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  sections: SectionConfig[];
  summary: string;
  monthlyReview?: string;
  nextPlan: string;
  notes: string;
  snapshot: ReportData;
  signatures?: ReportSignatures;
  shareToken?: string;
  publishedAt?: string;
  gscImages?: (string | ReportImageItem)[];
  analyticsImages?: (string | ReportImageItem)[];
};

export type PublicSeoReportPayload = { report: SavedSeoReport; settings: ReportSettings };

const sectionDefaults: SectionConfig[] = [
  { key: "overview", title: "Tổng quan kết quả", enabled: true },
  { key: "gsc", title: "Hiệu suất Google Search Console", enabled: true },
  { key: "analytics", title: "Traffic Google Analytics", enabled: true },
  { key: "keywords", title: "Từ khóa nổi bật", enabled: true },
  { key: "pages", title: "Landing page hiệu suất cao", enabled: true },
  { key: "tasks", title: "Công việc đã hoàn thành", enabled: true },
  { key: "worklogs", title: "Nhật ký triển khai", enabled: true },
  { key: "content", title: "Nội dung đã triển khai", enabled: true },
  { key: "audits", title: "Technical SEO & bằng chứng", enabled: true },
  { key: "indexing", title: "Tình trạng index", enabled: true },
  { key: "backlinks", title: "Backlink đã triển khai", enabled: true },
  { key: "expenses", title: "Chi phí phát sinh", enabled: false },
  { key: "monthlyReview", title: "Nhận xét tháng này", enabled: true },
  { key: "nextPlan", title: "Kế hoạch tháng tới", enabled: true },
  { key: "notes", title: "Ghi chú & đề xuất", enabled: true },
];

export const normalizeSections = (source: SectionConfig[]): SectionConfig[] => {
  const missing = sectionDefaults.filter(defaultSection => !source.some(section => section.key === defaultSection.key));
  let merged = [...source, ...missing];

  // 1. Luôn đặt Analytics ngay sau Google Search Console
  const analytics = merged.find(section => section.key === "analytics");
  if (analytics) {
    merged = merged.filter(section => section.key !== "analytics");
    const gscIndex = merged.findIndex(section => section.key === "gsc");
    merged.splice(gscIndex >= 0 ? gscIndex + 1 : 0, 0, analytics);
  }

  // 2. Luôn sắp xếp mục Kế hoạch tháng tới (nextPlan) xuống dưới Nhận xét tháng này (monthlyReview)
  const monthlyReview = merged.find(section => section.key === "monthlyReview");
  const nextPlan = merged.find(section => section.key === "nextPlan");
  const notes = merged.find(section => section.key === "notes");

  if (monthlyReview && nextPlan) {
    const monthlyIndex = merged.findIndex(section => section.key === "monthlyReview");
    const nextPlanIndex = merged.findIndex(section => section.key === "nextPlan");

    // Nếu nextPlan đang đứng trước monthlyReview, chỉnh lại thứ tự
    if (nextPlanIndex >= 0 && monthlyIndex >= 0 && nextPlanIndex < monthlyIndex) {
      const commentaryKeys = ["monthlyReview", "nextPlan", "notes"];
      const firstIdx = merged.findIndex(s => commentaryKeys.includes(s.key));
      const filtered = merged.filter(s => !commentaryKeys.includes(s.key));
      const commentarySections = [monthlyReview, nextPlan, notes].filter(Boolean) as SectionConfig[];
      const insertAt = firstIdx >= 0 && firstIdx <= filtered.length ? firstIdx : filtered.length;
      filtered.splice(insertAt, 0, ...commentarySections);
      merged = filtered;
    }
  }

  // 3. Đảm bảo notes đứng sau nextPlan nếu notes đang xen vào giữa monthlyReview và nextPlan
  const finalMonthlyIdx = merged.findIndex(section => section.key === "monthlyReview");
  const finalNextPlanIdx = merged.findIndex(section => section.key === "nextPlan");
  const notesIdx = merged.findIndex(section => section.key === "notes");
  if (notesIdx >= 0 && finalNextPlanIdx >= 0 && notesIdx < finalNextPlanIdx && notesIdx > finalMonthlyIdx) {
    const noteSec = merged[notesIdx];
    merged.splice(notesIdx, 1);
    const newNextPlanIdx = merged.findIndex(section => section.key === "nextPlan");
    merged.splice(newNextPlanIdx + 1, 0, noteSec);
  }

  return merged;
};

const placeAnalyticsAfterGsc = normalizeSections;

const today = () => new Date().toISOString().slice(0, 10);
const firstDayOfMonth = () => `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`;
const uid = () => `REPORT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
const emptySignatures = (owner: string): ReportSignatures => ({
  freelancer: { name: owner, role: "SEO Freelancer", imageUrl: "", signedAt: "", verified: false },
  reviewer: { name: "", role: "Người kiểm duyệt", imageUrl: "", signedAt: "", verified: false },
});
const asText = (value: unknown) => String(value ?? "");
const asNumber = (value: unknown) => Number(value || 0);
const gscKeywordRows = (rows: Row[]) => rows.filter(row => row.gscSummary !== true);
const gscStats = (rows: Row[]) => {
  const summaryRows = rows.filter(row => row.gscSummary === true);
  const performance = summaryRows.length ? summaryRows : gscKeywordRows(rows);
  const clicks = performance.reduce((sum, row) => sum + asNumber(row.clicks), 0);
  const impressions = performance.reduce((sum, row) => sum + asNumber(row.impressions), 0);
  const positionWeight = performance.reduce((sum, row) => sum + asNumber(row.position) * Math.max(1, asNumber(row.impressions)), 0);
  const totalWeight = performance.reduce((sum, row) => sum + Math.max(1, asNumber(row.impressions)), 0);
  return { clicks, impressions, ctr: impressions ? clicks / impressions * 100 : 0, position: totalWeight ? positionWeight / totalWeight : 0 };
};
const formatNumber = (value: number) => new Intl.NumberFormat("vi-VN").format(value);
const formatMoney = (value: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
};
const formatDateTime = (value: string, timezone: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("vi-VN", { dateStyle: "full", timeStyle: "short", timeZone: timezone || "Asia/Ho_Chi_Minh" });
};
const imageLinks = (value: unknown) => asText(value).split(/\r?\n/).map(link => link.trim()).filter(link => /^https?:\/\//i.test(link));

function rangeData(data: ReportData, from: string, to: string): ReportData {
  const inRange = (value: unknown) => { const date = asText(value).slice(0, 10); return Boolean(date && date >= from && date <= to); };
  return {
    rankings: (data.rankings || []).filter(row => inRange(row.date)),
    analytics: (data.analytics || []).filter(row => inRange(row.date)),
    tasks: (data.tasks || []).filter(row => (!row.completedDate && !row.startDate) || inRange(row.completedDate || row.startDate)),
    worklogs: (data.worklogs || []).filter(row => inRange(row.date || row.occurredAt)),
    content: (data.content || []).filter(row => !row.publishDate || inRange(row.publishDate)),
    audits: (data.audits || []).filter(row => (!row.completed && !row.found && !row.due) || inRange(row.completed || row.found || row.due)),
    indexing: (data.indexing || []).filter(row => (!row.checked && !row.submitted && !row.created) || inRange(row.checked || row.submitted || row.created)),
    backlinks: (data.backlinks || []).filter(row => (!row.placed && !row.checked) || inRange(row.placed || row.checked)),
    expenses: (data.expenses || []).filter(row => inRange(row.date)),
    onpage: (data.onpage || []).filter(row => !row.checked || inRange(row.checked)),
    entities: (data.entities || []).filter(row => !row.updated || inRange(row.updated)),
    seeding: (data.seeding || []).filter(row => (!row.posted && !row.checked) || inRange(row.posted || row.checked)),
  };
}

function suggestedSummary(snapshot: ReportData) {
  const { clicks, impressions } = gscStats(snapshot.rankings || []);
  const analytics = snapshot.analytics || [];
  const gaOverview = analytics.find(row => row.channel === "Tổng quan");
  const gaChannelRows = analytics.filter(row => row.channel !== "Tổng quan" && row.channel !== "Trang xem nhiều" && !row.page);
  const gaPageRows = analytics.filter(row => row.channel === "Trang xem nhiều" || (row.page && asNumber(row.views) > 0));
  const sessions = gaOverview ? asNumber(gaOverview.sessions) : gaChannelRows.reduce((sum, row) => sum + asNumber(row.sessions), 0);
  const users = gaOverview ? asNumber(gaOverview.users) : gaChannelRows.reduce((sum, row) => sum + asNumber(row.users), 0);
  const views = gaOverview ? asNumber(gaOverview.views) : gaPageRows.reduce((sum, row) => sum + asNumber(row.views), 0);
  const tasks = snapshot.tasks || [];
  const done = tasks.filter(row => asText(row.status) === "Done").length;
  const published = (snapshot.content || []).filter(row => asText(row.status) === "Published").length;
  const fixed = (snapshot.audits || []).filter(row => asText(row.status) === "Done").length;
  const indexed = (snapshot.indexing || []).filter(row => asText(row.status) === "Indexed").length;
  const liveLinks = (snapshot.backlinks || []).filter(row => asText(row.status) === "Live" || asText(row.status) === "Accepted").length;
  const totalTasks = tasks.length;
  const userText = users ? ` (${formatNumber(users)} người dùng)` : "";
  const viewsText = views ? `, ${formatNumber(views)} lượt xem` : "";
  const taskText = totalTasks > 0 ? `hoàn thành ${done}/${totalTasks} công việc SEO` : `hoàn thành ${done} công việc SEO`;
  return `Trong kỳ, website ghi nhận ${formatNumber(clicks)} lượt nhấp, ${formatNumber(impressions)} lượt hiển thị tự nhiên từ Google Search Console và ${formatNumber(sessions)} phiên truy cập${userText}${viewsText} theo Google Analytics. Đội ngũ đã ${taskText}, xuất bản ${published} nội dung mới, xử lý ${fixed} hạng mục kỹ thuật, xác nhận ${indexed} URL đã index và duy trì ${liveLinks} backlink hoạt động. Toàn bộ thống kê chi tiết theo từng phân hệ công việc và số liệu hiệu suất được trình bày ở các phần bên dưới.`;
}

function suggestedPlan(snapshot: ReportData) {
  const pendingAudit = (snapshot.audits || []).filter(row => asText(row.status) !== "Done").length;
  const pendingIndex = (snapshot.indexing || []).filter(row => asText(row.status) !== "Indexed").length;
  return `- Ưu tiên xử lý ${pendingAudit} hạng mục Technical SEO còn mở.\n- Theo dõi và cải thiện ${pendingIndex} URL chưa index.\n- Cập nhật nhóm nội dung có cơ hội tăng hạng và mở rộng internal link.\n- Tiếp tục theo dõi Search Console, thứ hạng và chuyển đổi theo tuần.`;
}

function formatReportCell(columnKey: string, rawValue: unknown, baseDomain = "") {
  const value = asText(rawValue);
  if (!value || value === "—") return <span className="report-cell-empty">—</span>;

  const isLinkColumn = ["url", "targetUrl", "sourceUrl", "postUrl", "document", "domain"].includes(columnKey);
  const startsWithHttp = /^https?:\/\//i.test(value);
  const startsWithSlash = value.startsWith("/") && value.length > 1;
  const isDomain = columnKey === "domain" && /^[\w.-]+\.[a-z]{2,}$/i.test(value);
  const isPageUrl = columnKey === "page" && (startsWithHttp || startsWithSlash);

  if (startsWithHttp || startsWithSlash || isDomain || (isLinkColumn && (startsWithHttp || startsWithSlash || isDomain)) || isPageUrl) {
    let href = value;
    if (startsWithSlash) {
      const cleanBase = baseDomain.replace(/\/+$/, "");
      href = cleanBase ? `${cleanBase}${value}` : value;
    } else if (isDomain && !startsWithHttp) {
      href = `https://${value}`;
    }

    let display = value;
    try {
      if (startsWithHttp) {
        const parsed = new URL(value);
        display = `${parsed.hostname}${parsed.pathname === "/" ? "" : parsed.pathname}`;
      }
    } catch {
      display = value;
    }

    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="report-table-link"
        title={`Mở liên kết: ${href}`}
      >
        <span className="report-table-link-text">{display}</span>
        <svg className="report-table-link-icon" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      </a>
    );
  }

  return value;
}

function Table({ rows, columns, baseDomain = "" }: { rows: Row[]; columns: { key: string; label: string }[]; baseDomain?: string }) {
  if (!rows.length) return null;
  return <div className="report-table-wrap"><table className="report-table"><thead><tr>{columns.map(column => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.id}>{columns.map(column => <td key={column.key}>{formatReportCell(column.key, row[column.key], baseDomain)}</td>)}</tr>)}</tbody></table></div>;
}

function EvidenceGallery({ rows }: { rows: Row[] }) {
  const items = rows.flatMap(row => [
    ...imageLinks(row.imageUrl).map(url => ({ url, label: asText(row.title || row.description || row.id), type: "Ảnh công việc" })),
  ]);
  if (!items.length) return null;
  return <div className="report-evidence-grid">{items.map((item, index) => <figure key={`${item.url}-${index}`}><img src={item.url} alt={`${item.type}: ${item.label}`} /><figcaption><b>{item.type}</b><span>{item.label}</span></figcaption></figure>)}</div>;
}

function BeforeAfterGallery({ rows }: { rows: Row[] }) {
  const groups = rows.map(row => {
    const before = imageLinks(row.beforeImages);
    const after = imageLinks(row.afterImages);
    const count = Math.max(before.length, after.length);
    return { id: row.id, title: asText(row.issue || row.url || row.id), pairs: Array.from({ length: count }, (_, index) => ({ before: before[index], after: after[index] })) };
  }).filter(group => group.pairs.length);
  if (!groups.length) return null;
  return <div className="report-comparison-list">{groups.map(group => <section key={group.id} className="report-comparison-group"><h3>{group.title}</h3>{group.pairs.map((pair, index) => <div className="report-comparison-row" key={`${group.id}-${index}`}><figure><span>TRƯỚC XỬ LÝ</span>{pair.before ? <img src={pair.before} alt={`Trước xử lý: ${group.title}`} /> : <div className="report-image-placeholder">Chưa có ảnh trước xử lý</div>}</figure><figure><span>SAU XỬ LÝ</span>{pair.after ? <img src={pair.after} alt={`Sau xử lý: ${group.title}`} /> : <div className="report-image-placeholder">Chưa có ảnh sau xử lý</div>}</figure></div>)}</section>)}</div>;
}

function parseBoldText(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /\*\*(.*?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(<strong key={match.index}>{match[1]}</strong>);
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts.length ? parts : [text];
}

function ReportNarrative({ text, placeholder }: { text: string; placeholder?: string }) {
  if (!text || !text.trim()) {
    return (
      <div className="report-narrative empty">
        <p>{placeholder || "Chưa có nội dung ghi nhận."}</p>
      </div>
    );
  }

  const lines = text.split("\n");

  return (
    <div className="report-narrative">
      {lines.map((rawLine, index) => {
        const line = rawLine.trim();
        if (!line) return <div key={index} className="report-narrative-spacer" />;

        const isBullet = /^[-*•]\s+/.test(line);
        const isNumber = /^\d+[\.)]\s+/.test(line);

        let content = line;
        let prefix = "";
        if (isBullet) {
          content = line.replace(/^[-*•]\s+/, "");
          prefix = "•";
        } else if (isNumber) {
          const match = line.match(/^(\d+[\.)])\s+(.*)/);
          if (match) {
            prefix = match[1];
            content = match[2];
          }
        }

        const parts = parseBoldText(content);

        if (isBullet || isNumber) {
          return (
            <div key={index} className="report-narrative-item">
              <span className={`report-narrative-prefix ${isNumber ? "num" : "bullet"}`}>{prefix}</span>
              <div className="report-narrative-text">{parts}</div>
            </div>
          );
        }

        return (
          <p key={index} className="report-narrative-p">
            {parts}
          </p>
        );
      })}
    </div>
  );
}

export const normalizeImages = (images?: (string | ReportImageItem)[]): ReportImageItem[] => {
  if (!images || !Array.isArray(images)) return [];
  return images.map(img => {
    if (typeof img === "string") return { url: img, caption: "" };
    return { url: img?.url || "", caption: img?.caption || "" };
  }).filter(img => Boolean(img.url));
};

const uploadFileToCloudinaryOrDataUrl = async (file: File): Promise<string> => {
  try {
    const formData = new FormData();
    formData.append("file", file, file.name);
    const res = await fetch("/api/cloudinary/upload-from-url", { method: "POST", body: formData });
    const json = (await res.json()) as { url?: string; error?: string };
    if (res.ok && json.url) return json.url;
  } catch (err) {
    console.warn("Upload via Cloudinary failed, using Data URL fallback:", err);
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Không thể đọc file ảnh"));
    reader.readAsDataURL(file);
  });
};

function SignatureBlock({ signatures, timezone }: { signatures: ReportSignatures; timezone: string }) {
  const items = [["freelancer", signatures.freelancer], ["reviewer", signatures.reviewer]] as const;
  return <section className="report-signature-section" id="report-signatures"><div className="report-section-heading"><span>✓</span><h2>Xác nhận & chữ ký</h2></div><div className="report-signature-grid">{items.map(([party, signature]) => <div className="report-signature-card" key={party}><span className="report-signature-role">{signature.role}</span><div className="report-signature-image">{signature.imageUrl ? <img src={signature.imageUrl} alt={`Chữ ký ${signature.name || signature.role}`} /> : <span>Chưa tải chữ ký</span>}</div><strong>{signature.name || "Chưa cập nhật tên"}</strong>{signature.verified && signature.signedAt && signature.name && signature.imageUrl ? <div className="report-signature-verified"><i>✓</i><span>Đã xác nhận · {formatDateTime(signature.signedAt, timezone)}</span></div> : <small>Chưa xác nhận ký hoàn tất</small>}</div>)}</div></section>;
}

export default function ReportBuilder({ data, settings, savedReports = [], onSaveReports = () => undefined, notify = () => undefined, onNavigate = () => undefined, projectId = "", viewOnlyReport }: { data: ReportData; settings: ReportSettings; savedReports?: SavedSeoReport[]; onSaveReports?: (reports: SavedSeoReport[]) => void; notify?: (message: string) => void; onNavigate?: (page: string) => void; projectId?: string; viewOnlyReport?: SavedSeoReport }) {
  const [mode, setMode] = useState<"list" | "edit">(viewOnlyReport ? "edit" : "list");
  const [from, setFrom] = useState(viewOnlyReport?.from || firstDayOfMonth());
  const [to, setTo] = useState(viewOnlyReport?.to || today());
  const [title, setTitle] = useState(viewOnlyReport?.title || `Báo cáo SEO tháng ${new Date().getMonth() + 1}/${new Date().getFullYear()}`);
  const [author, setAuthor] = useState(viewOnlyReport?.author || settings.owner);
  const [sections, setSections] = useState(() => normalizeSections(viewOnlyReport?.sections || sectionDefaults));
  const [summary, setSummary] = useState(viewOnlyReport?.summary || "");
  const [monthlyReview, setMonthlyReview] = useState(viewOnlyReport?.monthlyReview || "");
  const [nextPlan, setNextPlan] = useState(viewOnlyReport?.nextPlan || "");
  const [notes, setNotes] = useState(viewOnlyReport?.notes || "");
  const [signatures, setSignatures] = useState<ReportSignatures>(viewOnlyReport?.signatures || emptySignatures(settings.owner));
  const [uploadingSignature, setUploadingSignature] = useState<"freelancer" | "reviewer" | "">("");
  const [gscImages, setGscImages] = useState<ReportImageItem[]>(() => normalizeImages(viewOnlyReport?.gscImages));
  const [analyticsImages, setAnalyticsImages] = useState<ReportImageItem[]>(() => normalizeImages(viewOnlyReport?.analyticsImages));
  const [uploadingGsc, setUploadingGsc] = useState(false);
  const [uploadingAnalytics, setUploadingAnalytics] = useState(false);
  const [gscUrlInput, setGscUrlInput] = useState("");
  const [analyticsUrlInput, setAnalyticsUrlInput] = useState("");
  const [activeZoomImage, setActiveZoomImage] = useState<{ url: string; title: string } | null>(null);
  const [openingReportId, setOpeningReportId] = useState("");
  const [editingId, setEditingId] = useState(viewOnlyReport?.id || "");
  const [createdAt, setCreatedAt] = useState(viewOnlyReport?.createdAt || new Date().toISOString());
  const liveSnapshot = useMemo(() => rangeData(data, from, to), [data, from, to]);
  const [loadedSnapshot, setLoadedSnapshot] = useState<ReportData | null>(viewOnlyReport?.snapshot || null);
  const snapshot = loadedSnapshot || liveSnapshot;

  useEffect(() => { if (!summary) setSummary(suggestedSummary(liveSnapshot)); }, []);
  useEffect(() => { if (!monthlyReview) setMonthlyReview(suggestedSummary(liveSnapshot)); }, []);
  useEffect(() => { if (!nextPlan) setNextPlan(suggestedPlan(liveSnapshot)); }, []);
  useEffect(() => {
    if (title && (viewOnlyReport || mode === "edit")) {
      const site = settings?.name || settings?.domain;
      document.title = site ? `${title} — ${site}` : title;
    }
  }, [title, viewOnlyReport, mode, settings]);

  const allRankings = snapshot.rankings || [];
  const rankings = gscKeywordRows(allRankings);
  const { clicks, impressions, ctr, position: avgPosition } = gscStats(allRankings);
  const analytics = snapshot.analytics || [];
  const gaOverview = analytics.find(row => row.channel === "Tổng quan");
  const gaChannelRows = analytics.filter(row => row.channel !== "Tổng quan" && row.channel !== "Trang xem nhiều" && !row.page);
  const gaPageRows = analytics.filter(row => row.channel === "Trang xem nhiều" || (row.page && asNumber(row.views) > 0)).sort((a, b) => asNumber(b.views) - asNumber(a.views));

  const gaSessions = gaOverview ? asNumber(gaOverview.sessions) : gaChannelRows.reduce((sum, row) => sum + asNumber(row.sessions), 0);
  const gaUsers = gaOverview ? asNumber(gaOverview.users) : gaChannelRows.reduce((sum, row) => sum + asNumber(row.users), 0);
  const gaNewUsers = gaOverview ? asNumber(gaOverview.newUsers) : gaChannelRows.reduce((sum, row) => sum + asNumber(row.newUsers), 0);
  const gaViews = gaOverview ? asNumber(gaOverview.views) : gaPageRows.reduce((sum, row) => sum + asNumber(row.views), 0);
  const gaEngagedSessions = gaOverview ? asNumber(gaOverview.engagedSessions) : gaChannelRows.reduce((sum, row) => sum + asNumber(row.engagedSessions), 0);
  const gaConversions = gaOverview ? asNumber(gaOverview.conversions) : gaChannelRows.reduce((sum, row) => sum + asNumber(row.conversions), 0);
  const gaEngagementRate = gaSessions ? Math.min(100, gaEngagedSessions / gaSessions * 100) : analytics.length ? analytics.reduce((sum, row) => sum + asNumber(row.engagementRate), 0) / analytics.length : 0;
  // Modules / Fields task counts
  const tasks = snapshot.tasks || [];
  const completedTasks = tasks.filter(row => asText(row.status) === "Done");
  const inProgressTasks = tasks.filter(row => asText(row.status) === "In progress" || asText(row.status) === "Doing");
  const pendingTasks = tasks.filter(row => asText(row.status) !== "Done");

  const contentRows = snapshot.content || [];
  const publishedContent = contentRows.filter(row => asText(row.status) === "Published");
  const inProgressContent = contentRows.filter(row => asText(row.status) !== "Published");

  const auditRows = snapshot.audits || [];
  const doneAudits = auditRows.filter(row => asText(row.status) === "Done");
  const pendingAudits = auditRows.filter(row => asText(row.status) !== "Done");

  const indexingRows = snapshot.indexing || [];
  const indexedUrls = indexingRows.filter(row => asText(row.status) === "Indexed");
  const unindexedUrls = indexingRows.filter(row => asText(row.status) !== "Indexed");

  const backlinkRows = snapshot.backlinks || [];
  const liveBacklinks = backlinkRows.filter(row => asText(row.status) === "Live" || asText(row.status) === "Accepted");
  const pendingBacklinks = backlinkRows.filter(row => asText(row.status) !== "Live" && asText(row.status) !== "Accepted");

  const worklogRows = snapshot.worklogs || [];
  const onpageRows = snapshot.onpage || [];
  const entityRows = snapshot.entities || [];
  const seedingRows = snapshot.seeding || [];
  const expenseRows = snapshot.expenses || [];
  const hours = (snapshot.worklogs || []).reduce((sum, row) => sum + asNumber(row.hours), 0);

  const totalTasksCount = tasks.length;
  const totalContentCount = contentRows.length;
  const totalAuditsCount = auditRows.length;
  const totalIndexingCount = indexingRows.length;
  const totalBacklinksCount = backlinkRows.length;
  const totalWorklogsCount = worklogRows.length;

  const grandTotalWorkItems = totalTasksCount + totalContentCount + totalAuditsCount + totalIndexingCount + totalBacklinksCount + totalWorklogsCount;
  const grandTotalCompleted = completedTasks.length + publishedContent.length + doneAudits.length + indexedUrls.length + liveBacklinks.length + totalWorklogsCount;
  const grandTotalPending = Math.max(0, grandTotalWorkItems - grandTotalCompleted);
  const overallPercent = grandTotalWorkItems > 0 ? Math.round((grandTotalCompleted / grandTotalWorkItems) * 100) : 100;

  const getFieldOwners = (rows: Row[]) => {
    const list = Array.from(new Set(rows.map(r => asText(r.owner)).filter(Boolean)));
    return list.slice(0, 2).join(", ") || settings.owner;
  };

  const taskBreakdownRows = [
    {
      key: "tasks",
      icon: "📋",
      name: "Công việc SEO (Workflow Tasks)",
      description: "Nhiệm vụ tối ưu Onpage, Technical, chiến dịch",
      total: totalTasksCount,
      done: completedTasks.length,
      pending: pendingTasks.length,
      unit: "task",
      doneLabel: "xong",
      pendingLabel: "đang làm",
      percentage: totalTasksCount > 0 ? Math.round((completedTasks.length / totalTasksCount) * 100) : 0,
      owners: getFieldOwners(tasks),
    },
    {
      key: "content",
      icon: "✍️",
      name: "Kế hoạch nội dung (Content Plan)",
      description: "Bài viết chuẩn SEO, pillar & cluster content",
      total: totalContentCount,
      done: publishedContent.length,
      pending: inProgressContent.length,
      unit: "bài viết",
      doneLabel: "đã đăng",
      pendingLabel: "đang soạn/duyệt",
      percentage: totalContentCount > 0 ? Math.round((publishedContent.length / totalContentCount) * 100) : 0,
      owners: getFieldOwners(contentRows),
    },
    {
      key: "audits",
      icon: "🛠️",
      name: "Technical SEO Audit",
      description: "Phát hiện & sửa lỗi kỹ thuật, redirect, tốc độ",
      total: totalAuditsCount,
      done: doneAudits.length,
      pending: pendingAudits.length,
      unit: "lỗi",
      doneLabel: "đã sửa",
      pendingLabel: "đang xử lý",
      percentage: totalAuditsCount > 0 ? Math.round((doneAudits.length / totalAuditsCount) * 100) : 0,
      owners: getFieldOwners(auditRows),
    },
    {
      key: "indexing",
      icon: "🔍",
      name: "Kiểm tra chỉ mục (Index Tracking)",
      description: "Submit URL và theo dõi trạng thái index Google",
      total: totalIndexingCount,
      done: indexedUrls.length,
      pending: unindexedUrls.length,
      unit: "URL",
      doneLabel: "đã index",
      pendingLabel: "chưa index",
      percentage: totalIndexingCount > 0 ? Math.round((indexedUrls.length / totalIndexingCount) * 100) : 0,
      owners: getFieldOwners(indexingRows),
    },
    {
      key: "backlinks",
      icon: "🔗",
      name: "Liên kết Backlink (Off-page)",
      description: "Xây dựng domain uy tín và anchor text trỏ về",
      total: totalBacklinksCount,
      done: liveBacklinks.length,
      pending: pendingBacklinks.length,
      unit: "backlink",
      doneLabel: "đang live",
      pendingLabel: "chờ duyệt/đặt",
      percentage: totalBacklinksCount > 0 ? Math.round((liveBacklinks.length / totalBacklinksCount) * 100) : 0,
      owners: getFieldOwners(backlinkRows),
    },
    {
      key: "worklogs",
      icon: "⏱️",
      name: "Nhật ký làm việc (Daily Worklogs)",
      description: "Ghi nhận công việc chi tiết hàng ngày và giờ làm",
      total: totalWorklogsCount,
      done: totalWorklogsCount,
      pending: 0,
      unit: "nhật ký",
      doneLabel: `${hours}h xong`,
      pendingLabel: "",
      percentage: 100,
      owners: getFieldOwners(worklogRows),
    },
  ];

  if (onpageRows.length > 0) {
    taskBreakdownRows.push({
      key: "onpage",
      icon: "📄",
      name: "On-page Checklist",
      description: "Chấm điểm tiêu chuẩn On-page các trang đích",
      total: onpageRows.length,
      done: onpageRows.length,
      pending: 0,
      unit: "URL",
      doneLabel: "đã audit",
      pendingLabel: "",
      percentage: 100,
      owners: getFieldOwners(onpageRows),
    });
  }

  if (entityRows.length > 0) {
    const verifiedEntities = entityRows.filter(r => asText(r.verified) === "Verified" || asText(r.verified) === "Complete");
    taskBreakdownRows.push({
      key: "entities",
      icon: "🏢",
      name: "Entity SEO & Thương hiệu",
      description: "Thiết lập profile social, thư mục và NAP",
      total: entityRows.length,
      done: verifiedEntities.length,
      pending: entityRows.length - verifiedEntities.length,
      unit: "profile",
      doneLabel: "đã xác minh",
      pendingLabel: "chờ xác minh",
      percentage: Math.round((verifiedEntities.length / entityRows.length) * 100),
      owners: getFieldOwners(entityRows),
    });
  }

  if (seedingRows.length > 0) {
    const liveSeeding = seedingRows.filter(r => asText(r.status) === "Live");
    taskBreakdownRows.push({
      key: "seeding",
      icon: "📣",
      name: "Seeding & Phân phối",
      description: "Bài chia sẻ diễn đàn, hội nhóm và mạng xã hội",
      total: seedingRows.length,
      done: liveSeeding.length,
      pending: seedingRows.length - liveSeeding.length,
      unit: "link post",
      doneLabel: "đang live",
      pendingLabel: "chờ duyệt",
      percentage: Math.round((liveSeeding.length / seedingRows.length) * 100),
      owners: getFieldOwners(seedingRows),
    });
  }

  const topQueries = [...rankings]
    .filter(row => asNumber(row.clicks) > 0 || asNumber(row.impressions) > 0)
    .sort((a, b) => asNumber(b.clicks) - asNumber(a.clicks) || asNumber(b.impressions) - asNumber(a.impressions))
    .slice(0, 10);
  const pageMap = new Map<string, Row>();
  rankings.forEach(row => {
    const page = asText(row.page) || "(Không xác định)";
    const current = pageMap.get(page) || { id: page, page, clicks: 0, impressions: 0, positionTotal: 0, count: 0, ctr: 0, position: 0 };
    current.clicks = asNumber(current.clicks) + asNumber(row.clicks);
    current.impressions = asNumber(current.impressions) + asNumber(row.impressions);
    current.positionTotal = asNumber(current.positionTotal) + asNumber(row.position);
    current.count = asNumber(current.count) + 1;
    current.position = asNumber(current.positionTotal) / asNumber(current.count);
    current.ctr = asNumber(current.impressions) ? asNumber(current.clicks) / asNumber(current.impressions) * 100 : 0;
    pageMap.set(page, current);
  });
  const topPages = [...pageMap.values()].sort((a, b) => asNumber(b.clicks) - asNumber(a.clicks)).slice(0, 10).map(row => ({ ...row, position: asNumber(row.position).toFixed(1), ctr: `${asNumber(row.ctr).toFixed(2)}%` }));
  const metrics = [
    ["Organic clicks", formatNumber(clicks)], ["Impressions", formatNumber(impressions)], ["CTR", `${ctr.toFixed(2)}%`], ["Vị trí trung bình", avgPosition ? avgPosition.toFixed(1) : "—"],
    ["Từ khóa Top 3", rankings.filter(row => asNumber(row.position) <= 3).length], ["Từ khóa Top 10", rankings.filter(row => asNumber(row.position) <= 10).length], ["GA4 Sessions", formatNumber(gaSessions)], ["GA4 Users", formatNumber(gaUsers)], ...(gaViews > 0 ? [["GA4 Lượt xem trang", formatNumber(gaViews)]] : []), ["Chuyển đổi", formatNumber(gaConversions)],
    ["Tổng task triển khai", `${grandTotalWorkItems} task`],
    ["Task hoàn thành", `${completedTasks.length} / ${totalTasksCount || completedTasks.length}`],
    ["Bài viết xuất bản", `${publishedContent.length} / ${totalContentCount || publishedContent.length}`],
    ["Lỗi kỹ thuật đã sửa", `${doneAudits.length} / ${totalAuditsCount || doneAudits.length}`],
    ["Giờ triển khai", `${hours}h`],
  ];
  const generatedAt = new Date().toISOString();

  const [tocOpen, setTocOpen] = useState(false);
  const [activeSectionKey, setActiveSectionKey] = useState<string>("");

  const getSectionBadge = (key: SectionKey): string => {
    switch (key) {
      case "overview":
        return grandTotalWorkItems > 0 ? `${grandTotalWorkItems} task & hạng mục` : "Tổng quan";
      case "gsc":
        return allRankings.length > 0 ? `${formatNumber(allRankings.length)} từ khóa GSC` : "";
      case "analytics":
        return gaPageRows.length > 0 ? `${gaChannelRows.length} kênh · ${gaPageRows.length} trang` : gaChannelRows.length > 0 ? `${gaChannelRows.length} kênh traffic` : "";
      case "keywords":
        return topQueries.length > 0 ? `${topQueries.length} từ khóa Top` : "";
      case "pages":
        return gaPageRows.length > 0 ? `${gaPageRows.length} trang xem nhiều` : topPages.length > 0 ? `${topPages.length} landing page` : "";
      case "tasks":
        return tasks.length > 0 ? `${completedTasks.length}/${tasks.length} task xong` : "";
      case "worklogs":
        return worklogRows.length > 0 ? `${worklogRows.length} nhật ký (${hours}h)` : "";
      case "content":
        return contentRows.length > 0 ? `${publishedContent.length}/${contentRows.length} bài đã đăng` : "";
      case "audits":
        return auditRows.length > 0 ? `${doneAudits.length}/${auditRows.length} lỗi đã sửa` : "";
      case "indexing":
        return indexingRows.length > 0 ? `${indexedUrls.length}/${indexingRows.length} URL đã index` : "";
      case "backlinks":
        return backlinkRows.length > 0 ? `${liveBacklinks.length}/${backlinkRows.length} link live` : "";
      case "expenses":
        return expenseRows.length > 0 ? `${expenseRows.length} khoản chi` : "";
      default:
        return "";
    }
  };

  const sectionHasData = (key: SectionKey): boolean => {
    switch (key) {
      case "overview":
        return Boolean(summary.trim() || clicks > 0 || impressions > 0 || gaSessions > 0 || rankings.length > 0 || grandTotalWorkItems > 0);
      case "gsc":
        return clicks > 0 || impressions > 0 || allRankings.length > 0 || gscImages.length > 0;
      case "analytics":
        return gaSessions > 0 || gaUsers > 0 || gaViews > 0 || gaChannelRows.length > 0 || analytics.length > 0 || analyticsImages.length > 0;
      case "keywords":
        return topQueries.length > 0;
      case "pages":
        return gaPageRows.length > 0 || topPages.length > 0;
      case "tasks":
        return tasks.length > 0 || completedTasks.length > 0;
      case "worklogs":
        return worklogRows.length > 0;
      case "content":
        return contentRows.length > 0;
      case "audits":
        return auditRows.length > 0;
      case "indexing":
        return indexingRows.length > 0;
      case "backlinks":
        return backlinkRows.length > 0;
      case "expenses":
        return expenseRows.length > 0;
      case "monthlyReview":
        return Boolean(monthlyReview && monthlyReview.trim().length > 0);
      case "nextPlan":
        return Boolean(nextPlan && nextPlan.trim().length > 0);
      case "notes":
        return Boolean(notes && notes.trim().length > 0);
      default:
        return true;
    }
  };

  const visibleSections = useMemo(
    () => sections.filter(section => section.enabled && sectionHasData(section.key)),
    [
      sections,
      summary,
      monthlyReview,
      nextPlan,
      notes,
      clicks,
      impressions,
      allRankings,
      gscImages,
      analyticsImages,
      gaSessions,
      gaUsers,
      gaViews,
      gaChannelRows,
      analytics,
      topQueries,
      gaPageRows,
      topPages,
      completedTasks,
      snapshot,
    ]
  );

  useEffect(() => {
    const handleScroll = () => {
      const headings = visibleSections.map(s => document.getElementById(`report-section-${s.key}`)).filter(Boolean) as HTMLElement[];
      const scrollPosition = window.scrollY + 160;
      for (let i = headings.length - 1; i >= 0; i--) {
        const el = headings[i];
        if (el && el.offsetTop <= scrollPosition) {
          setActiveSectionKey(visibleSections[i].key);
          return;
        }
      }
      if (headings.length > 0 && window.scrollY < 200) {
        setActiveSectionKey(visibleSections[0].key);
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [visibleSections]);

  const scrollToSection = (key: string) => {
    const el = document.getElementById(`report-section-${key}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveSectionKey(key);
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setActiveSectionKey("");
  };

  const scrollToSignatures = () => {
    const el = document.getElementById("report-signatures");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const updateSection = (index: number, patch: Partial<SectionConfig>) => setSections(current => current.map((section, currentIndex) => currentIndex === index ? { ...section, ...patch } : section));
  const updateSignature = (party: "freelancer" | "reviewer", patch: Partial<ReportSignature>) => setSignatures(current => ({ ...current, [party]: { ...current[party], ...patch } }));
  const uploadSignature = async (party: "freelancer" | "reviewer", file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { notify("Chữ ký phải là file hình ảnh"); return; }
    setUploadingSignature(party);
    try {
      const formData = new FormData();
      formData.append("file", file, file.name || `${party}-signature.png`);
      const response = await fetch("/api/cloudinary/upload-from-url", { method: "POST", body: formData });
      const result = await response.json() as { url?: string; error?: string };
      if (!response.ok || !result.url) throw new Error(result.error || "Không tải được ảnh chữ ký");
      updateSignature(party, { imageUrl: result.url });
      notify("Đã tải ảnh chữ ký");
    } catch (error) { notify(error instanceof Error ? error.message : "Không tải được ảnh chữ ký"); }
    finally { setUploadingSignature(""); }
  };
  const moveSection = (index: number, direction: -1 | 1) => setSections(current => {
    const target = index + direction;
    if (target < 0 || target >= current.length) return current;
    const next = [...current];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });
  const handleUploadGsc = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setUploadingGsc(true);
    try {
      const newItems: ReportImageItem[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith("image/")) continue;
        const url = await uploadFileToCloudinaryOrDataUrl(file);
        const nameClean = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
        newItems.push({ url, caption: nameClean === "image" ? "Biểu đồ Search Console" : nameClean });
      }
      setGscImages(prev => [...prev, ...newItems]);
      notify(`Đã thêm ${newItems.length} ảnh Search Console`);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Không tải được ảnh Search Console");
    } finally {
      setUploadingGsc(false);
    }
  };

  const handleAddGscUrl = () => {
    const trimmed = gscUrlInput.trim();
    if (!trimmed) return;
    setGscImages(prev => [...prev, { url: trimmed, caption: "Biểu đồ Search Console" }]);
    setGscUrlInput("");
    notify("Đã thêm ảnh Search Console từ link");
  };

  const handleUploadAnalytics = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setUploadingAnalytics(true);
    try {
      const newItems: ReportImageItem[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith("image/")) continue;
        const url = await uploadFileToCloudinaryOrDataUrl(file);
        const nameClean = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
        newItems.push({ url, caption: nameClean === "image" ? "Biểu đồ Google Analytics" : nameClean });
      }
      setAnalyticsImages(prev => [...prev, ...newItems]);
      notify(`Đã thêm ${newItems.length} ảnh Google Analytics`);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Không tải được ảnh Google Analytics");
    } finally {
      setUploadingAnalytics(false);
    }
  };

  const handleAddAnalyticsUrl = () => {
    const trimmed = analyticsUrlInput.trim();
    if (!trimmed) return;
    setAnalyticsImages(prev => [...prev, { url: trimmed, caption: "Biểu đồ Google Analytics" }]);
    setAnalyticsUrlInput("");
    notify("Đã thêm ảnh Google Analytics từ link");
  };

  const refreshSuggestions = () => { const suggestion = suggestedSummary(liveSnapshot); setSummary(suggestion); setMonthlyReview(suggestion); setNextPlan(suggestedPlan(liveSnapshot)); notify("Đã cập nhật gợi ý từ dữ liệu hiện tại"); };
  const newReport = () => {
    const currentSnapshot = rangeData(data, firstDayOfMonth(), today());
    setMode("edit"); setEditingId(""); setLoadedSnapshot(null); setFrom(firstDayOfMonth()); setTo(today()); setTitle(`Báo cáo SEO tháng ${new Date().getMonth() + 1}/${new Date().getFullYear()}`); setAuthor(settings.owner); setSections(normalizeSections(sectionDefaults)); setSummary(suggestedSummary(currentSnapshot)); setMonthlyReview(suggestedSummary(currentSnapshot)); setNextPlan(suggestedPlan(currentSnapshot)); setNotes(""); setSignatures(emptySignatures(settings.owner)); setGscImages([]); setAnalyticsImages([]); setCreatedAt(new Date().toISOString());
  };
  const saveReport = async () => {
    const now = new Date().toISOString();
    const existing = savedReports.find(item => item.id === editingId);
    const report: SavedSeoReport = { id: editingId || uid(), title: title.trim() || "Báo cáo SEO", from, to, author: author.trim() || settings.owner, createdAt: editingId ? createdAt : now, updatedAt: now, sections: normalizeSections(sections), summary, monthlyReview, nextPlan, notes, snapshot: liveSnapshot, signatures, gscImages, analyticsImages, shareToken: existing?.shareToken, publishedAt: existing?.shareToken ? now : existing?.publishedAt };
    const next = editingId ? savedReports.map(item => item.id === editingId ? report : item) : [report, ...savedReports].slice(0, 24);
    if (report.shareToken) {
      const payload: PublicSeoReportPayload = { report: { ...report, publishedAt: now }, settings };
      localStorage.setItem(`seo-public-report-${report.shareToken}`, JSON.stringify(payload));
      if (supabaseConfigured && supabase && projectId) await supabase.from("public_report_shares").upsert({ site_id: projectId, share_token: report.shareToken, payload, updated_at: now }, { onConflict: "share_token" });
    }
    onSaveReports(next); setEditingId(report.id); setCreatedAt(report.createdAt); setLoadedSnapshot(report.snapshot); setMode("list"); notify(editingId ? "Đã cập nhật bản báo cáo" : "Đã lưu bản báo cáo mới");
  };
  const loadReport = (report: SavedSeoReport) => {
    setMode("edit"); setEditingId(report.id); setTitle(report.title); setFrom(report.from); setTo(report.to); setAuthor(report.author); setSections(normalizeSections(report.sections)); setSummary(report.summary); setMonthlyReview(report.monthlyReview || report.summary); setNextPlan(report.nextPlan); setNotes(report.notes); setSignatures(report.signatures || emptySignatures(report.author || settings.owner)); setGscImages(normalizeImages(report.gscImages)); setAnalyticsImages(normalizeImages(report.analyticsImages)); setCreatedAt(report.createdAt); setLoadedSnapshot(report.snapshot); notify("Đã mở bản báo cáo để chỉnh sửa");
  };
  const deleteReport = async (id: string) => {
    if (!window.confirm("Xóa bản báo cáo này?")) return;
    const report = savedReports.find(item => item.id === id);
    if (report?.shareToken) {
      localStorage.removeItem(`seo-public-report-${report.shareToken}`);
      if (supabaseConfigured && supabase && projectId) await supabase.from("public_report_shares").delete().eq("share_token", report.shareToken).eq("site_id", projectId);
    }
    onSaveReports(savedReports.filter(report => report.id !== id));
    if (editingId === id) { setEditingId(""); setMode("list"); }
    notify("Đã xóa bản báo cáo");
  };
  const publishReport = async (source: SavedSeoReport, copyOnly = false) => {
    if (openingReportId) return;
    if (!copyOnly) setOpeningReportId(source.id);
    const shareToken = source.shareToken || crypto.randomUUID().replaceAll("-", "");
    const published: SavedSeoReport = { ...source, shareToken, publishedAt: new Date().toISOString() };
    const payload: PublicSeoReportPayload = { report: published, settings };
    let localPublished = false;
    try {
      localStorage.setItem(`seo-public-report-${shareToken}`, JSON.stringify(payload));
      localPublished = true;
    } catch {
      notify("Bộ nhớ trình duyệt không đủ để mở báo cáo; đang thử tải bản cloud");
    }
    let cloudPublished = false;
    try {
      if (supabaseConfigured && supabase && projectId) {
        const { error } = await supabase.from("public_report_shares").upsert({ site_id: projectId, share_token: shareToken, payload, updated_at: new Date().toISOString() }, { onConflict: "share_token" });
        if (error) notify(`Chưa đăng công khai được: ${error.message}`);
        else cloudPublished = true;
      }
    } catch (error) {
      notify(error instanceof Error ? `Chưa đăng công khai được: ${error.message}` : "Chưa đăng công khai được báo cáo");
    }
    onSaveReports(savedReports.map(report => report.id === source.id ? published : report));
    const url = `${window.location.origin}/report/${shareToken}`;
    if (copyOnly) {
      await navigator.clipboard.writeText(url);
      notify(cloudPublished ? "Đã sao chép link công khai gửi khách" : "Đã sao chép link; cần bật cloud để khách mở trên thiết bị khác");
    } else if (localPublished || cloudPublished) {
      window.location.assign(url);
    } else {
      setOpeningReportId("");
      notify("Không thể mở báo cáo vì bản xem chưa được lưu. Hãy giảm dung lượng ảnh rồi thử lại.");
    }
  };
  const exportCsv = () => {
    const lines: (string | number)[][] = [[title], [settings.name, settings.domain], ["Từ ngày", from, "Đến ngày", to], ["Người lập", author], [], ["Chỉ số", "Giá trị"], ...metrics.map(item => [String(item[0]), String(item[1])]), [], ["Nhận xét tổng quan", summary], ["Nhận xét tháng này", monthlyReview], ["Kế hoạch tháng tới", nextPlan]];
    const csv = "\uFEFF" + lines.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); link.download = `bao-cao-seo-${from}-${to}.csv`; link.click(); URL.revokeObjectURL(link.href);
  };

  const renderSection = (section: SectionConfig) => {
    if (!section.enabled || !sectionHasData(section.key)) return null;
    const sectionIndex = visibleSections.findIndex(item => item.key === section.key);
    const sectionNumber = String((sectionIndex >= 0 ? sectionIndex : 0) + 1).padStart(2, "0");
    const badge = getSectionBadge(section.key);
    const wrapper = (content: React.ReactNode) => (
      <section className="report-document-section" key={section.key} id={`report-section-${section.key}`}>
        <div className="report-section-heading">
          <span>{sectionNumber}</span>
          <h2>
            {section.title}
            {badge && <span className="report-section-badge-count">{badge}</span>}
          </h2>
        </div>
        {content}
      </section>
    );

    if (section.key === "overview") return wrapper(
      <>
        <div className="report-kpi-grid">
          {metrics.map(([label, value]) => (
            <div key={String(label)}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
        <div className="report-narrative">
          {summary.split("\n").map((line, index) => <p key={index}>{line || <br />}</p>)}
        </div>

        {/* Bảng thống kê chi tiết khối lượng công việc theo trường thông tin */}
        <div className="report-field-breakdown-section">
          <div className="report-field-breakdown-head">
            <div>
              <h3 className="report-field-breakdown-title">
                <span>📊</span> Thống kê chi tiết khối lượng công việc theo trường thông tin
              </h3>
              <p className="report-field-breakdown-desc">
                Tổng hợp số lượng task, tỷ lệ hoàn thành và nhân sự phụ trách trên các trường phân hệ SEO trong kỳ
              </p>
            </div>
            <div className="report-field-grand-badge">
              <span>TỔNG CỘNG KHỐI LƯỢNG</span>
              <strong>{grandTotalWorkItems} task & hạng mục</strong>
            </div>
          </div>

          <div className="report-table-wrap">
            <table className="report-table report-field-task-table">
              <thead>
                <tr>
                  <th style={{ width: "38px", textAlign: "center" }}>STT</th>
                  <th>Trường thông tin / Phân hệ SEO</th>
                  <th style={{ textAlign: "center" }}>Tổng số lượng</th>
                  <th>Đã hoàn thành</th>
                  <th>Đang làm / Chờ xử lý</th>
                  <th style={{ width: "160px" }}>Tiến độ hoàn thành</th>
                  <th>Phụ trách</th>
                </tr>
              </thead>
              <tbody>
                {taskBreakdownRows.map((item, idx) => (
                  <tr key={item.key}>
                    <td style={{ textAlign: "center", color: "#8d99ab", fontWeight: 700 }}>{idx + 1}</td>
                    <td>
                      <div className="report-field-name">
                        <span className="report-field-icon">{item.icon}</span>
                        <div>
                          <b>{item.name}</b>
                          <small>{item.description}</small>
                        </div>
                      </div>
                    </td>
                    <td style={{ textAlign: "center", fontWeight: 800, fontSize: "14px", color: "var(--report-navy)" }}>
                      {item.total} {item.unit}
                    </td>
                    <td>
                      {item.done > 0 ? (
                        <span className="report-badge-done">
                          ✓ {item.done} {item.doneLabel || "hoàn thành"}
                        </span>
                      ) : (
                        <span className="report-badge-zero">0</span>
                      )}
                    </td>
                    <td>
                      {item.pending > 0 ? (
                        <span className="report-badge-pending">
                          ⏳ {item.pending} {item.pendingLabel || "đang xử lý"}
                        </span>
                      ) : (
                        <span className="report-badge-zero">—</span>
                      )}
                    </td>
                    <td>
                      <div className="report-progress-wrap">
                        <div className="report-progress-bar">
                          <div
                            className="report-progress-fill"
                            style={{
                              width: `${item.percentage}%`,
                              background: item.percentage >= 100 ? "#10b981" : item.percentage >= 50 ? "#3b82f6" : item.percentage > 0 ? "#f59e0b" : "#cbd5e1"
                            }}
                          />
                        </div>
                        <span className="report-progress-text">{item.percentage}%</span>
                      </div>
                    </td>
                    <td>
                      <span className="report-field-owners">{item.owners || "—"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="report-table-footer-total">
                  <td colSpan={2}>
                    <b>TỔNG CỘNG KHỐI LƯỢNG CÔNG VIỆC THỰC HIỆN</b>
                  </td>
                  <td style={{ textAlign: "center", fontWeight: 900, fontSize: "15px", color: "#1e3a8a" }}>
                    {grandTotalWorkItems} task
                  </td>
                  <td>
                    <b style={{ color: "#059669" }}>{grandTotalCompleted} hoàn tất</b>
                  </td>
                  <td>
                    <span style={{ color: grandTotalPending > 0 ? "#d97706" : "#64748b", fontWeight: 650 }}>
                      {grandTotalPending > 0 ? `${grandTotalPending} đang làm` : "0 tồn đọng"}
                    </span>
                  </td>
                  <td>
                    <div className="report-progress-wrap">
                      <div className="report-progress-bar">
                        <div
                          className="report-progress-fill"
                          style={{ width: `${overallPercent}%`, background: "#10b981" }}
                        />
                      </div>
                      <span className="report-progress-text">{overallPercent}%</span>
                    </div>
                  </td>
                  <td>—</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </>
    );
    if (section.key === "gsc") {
      const gscImgs = normalizeImages(gscImages);
      return wrapper(
        <>
          <div className="report-gsc-strip">
            <div><span>Clicks</span><b>{formatNumber(clicks)}</b></div>
            <div><span>Impressions</span><b>{formatNumber(impressions)}</b></div>
            <div><span>CTR</span><b>{ctr.toFixed(2)}%</b></div>
            <div><span>Vị trí TB</span><b>{avgPosition ? avgPosition.toFixed(1) : "—"}</b></div>
          </div>
          {gscImgs.length > 0 && (
            <div className="report-metric-gallery">
              <div className="report-metric-gallery-header">
                <h4><span>📊</span> Hình ảnh biểu đồ Google Search Console</h4>
                <span className="report-metric-gallery-badge">{gscImgs.length} hình ảnh</span>
              </div>
              <div className={`report-metric-image-grid ${gscImgs.length === 1 ? "single" : ""}`}>
                {gscImgs.map((img, idx) => (
                  <figure
                    key={idx}
                    className="report-metric-figure"
                    onClick={() => setActiveZoomImage({ url: img.url, title: img.caption || `Biểu đồ Search Console #${idx + 1}` })}
                  >
                    <div className="report-metric-img-wrap">
                      <img src={img.url} alt={img.caption || `Biểu đồ Search Console #${idx + 1}`} loading="lazy" />
                      <span className="report-img-zoom-btn">🔍 Phóng to</span>
                    </div>
                    {img.caption && (
                      <figcaption className="report-metric-caption">
                        {img.caption}
                      </figcaption>
                    )}
                  </figure>
                ))}
              </div>
            </div>
          )}
        </>
      );
    }
    if (section.key === "analytics") {
      const gaImgs = normalizeImages(analyticsImages);
      const channelTotal = gaChannelRows.reduce((sum, r) => sum + asNumber(r.sessions), 0) || 1;
      const channelRowsFormatted = gaChannelRows.map(row => ({
        ...row,
        sessionsDisplay: formatNumber(asNumber(row.sessions)),
        newUsersDisplay: formatNumber(asNumber(row.newUsers)),
        share: `${((asNumber(row.sessions) / channelTotal) * 100).toFixed(1)}%`
      }));
      return wrapper(
        <>
          <div className="report-gsc-strip">
            <div><span>Sessions (Phiên)</span><b>{formatNumber(gaSessions)}</b></div>
            <div><span>Total users</span><b>{formatNumber(gaUsers)}</b></div>
            <div><span>New users</span><b>{formatNumber(gaNewUsers)}</b></div>
            {gaViews > 0 && <div><span>Tổng lượt xem trang</span><b>{formatNumber(gaViews)}</b></div>}
            <div><span>Engagement rate</span><b>{gaEngagementRate.toFixed(2)}%</b></div>
            <div><span>Key events / Conversions</span><b>{formatNumber(gaConversions)}</b></div>
          </div>
          {gaImgs.length > 0 && (
            <div className="report-metric-gallery">
              <div className="report-metric-gallery-header">
                <h4><span>📈</span> Hình ảnh biểu đồ Google Analytics 4</h4>
                <span className="report-metric-gallery-badge">{gaImgs.length} hình ảnh</span>
              </div>
              <div className={`report-metric-image-grid ${gaImgs.length === 1 ? "single" : ""}`}>
                {gaImgs.map((img, idx) => (
                  <figure
                    key={idx}
                    className="report-metric-figure"
                    onClick={() => setActiveZoomImage({ url: img.url, title: img.caption || `Biểu đồ Google Analytics #${idx + 1}` })}
                  >
                    <div className="report-metric-img-wrap">
                      <img src={img.url} alt={img.caption || `Biểu đồ Google Analytics #${idx + 1}`} loading="lazy" />
                      <span className="report-img-zoom-btn">🔍 Phóng to</span>
                    </div>
                    {img.caption && (
                      <figcaption className="report-metric-caption">
                        {img.caption}
                      </figcaption>
                    )}
                  </figure>
                ))}
              </div>
            </div>
          )}
          {channelRowsFormatted.length > 0 && (
            <div style={{ marginTop: "18px" }}>
              <h4 style={{ margin: "0 0 10px", fontSize: "14px", color: "var(--report-navy)" }}>Phân tích traffic theo kênh (Channel Group)</h4>
              <Table
                rows={channelRowsFormatted}
                columns={[
                  { key: "channel", label: "Kênh traffic" },
                  { key: "sessionsDisplay", label: "Số phiên (Sessions)" },
                  { key: "share", label: "Tỷ trọng" },
                  { key: "newUsersDisplay", label: "Người dùng mới" },
                ]}
                baseDomain={settings.domain}
              />
            </div>
          )}
        </>
      );
    }
    if (section.key === "keywords") return wrapper(<Table rows={topQueries.map(row => ({ ...row, ctr: `${asNumber(row.ctr).toFixed(2)}%` }))} columns={[{ key: "keyword", label: "Từ khóa" }, { key: "page", label: "Trang đích" }, { key: "position", label: "Vị trí" }, { key: "clicks", label: "Clicks" }, { key: "impressions", label: "Hiển thị" }, { key: "ctr", label: "CTR" }]} baseDomain={settings.domain} />);
    if (section.key === "pages") {
      const totalPageViews = gaPageRows.reduce((sum, row) => sum + asNumber(row.views), 0) || 1;
      const gaPagesFormatted = gaPageRows.slice(0, 15).map((row, idx) => ({
        ...row,
        rank: `#${idx + 1}`,
        viewsDisplay: formatNumber(asNumber(row.views)),
        share: `${((asNumber(row.views) / totalPageViews) * 100).toFixed(1)}%`
      }));
      return wrapper(
        <>
          {gaPagesFormatted.length > 0 ? (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <h4 style={{ margin: 0, fontSize: "14px", color: "var(--report-navy)" }}>Top trang có lượt xem cao nhất (Google Analytics 4)</h4>
                <small style={{ color: "#748198", fontSize: "11px" }}>Ghi nhận {gaPageRows.length} trang · {formatNumber(totalPageViews)} lượt xem</small>
              </div>
              <Table
                rows={gaPagesFormatted}
                columns={[
                  { key: "rank", label: "STT" },
                  { key: "page", label: "Tiêu đề trang" },
                  { key: "viewsDisplay", label: "Số lượt xem (Views)" },
                  { key: "share", label: "Tỷ trọng (%)" },
                ]}
                baseDomain={settings.domain}
              />
            </div>
          ) : null}

          {topPages.length > 0 ? (
            <div style={{ marginTop: gaPagesFormatted.length > 0 ? "24px" : "0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <h4 style={{ margin: 0, fontSize: "14px", color: "var(--report-navy)" }}>Landing page nhận nhiều lượt nhấp tự nhiên (Google Search Console)</h4>
              </div>
              <Table
                rows={topPages}
                columns={[
                  { key: "page", label: "Landing page" },
                  { key: "clicks", label: "Clicks" },
                  { key: "impressions", label: "Hiển thị" },
                  { key: "position", label: "Vị trí TB" },
                  { key: "ctr", label: "CTR" },
                ]}
                baseDomain={settings.domain}
              />
            </div>
          ) : !gaPagesFormatted.length ? (
            <p className="report-empty">Không có dữ liệu trang trong kỳ báo cáo.</p>
          ) : null}
        </>
      );
    }
    if (section.key === "tasks") return wrapper(<Table rows={completedTasks} columns={[{ key: "title", label: "Công việc" }, { key: "group", label: "Nhóm" }, { key: "owner", label: "Phụ trách" }, { key: "completedDate", label: "Hoàn thành" }, { key: "actual", label: "Giờ" }, { key: "result", label: "Kết quả" }]} baseDomain={settings.domain} />);
    if (section.key === "worklogs") return wrapper(<><Table rows={snapshot.worklogs || []} columns={[{ key: "date", label: "Ngày" }, { key: "title", label: "Công việc" }, { key: "group", label: "Nhóm" }, { key: "owner", label: "Phụ trách" }, { key: "hours", label: "Giờ" }, { key: "result", label: "Kết quả" }]} baseDomain={settings.domain} /><EvidenceGallery rows={snapshot.worklogs || []} /></>);
    if (section.key === "content") return wrapper(<Table rows={snapshot.content || []} columns={[{ key: "topic", label: "Nội dung" }, { key: "keyword", label: "Từ khóa" }, { key: "url", label: "URL" }, { key: "owner", label: "Phụ trách" }, { key: "publishDate", label: "Ngày đăng" }, { key: "status", label: "Trạng thái" }]} baseDomain={settings.domain} />);
    if (section.key === "audits") return wrapper(<><Table rows={snapshot.audits || []} columns={[{ key: "issue", label: "Hạng mục" }, { key: "url", label: "URL" }, { key: "severity", label: "Mức độ" }, { key: "owner", label: "Xử lý" }, { key: "completed", label: "Hoàn tất" }, { key: "status", label: "Trạng thái" }]} baseDomain={settings.domain} /><BeforeAfterGallery rows={snapshot.audits || []} /></>);
    if (section.key === "indexing") return wrapper(<Table rows={snapshot.indexing || []} columns={[{ key: "url", label: "URL" }, { key: "type", label: "Loại" }, { key: "status", label: "Trạng thái" }, { key: "checked", label: "Kiểm tra" }, { key: "reason", label: "Lý do" }, { key: "action", label: "Hành động" }]} baseDomain={settings.domain} />);
    if (section.key === "backlinks") return wrapper(<Table rows={snapshot.backlinks || []} columns={[{ key: "domain", label: "Domain" }, { key: "targetUrl", label: "URL đích" }, { key: "anchor", label: "Anchor" }, { key: "owner", label: "Phụ trách" }, { key: "placed", label: "Ngày đặt" }, { key: "status", label: "Trạng thái" }]} baseDomain={settings.domain} />);
    if (section.key === "expenses") return wrapper(<><Table rows={snapshot.expenses || []} columns={[{ key: "date", label: "Ngày" }, { key: "category", label: "Hạng mục" }, { key: "description", label: "Nội dung" }, { key: "vendor", label: "Nhà cung cấp" }, { key: "amount", label: "Số tiền" }, { key: "status", label: "Trạng thái" }]} baseDomain={settings.domain} /><p className="report-total">Tổng chi phí: <b>{formatMoney((snapshot.expenses || []).reduce((sum, row) => sum + asNumber(row.amount), 0))}</b></p></>);
    if (section.key === "monthlyReview") return wrapper(<ReportNarrative text={monthlyReview} placeholder="Chưa có nhận xét tháng này." />);
    if (section.key === "nextPlan") return wrapper(<ReportNarrative text={nextPlan} placeholder="Chưa có kế hoạch tháng tới." />);
    return wrapper(<ReportNarrative text={notes} placeholder="Không có ghi chú bổ sung." />);
  };

  const floatingToc = visibleSections.length > 1 ? (
    <aside className="report-toc-widget print-hide" aria-label="Mục lục báo cáo">
      {!tocOpen ? (
        <button
          type="button"
          className="report-toc-toggle-button"
          onClick={() => setTocOpen(true)}
          title="Mở mục lục báo cáo"
        >
          <span className="report-toc-icon">📑</span>
          <span>Mục lục</span>
          <span className="report-toc-count">{visibleSections.length}</span>
        </button>
      ) : (
        <div className="report-toc-panel">
          <div className="report-toc-header">
            <div className="report-toc-title">
              <span style={{ fontSize: "16px" }}>📑</span>
              <div>
                <b>MỤC LỤC BÁO CÁO</b>
                <small>{visibleSections.length} mục có dữ liệu</small>
              </div>
            </div>
            <button
              type="button"
              className="report-toc-close"
              onClick={() => setTocOpen(false)}
              aria-label="Đóng mục lục"
              title="Đóng mục lục"
            >
              ✕
            </button>
          </div>
          <div className="report-toc-list">
            {visibleSections.map((section, idx) => {
              const isActive = activeSectionKey === section.key;
              return (
                <button
                  key={section.key}
                  type="button"
                  className={`report-toc-item ${isActive ? "active" : ""}`}
                  onClick={() => {
                    scrollToSection(section.key);
                  }}
                >
                  <span className="report-toc-badge">{String(idx + 1).padStart(2, "0")}</span>
                  <span className="report-toc-text">{section.title}</span>
                  {getSectionBadge(section.key) && (
                    <span className="report-toc-item-count">{getSectionBadge(section.key)}</span>
                  )}
                </button>
              );
            })}
            <button
              type="button"
              className="report-toc-item"
              onClick={scrollToSignatures}
            >
              <span className="report-toc-badge">✓</span>
              <span className="report-toc-text">Xác nhận & chữ ký</span>
              <span className="report-toc-item-count">2 bên ký</span>
            </button>
          </div>
          <div className="report-toc-footer">
            <button type="button" className="report-toc-action" onClick={scrollToTop}>
              ↑ Lên đầu trang
            </button>
            <button type="button" className="report-toc-action" onClick={() => setTocOpen(false)}>
              Thu gọn ▾
            </button>
          </div>
        </div>
      )}
    </aside>
  ) : null;

  const lightboxModal = activeZoomImage ? (
    <div className="report-lightbox-backdrop" onClick={() => setActiveZoomImage(null)}>
      <div className="report-lightbox-content" onClick={e => e.stopPropagation()}>
        <div className="report-lightbox-header">
          <b>{activeZoomImage.title}</b>
          <button type="button" onClick={() => setActiveZoomImage(null)}>✕</button>
        </div>
        <div className="report-lightbox-body">
          <img src={activeZoomImage.url} alt={activeZoomImage.title} />
        </div>
      </div>
    </div>
  ) : null;

  const reportDocument = <article className="report-document">
      <header className="report-cover"><div className="report-cover-mark">SEO</div><div><p>BÁO CÁO HIỆU SUẤT ĐỊNH KỲ</p><h1>{title}</h1><h2>{settings.name}</h2><a href={settings.domain.startsWith("http") ? settings.domain : `https://${settings.domain}`} target="_blank" rel="noopener noreferrer">{settings.domain}</a></div><dl><div><dt>Thời gian báo cáo</dt><dd>{formatDate(from)} – {formatDate(to)}</dd></div><div><dt>Người lập</dt><dd>{author || settings.owner}</dd></div><div><dt>Email</dt><dd>{settings.email || "—"}</dd></div><div><dt>Ngày tạo</dt><dd>{formatDateTime(createdAt, settings.timezone)}</dd></div><div><dt>Cập nhật / xuất bản</dt><dd>{formatDateTime(generatedAt, settings.timezone)}</dd></div></dl></header>
      {sections.map(renderSection)}
      <SignatureBlock signatures={signatures} timezone={settings.timezone} />
      <footer className="report-footer"><b>{settings.name}</b><span>{settings.domain} · Báo cáo được tạo lúc {formatDateTime(generatedAt, settings.timezone)}</span></footer>
    </article>;

  if (viewOnlyReport) return <div className="report-builder public-report-document">{floatingToc}{reportDocument}{lightboxModal}</div>;

  if (mode === "list") return <div className="report-builder">
    <section className="page-heading"><div><p className="eyebrow">SEO REPORT LIBRARY</p><h2>Báo cáo SEO</h2><p className="muted">Quản lý các báo cáo đã tạo, mở trang xem hoặc sao chép đường dẫn gửi khách hàng.</p></div><button className="primary" onClick={newReport}>＋ Tạo báo cáo mới</button></section>
    {savedReports.length ? <section className="report-library">{savedReports.map(report => <article className="report-library-card" key={report.id}><div className="report-library-icon">SEO</div><div className="report-library-copy"><span className={report.shareToken ? "report-publish-status published" : "report-publish-status"}>{report.shareToken ? "Đã có link chia sẻ" : "Bản nội bộ"}</span><h3>{report.title}</h3><p>{formatDate(report.from)} – {formatDate(report.to)}</p><small>Người lập: {report.author} · Cập nhật {formatDateTime(report.updatedAt, settings.timezone)}</small></div><div className="report-library-actions"><button className="primary" disabled={openingReportId === report.id} onClick={() => void publishReport(report)}>{openingReportId === report.id ? "Đang mở…" : "Xem"}</button><button className="secondary" onClick={() => loadReport(report)}>Sửa</button><button className="secondary" onClick={() => void publishReport(report, true)}>Sao chép link</button><button className="danger-button" onClick={() => void deleteReport(report.id)}>Xóa</button></div></article>)}</section> : <section className="report-library-empty panel"><div className="report-library-icon">SEO</div><h3>Chưa có báo cáo nào</h3><p>Tạo báo cáo đầu tiên, chọn nội dung cần hiển thị rồi lưu lại để xem hoặc gửi khách hàng.</p><button className="primary" onClick={newReport}>Tạo báo cáo đầu tiên</button></section>}
  </div>;

  return <div className="report-builder">
    <section className="page-heading print-hide"><div><p className="eyebrow">MONTHLY SEO REPORT BUILDER</p><h2>{editingId ? "Chỉnh sửa báo cáo" : "Tạo báo cáo mới"}</h2><p className="muted">Chọn nội dung, chỉnh sửa nhận xét và lưu báo cáo trước khi mở trang xem riêng.</p></div><div className="button-row"><button className="secondary" onClick={() => setMode("list")}>← Danh sách báo cáo</button><button className="secondary" onClick={() => document.getElementById("report-chart-images")?.scrollIntoView({ behavior: "smooth", block: "start" })}>Ảnh GSC / GA4</button><button className="secondary" onClick={exportCsv}>Xuất CSV</button></div></section>
    {(!rankings.length || !analytics.length) && <section className="report-data-notice panel print-hide"><div><b>Thiếu dữ liệu hiệu suất trong kỳ</b><p>{!rankings.length ? "Search Console chưa có dữ liệu. " : ""}{!analytics.length ? "Google Analytics chưa có dữ liệu." : ""} Bạn có thể nhập từng bản ghi hoặc tải file CSV, không cần kết nối tài khoản Google.</p></div><div className="button-row">{!rankings.length && <button className="secondary" onClick={() => onNavigate("rankings")}>Nhập dữ liệu GSC</button>}{!analytics.length && <button className="primary" onClick={() => onNavigate("analytics")}>Nhập traffic GA4</button>}</div></section>}
    <section className="report-composer panel print-hide">
      <div className="report-fields"><label className="wide"><span>Tên báo cáo</span><input value={title} onChange={event => setTitle(event.target.value)} /></label><label><span>Từ ngày</span><input type="date" value={from} onChange={event => { setFrom(event.target.value); setLoadedSnapshot(null); }} /></label><label><span>Đến ngày</span><input type="date" value={to} onChange={event => { setTo(event.target.value); setLoadedSnapshot(null); }} /></label><label><span>Người lập báo cáo</span><input value={author} onChange={event => setAuthor(event.target.value)} /></label></div>
      <div className="report-editor-grid"><div><div className="report-editor-title"><h3>Nội dung báo cáo</h3><small>Bật/tắt, đổi tên và sắp xếp từng mục</small></div><div className="report-section-list">{sections.map((section, index) => <div className={section.enabled ? "enabled" : ""} key={section.key}><input aria-label={`Hiển thị ${section.title}`} type="checkbox" checked={section.enabled} onChange={event => updateSection(index, { enabled: event.target.checked })} /><input value={section.title} onChange={event => updateSection(index, { title: event.target.value })} /><button disabled={index === 0} onClick={() => moveSection(index, -1)} aria-label="Đưa mục lên">↑</button><button disabled={index === sections.length - 1} onClick={() => moveSection(index, 1)} aria-label="Đưa mục xuống">↓</button></div>)}</div></div><div className="report-copy-editors"><label><span>Nhận xét tổng quan</span><textarea value={summary} onChange={event => setSummary(event.target.value)} /></label><label><span>Nhận xét tháng này</span><textarea value={monthlyReview} onChange={event => setMonthlyReview(event.target.value)} placeholder="Đánh giá kết quả, điểm nổi bật và vấn đề trong tháng…" /></label><label><span>Kế hoạch tháng tới</span><textarea value={nextPlan} onChange={event => setNextPlan(event.target.value)} /></label><label><span>Ghi chú / đề xuất</span><textarea value={notes} onChange={event => setNotes(event.target.value)} placeholder="Đề xuất ngân sách, nội dung cần khách hàng duyệt, rủi ro…" /></label></div></div>

      <section className="report-image-uploader-section" id="report-chart-images">
        <div className="report-editor-title">
          <div>
            <h3>Hình ảnh biểu đồ trực quan (Google Search Console & Google Analytics)</h3>
            <small>Tải ảnh chụp màn hình biểu đồ từ GSC và GA4 để hiển thị trực quan các chỉ số trong báo cáo</small>
          </div>
        </div>
        <div className="report-image-uploader-grid">
          <div className="report-image-uploader-card">
            <div className="report-image-uploader-head">
              <b><span>📊</span> Google Search Console ({gscImages.length} ảnh)</b>
              <span>Biểu đồ Clicks, Impressions, CTR</span>
            </div>
            <div className="report-image-uploader-actions">
              <label className="report-upload-btn">
                <span>{uploadingGsc ? "⏳ Đang tải ảnh…" : "📁 Tải ảnh từ máy"}</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  disabled={uploadingGsc}
                  onChange={e => { void handleUploadGsc(e.target.files); e.target.value = ""; }}
                />
              </label>
              <div className="report-url-input-row">
                <input
                  type="url"
                  placeholder="Hoặc dán URL ảnh GSC…"
                  value={gscUrlInput}
                  onChange={e => setGscUrlInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAddGscUrl(); } }}
                />
                <button type="button" onClick={handleAddGscUrl}>＋ Thêm</button>
              </div>
            </div>
            {gscImages.length > 0 && (
              <div className="report-image-item-list">
                {gscImages.map((img, idx) => (
                  <div key={idx} className="report-image-item-row">
                    <div
                      className="report-image-item-thumb"
                      title="Xem phóng to"
                      onClick={() => setActiveZoomImage({ url: img.url, title: img.caption || "Ảnh Search Console" })}
                    >
                      <img src={img.url} alt="Thumbnail" />
                    </div>
                    <input
                      type="text"
                      placeholder="Chú thích ảnh…"
                      value={img.caption || ""}
                      onChange={e => {
                        const val = e.target.value;
                        setGscImages(prev => prev.map((item, i) => i === idx ? { ...item, caption: val } : item));
                      }}
                    />
                    <button
                      type="button"
                      className="report-image-item-del"
                      title="Xóa ảnh"
                      onClick={() => setGscImages(prev => prev.filter((_, i) => i !== idx))}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="report-image-uploader-card">
            <div className="report-image-uploader-head">
              <b><span>📈</span> Google Analytics 4 ({analyticsImages.length} ảnh)</b>
              <span>Biểu đồ Traffic, Users, Kênh chuyển đổi</span>
            </div>
            <div className="report-image-uploader-actions">
              <label className="report-upload-btn">
                <span>{uploadingAnalytics ? "⏳ Đang tải ảnh…" : "📁 Tải ảnh từ máy"}</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  disabled={uploadingAnalytics}
                  onChange={e => { void handleUploadAnalytics(e.target.files); e.target.value = ""; }}
                />
              </label>
              <div className="report-url-input-row">
                <input
                  type="url"
                  placeholder="Hoặc dán URL ảnh GA4…"
                  value={analyticsUrlInput}
                  onChange={e => setAnalyticsUrlInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAddAnalyticsUrl(); } }}
                />
                <button type="button" onClick={handleAddAnalyticsUrl}>＋ Thêm</button>
              </div>
            </div>
            {analyticsImages.length > 0 && (
              <div className="report-image-item-list">
                {analyticsImages.map((img, idx) => (
                  <div key={idx} className="report-image-item-row">
                    <div
                      className="report-image-item-thumb"
                      title="Xem phóng to"
                      onClick={() => setActiveZoomImage({ url: img.url, title: img.caption || "Ảnh Google Analytics" })}
                    >
                      <img src={img.url} alt="Thumbnail" />
                    </div>
                    <input
                      type="text"
                      placeholder="Chú thích ảnh…"
                      value={img.caption || ""}
                      onChange={e => {
                        const val = e.target.value;
                        setAnalyticsImages(prev => prev.map((item, i) => i === idx ? { ...item, caption: val } : item));
                      }}
                    />
                    <button
                      type="button"
                      className="report-image-item-del"
                      title="Xóa ảnh"
                      onClick={() => setAnalyticsImages(prev => prev.filter((_, i) => i !== idx))}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="report-signature-editor"><div className="report-editor-title"><div><h3>Chữ ký xác nhận</h3><small>Tải ảnh chữ ký, nhập tên và đánh dấu hoàn tất cho từng bên</small></div></div><div className="report-signature-editor-grid">{(["freelancer", "reviewer"] as const).map(party => { const signature = signatures[party]; return <div className="report-signature-editor-card" key={party}><div className="report-signature-editor-head"><b>{signature.role}</b>{signature.verified && signature.name && signature.imageUrl && <span>✓ Đã xác nhận</span>}</div><label><span>Họ và tên</span><input value={signature.name} onChange={event => updateSignature(party, { name: event.target.value, verified: event.target.value ? signature.verified : false })} placeholder={party === "freelancer" ? "Tên Freelancer" : "Tên người kiểm duyệt"} /></label><label><span>Vai trò</span><input value={signature.role} onChange={event => updateSignature(party, { role: event.target.value })} /></label><div className="signature-upload-row"><div className="signature-upload-preview">{signature.imageUrl ? <img src={signature.imageUrl} alt={`Chữ ký ${signature.name || signature.role}`} /> : <span>Chưa có ảnh chữ ký</span>}</div><label className="secondary signature-upload-button">{uploadingSignature === party ? "Đang tải…" : "Tải ảnh chữ ký"}<input hidden disabled={Boolean(uploadingSignature)} type="file" accept="image/*" onChange={event => { void uploadSignature(party, event.target.files?.[0]); event.target.value = ""; }} /></label></div><label><span>Hoặc dán link ảnh chữ ký</span><input value={signature.imageUrl} onChange={event => updateSignature(party, { imageUrl: event.target.value, verified: event.target.value ? signature.verified : false })} placeholder="https://..." /></label><div className="signature-confirm-row"><label title={!signature.name || !signature.imageUrl ? "Cần nhập tên và tải ảnh chữ ký trước" : undefined}><input type="checkbox" disabled={!signature.name || !signature.imageUrl} checked={signature.verified} onChange={event => updateSignature(party, { verified: event.target.checked, signedAt: event.target.checked && !signature.signedAt ? today() : signature.signedAt })} /> Xác nhận đã ký hoàn tất</label><input aria-label={`Ngày ký của ${signature.role}`} type="date" value={signature.signedAt.slice(0, 10)} onChange={event => updateSignature(party, { signedAt: event.target.value, verified: Boolean(event.target.value && signature.name && signature.imageUrl) })} /></div></div>; })}</div></section>
      <div className="report-form-actions"><button className="secondary" onClick={refreshSuggestions}>Tạo lại gợi ý</button><button className="primary" onClick={() => void saveReport()}>{editingId ? "Cập nhật báo cáo" : "Lưu báo cáo"}</button></div>
    </section>
    <div className="report-preview-label print-hide"><span>XEM TRƯỚC</span><p>Bản xem trước chỉ hiển thị trong lúc tạo. Sau khi lưu, dùng nút “Xem” ở danh sách để mở trang gửi khách.</p></div>
    {floatingToc}
    {reportDocument}
    {lightboxModal}
  </div>;
}
