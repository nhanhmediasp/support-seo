"use client";

import { useEffect, useMemo, useState } from "react";

type Row = Record<string, string | number | boolean> & { id: string };
type ReportData = Record<string, Row[]>;
type ReportSettings = { name: string; domain: string; owner: string; email: string; timezone: string };
type SectionKey = "overview" | "gsc" | "keywords" | "pages" | "tasks" | "worklogs" | "content" | "audits" | "indexing" | "backlinks" | "expenses" | "nextPlan" | "notes";
type SectionConfig = { key: SectionKey; title: string; enabled: boolean };

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
  nextPlan: string;
  notes: string;
  snapshot: ReportData;
};

const sectionDefaults: SectionConfig[] = [
  { key: "overview", title: "Tổng quan kết quả", enabled: true },
  { key: "gsc", title: "Hiệu suất Google Search Console", enabled: true },
  { key: "keywords", title: "Từ khóa nổi bật", enabled: true },
  { key: "pages", title: "Landing page hiệu suất cao", enabled: true },
  { key: "tasks", title: "Công việc đã hoàn thành", enabled: true },
  { key: "worklogs", title: "Nhật ký triển khai", enabled: true },
  { key: "content", title: "Nội dung đã triển khai", enabled: true },
  { key: "audits", title: "Technical SEO & bằng chứng", enabled: true },
  { key: "indexing", title: "Tình trạng index", enabled: true },
  { key: "backlinks", title: "Backlink đã triển khai", enabled: true },
  { key: "expenses", title: "Chi phí phát sinh", enabled: false },
  { key: "nextPlan", title: "Kế hoạch tháng tới", enabled: true },
  { key: "notes", title: "Ghi chú & đề xuất", enabled: true },
];

const today = () => new Date().toISOString().slice(0, 10);
const firstDayOfMonth = () => `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`;
const uid = () => `REPORT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
const asText = (value: unknown) => String(value ?? "");
const asNumber = (value: unknown) => Number(value || 0);
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
    tasks: (data.tasks || []).filter(row => inRange(row.completedDate || row.startDate)),
    worklogs: (data.worklogs || []).filter(row => inRange(row.date || row.occurredAt)),
    content: (data.content || []).filter(row => inRange(row.publishDate)),
    audits: (data.audits || []).filter(row => inRange(row.completed || row.found || row.due)),
    indexing: (data.indexing || []).filter(row => inRange(row.checked || row.submitted || row.created)),
    backlinks: (data.backlinks || []).filter(row => inRange(row.placed || row.checked)),
    expenses: (data.expenses || []).filter(row => inRange(row.date)),
  };
}

function suggestedSummary(snapshot: ReportData) {
  const rankings = snapshot.rankings || [];
  const clicks = rankings.reduce((sum, row) => sum + asNumber(row.clicks), 0);
  const impressions = rankings.reduce((sum, row) => sum + asNumber(row.impressions), 0);
  const done = (snapshot.tasks || []).filter(row => asText(row.status) === "Done").length;
  const published = (snapshot.content || []).filter(row => asText(row.status) === "Published").length;
  const fixed = (snapshot.audits || []).filter(row => asText(row.status) === "Done").length;
  return `Trong kỳ, website ghi nhận ${formatNumber(clicks)} lượt nhấp và ${formatNumber(impressions)} lượt hiển thị tự nhiên. Đội ngũ đã hoàn thành ${done} công việc, xuất bản ${published} nội dung và xử lý ${fixed} hạng mục kỹ thuật. Các số liệu và bằng chứng chi tiết được trình bày ở các phần bên dưới.`;
}

function suggestedPlan(snapshot: ReportData) {
  const pendingAudit = (snapshot.audits || []).filter(row => asText(row.status) !== "Done").length;
  const pendingIndex = (snapshot.indexing || []).filter(row => asText(row.status) !== "Indexed").length;
  return `- Ưu tiên xử lý ${pendingAudit} hạng mục Technical SEO còn mở.\n- Theo dõi và cải thiện ${pendingIndex} URL chưa index.\n- Cập nhật nhóm nội dung có cơ hội tăng hạng và mở rộng internal link.\n- Tiếp tục theo dõi Search Console, thứ hạng và chuyển đổi theo tuần.`;
}

function Table({ rows, columns }: { rows: Row[]; columns: { key: string; label: string }[] }) {
  if (!rows.length) return <p className="report-empty">Không có dữ liệu trong kỳ báo cáo.</p>;
  return <div className="report-table-wrap"><table className="report-table"><thead><tr>{columns.map(column => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.id}>{columns.map(column => <td key={column.key}>{asText(row[column.key]) || "—"}</td>)}</tr>)}</tbody></table></div>;
}

function EvidenceGallery({ rows }: { rows: Row[] }) {
  const items = rows.flatMap(row => [
    ...imageLinks(row.imageUrl).map(url => ({ url, label: asText(row.title || row.description || row.id), type: "Ảnh công việc" })),
    ...imageLinks(row.beforeImages).map(url => ({ url, label: asText(row.issue || row.url || row.id), type: "Trước xử lý" })),
    ...imageLinks(row.afterImages).map(url => ({ url, label: asText(row.issue || row.url || row.id), type: "Sau xử lý" })),
  ]);
  if (!items.length) return <p className="report-empty">Không có ảnh bằng chứng trong kỳ báo cáo.</p>;
  return <div className="report-evidence-grid">{items.map((item, index) => <figure key={`${item.url}-${index}`}><img src={item.url} alt={`${item.type}: ${item.label}`} /><figcaption><b>{item.type}</b><span>{item.label}</span></figcaption></figure>)}</div>;
}

export default function ReportBuilder({ data, settings, savedReports, onSaveReports, notify }: { data: ReportData; settings: ReportSettings; savedReports: SavedSeoReport[]; onSaveReports: (reports: SavedSeoReport[]) => void; notify: (message: string) => void }) {
  const [from, setFrom] = useState(firstDayOfMonth());
  const [to, setTo] = useState(today());
  const [title, setTitle] = useState(`Báo cáo SEO tháng ${new Date().getMonth() + 1}/${new Date().getFullYear()}`);
  const [author, setAuthor] = useState(settings.owner);
  const [sections, setSections] = useState(sectionDefaults);
  const [summary, setSummary] = useState("");
  const [nextPlan, setNextPlan] = useState("");
  const [notes, setNotes] = useState("");
  const [editingId, setEditingId] = useState("");
  const [createdAt, setCreatedAt] = useState(new Date().toISOString());
  const [historyOpen, setHistoryOpen] = useState(false);
  const liveSnapshot = useMemo(() => rangeData(data, from, to), [data, from, to]);
  const [loadedSnapshot, setLoadedSnapshot] = useState<ReportData | null>(null);
  const snapshot = loadedSnapshot || liveSnapshot;

  useEffect(() => { if (!summary) setSummary(suggestedSummary(liveSnapshot)); }, []);
  useEffect(() => { if (!nextPlan) setNextPlan(suggestedPlan(liveSnapshot)); }, []);

  const rankings = snapshot.rankings || [];
  const clicks = rankings.reduce((sum, row) => sum + asNumber(row.clicks), 0);
  const impressions = rankings.reduce((sum, row) => sum + asNumber(row.impressions), 0);
  const ctr = impressions ? clicks / impressions * 100 : 0;
  const avgPosition = rankings.length ? rankings.reduce((sum, row) => sum + asNumber(row.position), 0) / rankings.length : 0;
  const completedTasks = (snapshot.tasks || []).filter(row => asText(row.status) === "Done");
  const hours = (snapshot.worklogs || []).reduce((sum, row) => sum + asNumber(row.hours), 0);
  const topQueries = [...rankings].sort((a, b) => asNumber(b.clicks) - asNumber(a.clicks)).slice(0, 10);
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
    ["Từ khóa Top 3", rankings.filter(row => asNumber(row.position) <= 3).length], ["Từ khóa Top 10", rankings.filter(row => asNumber(row.position) <= 10).length], ["Task hoàn thành", completedTasks.length], ["Giờ triển khai", `${hours}h`],
  ];
  const generatedAt = new Date().toISOString();

  const updateSection = (index: number, patch: Partial<SectionConfig>) => setSections(current => current.map((section, currentIndex) => currentIndex === index ? { ...section, ...patch } : section));
  const moveSection = (index: number, direction: -1 | 1) => setSections(current => {
    const target = index + direction;
    if (target < 0 || target >= current.length) return current;
    const next = [...current];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });
  const refreshSuggestions = () => { setSummary(suggestedSummary(liveSnapshot)); setNextPlan(suggestedPlan(liveSnapshot)); notify("Đã cập nhật gợi ý từ dữ liệu hiện tại"); };
  const newReport = () => {
    setEditingId(""); setLoadedSnapshot(null); setFrom(firstDayOfMonth()); setTo(today()); setTitle(`Báo cáo SEO tháng ${new Date().getMonth() + 1}/${new Date().getFullYear()}`); setAuthor(settings.owner); setSections(sectionDefaults); setSummary(suggestedSummary(rangeData(data, firstDayOfMonth(), today()))); setNextPlan(suggestedPlan(rangeData(data, firstDayOfMonth(), today()))); setNotes(""); setCreatedAt(new Date().toISOString());
  };
  const saveReport = () => {
    const now = new Date().toISOString();
    const report: SavedSeoReport = { id: editingId || uid(), title: title.trim() || "Báo cáo SEO", from, to, author: author.trim() || settings.owner, createdAt: editingId ? createdAt : now, updatedAt: now, sections, summary, nextPlan, notes, snapshot: liveSnapshot };
    const next = editingId ? savedReports.map(item => item.id === editingId ? report : item) : [report, ...savedReports].slice(0, 24);
    onSaveReports(next); setEditingId(report.id); setCreatedAt(report.createdAt); setLoadedSnapshot(report.snapshot); notify(editingId ? "Đã cập nhật bản báo cáo" : "Đã lưu bản báo cáo mới");
  };
  const loadReport = (report: SavedSeoReport) => {
    setEditingId(report.id); setTitle(report.title); setFrom(report.from); setTo(report.to); setAuthor(report.author); setSections(report.sections); setSummary(report.summary); setNextPlan(report.nextPlan); setNotes(report.notes); setCreatedAt(report.createdAt); setLoadedSnapshot(report.snapshot); setHistoryOpen(false); notify("Đã mở bản báo cáo đã lưu");
  };
  const deleteReport = (id: string) => {
    if (!window.confirm("Xóa bản báo cáo này?")) return;
    onSaveReports(savedReports.filter(report => report.id !== id));
    if (editingId === id) newReport();
    notify("Đã xóa bản báo cáo");
  };
  const exportCsv = () => {
    const lines: (string | number)[][] = [[title], [settings.name, settings.domain], ["Từ ngày", from, "Đến ngày", to], ["Người lập", author], [], ["Chỉ số", "Giá trị"], ...metrics.map(item => [String(item[0]), String(item[1])]), [], ["Nhận xét", summary]];
    const csv = "\uFEFF" + lines.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); link.download = `bao-cao-seo-${from}-${to}.csv`; link.click(); URL.revokeObjectURL(link.href);
  };

  const renderSection = (section: SectionConfig) => {
    if (!section.enabled) return null;
    const wrapper = (content: React.ReactNode) => <section className="report-document-section" key={section.key}><div className="report-section-heading"><span>{String(sections.filter(item => item.enabled).findIndex(item => item.key === section.key) + 1).padStart(2, "0")}</span><h2>{section.title}</h2></div>{content}</section>;
    if (section.key === "overview") return wrapper(<><div className="report-kpi-grid">{metrics.map(([label, value]) => <div key={String(label)}><span>{label}</span><strong>{value}</strong></div>)}</div><div className="report-narrative">{summary.split("\n").map((line, index) => <p key={index}>{line || <br />}</p>)}</div></>);
    if (section.key === "gsc") return wrapper(<div className="report-gsc-strip"><div><span>Clicks</span><b>{formatNumber(clicks)}</b></div><div><span>Impressions</span><b>{formatNumber(impressions)}</b></div><div><span>CTR</span><b>{ctr.toFixed(2)}%</b></div><div><span>Vị trí TB</span><b>{avgPosition ? avgPosition.toFixed(1) : "—"}</b></div></div>);
    if (section.key === "keywords") return wrapper(<Table rows={topQueries.map(row => ({ ...row, ctr: `${asNumber(row.ctr).toFixed(2)}%` }))} columns={[{ key: "keyword", label: "Từ khóa" }, { key: "page", label: "Trang đích" }, { key: "position", label: "Vị trí" }, { key: "clicks", label: "Clicks" }, { key: "impressions", label: "Hiển thị" }, { key: "ctr", label: "CTR" }]} />);
    if (section.key === "pages") return wrapper(<Table rows={topPages} columns={[{ key: "page", label: "Landing page" }, { key: "clicks", label: "Clicks" }, { key: "impressions", label: "Hiển thị" }, { key: "position", label: "Vị trí TB" }, { key: "ctr", label: "CTR" }]} />);
    if (section.key === "tasks") return wrapper(<Table rows={completedTasks} columns={[{ key: "title", label: "Công việc" }, { key: "group", label: "Nhóm" }, { key: "owner", label: "Phụ trách" }, { key: "completedDate", label: "Hoàn thành" }, { key: "actual", label: "Giờ" }, { key: "result", label: "Kết quả" }]} />);
    if (section.key === "worklogs") return wrapper(<><Table rows={snapshot.worklogs || []} columns={[{ key: "date", label: "Ngày" }, { key: "title", label: "Công việc" }, { key: "group", label: "Nhóm" }, { key: "owner", label: "Phụ trách" }, { key: "hours", label: "Giờ" }, { key: "result", label: "Kết quả" }]} /><EvidenceGallery rows={snapshot.worklogs || []} /></>);
    if (section.key === "content") return wrapper(<Table rows={snapshot.content || []} columns={[{ key: "topic", label: "Nội dung" }, { key: "keyword", label: "Từ khóa" }, { key: "url", label: "URL" }, { key: "owner", label: "Phụ trách" }, { key: "publishDate", label: "Ngày đăng" }, { key: "status", label: "Trạng thái" }]} />);
    if (section.key === "audits") return wrapper(<><Table rows={snapshot.audits || []} columns={[{ key: "issue", label: "Hạng mục" }, { key: "url", label: "URL" }, { key: "severity", label: "Mức độ" }, { key: "owner", label: "Xử lý" }, { key: "completed", label: "Hoàn tất" }, { key: "status", label: "Trạng thái" }]} /><EvidenceGallery rows={snapshot.audits || []} /></>);
    if (section.key === "indexing") return wrapper(<Table rows={snapshot.indexing || []} columns={[{ key: "url", label: "URL" }, { key: "type", label: "Loại" }, { key: "status", label: "Trạng thái" }, { key: "checked", label: "Kiểm tra" }, { key: "reason", label: "Lý do" }, { key: "action", label: "Hành động" }]} />);
    if (section.key === "backlinks") return wrapper(<Table rows={snapshot.backlinks || []} columns={[{ key: "domain", label: "Domain" }, { key: "targetUrl", label: "URL đích" }, { key: "anchor", label: "Anchor" }, { key: "owner", label: "Phụ trách" }, { key: "placed", label: "Ngày đặt" }, { key: "status", label: "Trạng thái" }]} />);
    if (section.key === "expenses") return wrapper(<><Table rows={snapshot.expenses || []} columns={[{ key: "date", label: "Ngày" }, { key: "category", label: "Hạng mục" }, { key: "description", label: "Nội dung" }, { key: "vendor", label: "Nhà cung cấp" }, { key: "amount", label: "Số tiền" }, { key: "status", label: "Trạng thái" }]} /><p className="report-total">Tổng chi phí: <b>{formatMoney((snapshot.expenses || []).reduce((sum, row) => sum + asNumber(row.amount), 0))}</b></p></>);
    if (section.key === "nextPlan") return wrapper(<div className="report-narrative">{nextPlan.split("\n").map((line, index) => <p key={index}>{line || <br />}</p>)}</div>);
    return wrapper(<div className="report-narrative">{notes ? notes.split("\n").map((line, index) => <p key={index}>{line || <br />}</p>) : <p>Không có ghi chú bổ sung.</p>}</div>);
  };

  return <div className="report-builder">
    <section className="page-heading print-hide"><div><p className="eyebrow">MONTHLY SEO REPORT BUILDER</p><h2>Tạo báo cáo SEO</h2><p className="muted">Chọn nội dung, chỉnh sửa nhận xét, lưu phiên bản và xuất bản báo cáo có đầy đủ ảnh bằng chứng.</p></div><div className="button-row"><button className="secondary" onClick={newReport}>Tạo bản mới</button><button className="secondary" onClick={() => setHistoryOpen(value => !value)}>Bản đã lưu ({savedReports.length})</button><button className="secondary" onClick={exportCsv}>Xuất CSV</button><button className="primary" onClick={() => window.print()}>In / Lưu PDF</button></div></section>

    {historyOpen && <section className="report-history panel print-hide"><div className="panel-title"><h3>Các phiên bản báo cáo</h3><button onClick={() => setHistoryOpen(false)}>Đóng</button></div>{savedReports.length ? <div className="report-history-list">{savedReports.map(report => <div key={report.id}><span><b>{report.title}</b><small>{formatDate(report.from)} – {formatDate(report.to)} · cập nhật {formatDateTime(report.updatedAt, settings.timezone)}</small></span><span><button className="secondary" onClick={() => loadReport(report)}>Mở & sửa</button><button className="danger-button" onClick={() => deleteReport(report.id)}>Xóa</button></span></div>)}</div> : <p className="report-empty">Chưa có bản báo cáo nào được lưu.</p>}</section>}

    <section className="report-composer panel print-hide">
      <div className="report-fields"><label className="wide"><span>Tên báo cáo</span><input value={title} onChange={event => setTitle(event.target.value)} /></label><label><span>Từ ngày</span><input type="date" value={from} onChange={event => { setFrom(event.target.value); setLoadedSnapshot(null); }} /></label><label><span>Đến ngày</span><input type="date" value={to} onChange={event => { setTo(event.target.value); setLoadedSnapshot(null); }} /></label><label><span>Người lập báo cáo</span><input value={author} onChange={event => setAuthor(event.target.value)} /></label></div>
      <div className="report-editor-grid"><div><div className="report-editor-title"><h3>Nội dung báo cáo</h3><small>Bật/tắt, đổi tên và sắp xếp từng mục</small></div><div className="report-section-list">{sections.map((section, index) => <div className={section.enabled ? "enabled" : ""} key={section.key}><input aria-label={`Hiển thị ${section.title}`} type="checkbox" checked={section.enabled} onChange={event => updateSection(index, { enabled: event.target.checked })} /><input value={section.title} onChange={event => updateSection(index, { title: event.target.value })} /><button disabled={index === 0} onClick={() => moveSection(index, -1)} aria-label="Đưa mục lên">↑</button><button disabled={index === sections.length - 1} onClick={() => moveSection(index, 1)} aria-label="Đưa mục xuống">↓</button></div>)}</div></div><div className="report-copy-editors"><label><span>Nhận xét tổng quan</span><textarea value={summary} onChange={event => setSummary(event.target.value)} /></label><label><span>Kế hoạch tháng tới</span><textarea value={nextPlan} onChange={event => setNextPlan(event.target.value)} /></label><label><span>Ghi chú / đề xuất</span><textarea value={notes} onChange={event => setNotes(event.target.value)} placeholder="Đề xuất ngân sách, nội dung cần khách hàng duyệt, rủi ro…" /></label><div className="button-row"><button className="secondary" onClick={refreshSuggestions}>Tạo lại gợi ý</button><button className="primary" onClick={saveReport}>{editingId ? "Cập nhật báo cáo" : "Lưu báo cáo"}</button></div></div></div>
    </section>

    <article className="report-document">
      <header className="report-cover"><div className="report-cover-mark">SEO</div><div><p>BÁO CÁO HIỆU SUẤT ĐỊNH KỲ</p><h1>{title}</h1><h2>{settings.name}</h2><a href={settings.domain}>{settings.domain}</a></div><dl><div><dt>Thời gian báo cáo</dt><dd>{formatDate(from)} – {formatDate(to)}</dd></div><div><dt>Người lập</dt><dd>{author || settings.owner}</dd></div><div><dt>Email</dt><dd>{settings.email || "—"}</dd></div><div><dt>Ngày tạo</dt><dd>{formatDateTime(createdAt, settings.timezone)}</dd></div><div><dt>Cập nhật / xuất bản</dt><dd>{formatDateTime(generatedAt, settings.timezone)}</dd></div></dl></header>
      {sections.map(renderSection)}
      <footer className="report-footer"><b>{settings.name}</b><span>{settings.domain} · Báo cáo được tạo lúc {formatDateTime(generatedAt, settings.timezone)}</span></footer>
    </article>
  </div>;
}
