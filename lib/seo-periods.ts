export type SeoRow = Record<string, string | number | boolean> & { id: string };
export type Period = { from: string; to: string };
export type MetricValue = number | null;
export type Metric = { key: string; label: string; value: MetricValue; previous: MetricValue; kind?: "percent" | "position"; digits?: number };

export const vietnamToday = (now = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
const iso = (date: Date) => date.toISOString().slice(0, 10);
export const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && iso(new Date(value)) === value;
export const validPeriod = (period: Period) => validDate(period.from) && validDate(period.to) && period.from <= period.to;
const monthEnd = (month: string) => { const [year, part] = month.split("-").map(Number); return iso(new Date(Date.UTC(year, part, 0))); };
export function monthPeriod(month: string, today = vietnamToday()): Period {
  const safe = /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : today.slice(0, 7);
  return { from: `${safe}-01`, to: safe === today.slice(0, 7) ? today : monthEnd(safe) };
}
function shiftMonth(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const last = new Date(Date.UTC(year, month - 1, 0));
  return iso(new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), Math.min(day, last.getUTCDate()))));
}
export function previousPeriod(period: Period): Period {
  if (!validPeriod(period)) return period;
  const fullMonth = period.from.endsWith("-01") && period.to === monthEnd(period.from.slice(0, 7));
  const from = shiftMonth(period.from);
  return { from, to: fullMonth ? monthEnd(from.slice(0, 7)) : shiftMonth(period.to) };
}
export const periodLabel = ({ from, to }: Period) => `${from.split("-").reverse().join("/")} – ${to.split("-").reverse().join("/")}`;
export function rowPeriod(row: SeoRow): Period | null {
  const from = String(row.periodStart || row.date || "").slice(0, 10);
  const to = String(row.periodEnd || row.date || "").slice(0, 10);
  return validPeriod({ from, to }) ? { from, to } : null;
}
export const rowsInPeriod = (rows: SeoRow[], period: Period) => validPeriod(period) ? rows.filter(row => { const bounds = rowPeriod(row); return bounds && bounds.from >= period.from && bounds.to <= period.to; }) : [];
export const overlappingRows = (rows: SeoRow[], period: Period) => rows.filter(row => { const bounds = rowPeriod(row); return bounds && bounds.from <= period.to && bounds.to >= period.from; });
const sum = (rows: SeoRow[], key: string) => rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);
const hasField = (rows: SeoRow[], key: string) => rows.some(row => row[key] !== undefined && row[key] !== "");

// Coverage is explicit. A monthly total cannot stand in for three days of that month.
export function coversPeriod(rows: SeoRow[], period: Period): boolean {
  if (!validPeriod(period) || !rows.length) return false;
  const intervals = rows.flatMap(row => {
    if (!row.periodStart && row.gscSummary !== true && row.granularity !== "day") return [];
    const bounds = rowPeriod(row);
    return bounds ? [bounds] : [];
  }).sort((a, b) => a.from.localeCompare(b.from));
  let cursor = period.from;
  for (const bounds of intervals) {
    if (bounds.from > cursor) return false;
    if (bounds.to >= cursor) cursor = iso(new Date(Date.parse(bounds.to) + 86400000));
    if (cursor > period.to) return true;
  }
  return false;
}

export function gscMetrics(rows: SeoRow[], period?: Period) {
  const selected = period ? rowsInPeriod(rows, period) : rows;
  const summaries = selected.filter(row => row.gscSummary === true);
  const performance = summaries.length ? summaries : selected.filter(row => row.gscSummary !== true);
  const impressions = sum(performance, "impressions");
  const clicks = sum(performance, "clicks");
  const positioned = performance.filter(row => Number(row.position) > 0 && Number(row.impressions) > 0);
  const weight = sum(positioned, "impressions");
  const available = performance.length > 0;
  return {
    clicks: available ? clicks : null, impressions: available ? impressions : null,
    ctr: available ? (impressions ? clicks / impressions * 100 : 0) : null,
    position: weight ? positioned.reduce((total, row) => total + Number(row.position) * Number(row.impressions), 0) / weight : null,
    complete: period ? coversPeriod(performance, period) : available,
    basis: summaries.length ? "summary" : "queries",
  };
}

export function gscKeywordsForPeriod(rows: SeoRow[], period: Period): SeoRow[] {
  const grouped = new Map<string, SeoRow[]>();
  for (const row of rowsInPeriod(rows, period).filter(row => row.gscSummary !== true)) {
    const key = JSON.stringify([String(row.keyword || "").trim().toLowerCase(), String(row.page || "")]);
    grouped.set(key, [...(grouped.get(key) || []), row]);
  }
  return [...grouped.values()].map(group => {
    if (group.length === 1) return group[0];
    const totals = gscMetrics(group);
    return { ...group[0], clicks: totals.clicks || 0, impressions: totals.impressions || 0, ctr: totals.ctr || 0, position: totals.position || 0, date: period.to };
  });
}

export function analyticsMetrics(rows: SeoRow[], period?: Period) {
  const selected = period ? rowsInPeriod(rows, period) : rows;
  const overviews = selected.filter(row => row.channel === "Tổng quan");
  const channels = selected.filter(row => row.channel !== "Tổng quan" && row.channel !== "Trang xem nhiều" && !row.page);
  const pages = selected.filter(row => row.channel === "Trang xem nhiều" || Boolean(row.page));
  // Prefer one exact overview. Never add users across channels, pages or months.
  const exact = period ? overviews.find(row => row.periodStart === period.from && row.periodEnd === period.to) : overviews.length === 1 ? overviews[0] : undefined;
  const selectedOverview = exact || (overviews.length === 1 ? overviews[0] : undefined);
  const counts = overviews.length ? overviews : channels;
  const total = (key: string, source = counts): MetricValue => hasField(source, key) ? sum(source, key) : null;
  const overviewValue = (key: string): MetricValue => selectedOverview && hasField([selectedOverview], key) ? Number(selectedOverview[key]) || 0 : null;
  const sessions = total("sessions");
  const engaged = total("engagedSessions");
  const engagementRate = engaged !== null && sessions !== null && sessions > 0 ? engaged / sessions * 100 : overviewValue("engagementRate");
  return {
    sessions, users: overviewValue("users"), newUsers: total("newUsers"),
    views: total("views", overviews.length && hasField(overviews, "views") ? overviews : pages.filter(row => row.partialDataset !== true)),
    conversions: total("conversions"), engagementRate,
    complete: period ? coversPeriod(counts.length ? counts : pages, period) : selected.length > 0,
    channels, pages, overview: selectedOverview,
  };
}

export function metricChange(current: MetricValue, previous: MetricValue, kind?: Metric["kind"], digits = kind === "position" ? 1 : kind === "percent" ? 2 : 0) {
  if (current === null) return { text: "Chưa có dữ liệu", tone: "neutral" };
  if (previous === null) return { text: "Chưa đủ dữ liệu so sánh", tone: "neutral" };
  const format = (number: number) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: digits }).format(number);
  const delta = Number((current - previous).toFixed(digits));
  const sign = delta > 0 ? "+" : "";
  const tone = delta === 0 ? "neutral" : (kind === "position" ? delta < 0 : delta > 0) ? "positive" : "negative";
  if (kind === "position") return { text: delta === 0 ? "Không đổi" : `${delta < 0 ? "Tăng" : "Giảm"} ${format(Math.abs(delta))} bậc`, tone };
  if (kind === "percent") return { text: `${sign}${format(delta)} điểm phần trăm`, tone };
  if (previous === 0) return { text: current === 0 ? "Không đổi · 0%" : `+${format(current)} · Phát sinh mới`, tone };
  const percent = (current - previous) / previous * 100;
  return { text: `${sign}${format(delta)} · ${percent > 0 ? "+" : ""}${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(percent)}%`, tone };
}

export function comparisonMetrics(kind: "rankings" | "analytics", rows: SeoRow[], period: Period, previousRows = rows): Metric[] {
  const prior = previousPeriod(period);
  const current = kind === "rankings" ? gscMetrics(rows, period) : analyticsMetrics(rows, period);
  const previous = kind === "rankings" ? gscMetrics(previousRows, prior) : analyticsMetrics(previousRows, prior);
  const definitions: [string, string, Metric["kind"]?][] = kind === "rankings"
    ? [["clicks", "Clicks"], ["impressions", "Impressions"], ["ctr", "CTR", "percent"], ["position", "Vị trí trung bình", "position"]]
    : [["sessions", "Sessions (Phiên)"], ["users", "Người dùng"], ["newUsers", "Người dùng mới"], ["views", "Lượt xem trang"], ["conversions", "Chuyển đổi"], ["engagementRate", "Tỷ lệ tương tác", "percent"]];
  const values = current as unknown as Record<string, MetricValue>;
  const previousValues = previous as unknown as Record<string, MetricValue>;
  const sameBasis = kind !== "rankings" || (current as ReturnType<typeof gscMetrics>).basis === (previous as ReturnType<typeof gscMetrics>).basis;
  return definitions.map(([key, label, metricKind]) => ({ key, label, kind: metricKind, value: values[key], previous: current.complete && previous.complete && sameBasis ? previousValues[key] : null }));
}

export type ImportPlan = { incoming: SeoRow[]; preserved: SeoRow[]; replaced: SeoRow[]; period: Period; source: string; module: "rankings" | "analytics" };
export function planImport(module: ImportPlan["module"], existing: SeoRow[], incoming: SeoRow[], period: Period, source: string): ImportPlan {
  if (!validPeriod(period)) throw new Error("Khoảng ngày nhập không hợp lệ.");
  const batch = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const priorRows = module === "rankings" ? gscKeywordsForPeriod(existing, previousPeriod(period)) : rowsInPeriod(existing, previousPeriod(period));
  const prepared = incoming.map((row): SeoRow => {
    const daily = row.gscSummary === true || row.granularity === "day";
    if (daily && (!validDate(String(row.date)) || String(row.date) < period.from || String(row.date) > period.to)) throw new Error("Ngày dữ liệu trong file nằm ngoài kỳ nhập. Hãy kiểm tra lại khoảng ngày.");
    const bounds = row.periodStart && row.periodEnd ? rowPeriod(row) : null;
    if (bounds && (bounds.from < period.from || bounds.to > period.to)) throw new Error("Kỳ dữ liệu trong file nằm ngoài khoảng ngày nhập.");
    const prior = module === "rankings" ? priorRows.find(old => old.gscSummary !== true && String(old.keyword).trim().toLowerCase() === String(row.keyword).trim().toLowerCase() && String(old.page || "") === String(row.page || "")) : undefined;
    return { ...row, date: daily ? row.date : bounds?.to || period.to, periodStart: daily ? String(row.date) : bounds?.from || period.from, periodEnd: daily ? String(row.date) : bounds?.to || period.to, granularity: daily ? "day" : "period", importBatch: batch, source, ...(module === "rankings" && !daily ? { previous: prior?.position || "" } : {}) };
  });
  const kinds = new Set(prepared.map(row => module === "rankings" ? row.gscSummary === true ? "summary" : "keywords" : row.channel === "Tổng quan" ? "overview" : row.channel === "Trang xem nhiều" || row.page ? "pages" : "channels"));
  const fullGa = module === "analytics" && prepared.some(row => row.reportType === "snapshot");
  const replaced: SeoRow[] = [], preserved: SeoRow[] = [];
  for (const row of existing) {
    const bounds = rowPeriod(row);
    const rowKind = module === "rankings" ? row.gscSummary === true ? "summary" : "keywords" : row.channel === "Tổng quan" ? "overview" : row.channel === "Trang xem nhiều" || row.page ? "pages" : "channels";
    const overlaps = bounds && bounds.from <= period.to && bounds.to >= period.from;
    const sameDataset = fullGa || kinds.has(rowKind);
    // Refuse partial replacement of an existing aggregate; no prorating or silent loss.
    if (overlaps && sameDataset && row.granularity !== "day" && row.gscSummary !== true && row.periodStart && (bounds.from < period.from || bounds.to > period.to)) throw new Error("Kỳ nhập chồng lấn một bộ dữ liệu tổng hợp đã lưu. Hãy nhập lại đúng kỳ cũ hoặc dùng dữ liệu theo ngày.");
    (overlaps && sameDataset ? replaced : preserved).push(row);
  }
  const key = (row: SeoRow) => JSON.stringify([row.periodStart, row.periodEnd, row.gscSummary === true, String(row.keyword || "").trim().toLowerCase(), row.channel || "", row.page || ""]);
  const unique = [...new Map(prepared.map(row => [key(row), row])).values()];
  return { incoming: unique, preserved, replaced, period, source, module };
}

export const workDateKeys: Record<string, string[]> = {
  tasks: ["completedDate", "startDate"], worklogs: ["date", "occurredAt"], content: ["publishDate"], audits: ["completed", "found", "due"],
  indexing: ["checked", "submitted", "created"], backlinks: ["placed", "checked"], expenses: ["date"], onpage: ["checked"], entities: ["updated"], seeding: ["posted", "checked"],
};
export function workDate(module: string, row: SeoRow) {
  // Completion without a completion date must not be counted in the start month.
  const keys = module === "tasks" && row.status === "Done" ? ["completedDate"] : module === "audits" && row.status === "Done" ? ["completed"] : workDateKeys[module] || [];
  return keys.map(key => String(row[key] || "").slice(0, 10)).find(validDate) || "";
}
export function reportRange(data: Record<string, SeoRow[]>, period: Period): Record<string, SeoRow[]> {
  return Object.fromEntries(Object.entries(data).map(([module, rows]) => [module, module === "rankings" || module === "analytics" ? rowsInPeriod(rows, period) : rows.filter(row => { const date = workDate(module, row); return date && date >= period.from && date <= period.to; })]));
}

export function reportComparison(data: Record<string, SeoRow[]>, previous: Record<string, SeoRow[]>, period: Period): Metric[] {
  const performance = (["rankings", "analytics"] as const).flatMap(module => comparisonMetrics(module, data[module] || [], period, previous[module] || []).map(metric => ({ ...metric, key: `${module}.${metric.key}`, label: `${module === "rankings" ? "GSC" : "GA4"} · ${metric.label}` })));
  const count = (source: Record<string, SeoRow[]>, module: string, status?: string) => (source[module] || []).filter(row => !status || row.status === status).length;
  const work: Metric[] = [
    { key: "tasks.done", label: "Task hoàn thành", value: count(data, "tasks", "Done"), previous: previous.tasks?.length ? count(previous, "tasks", "Done") : null },
    { key: "content.published", label: "Bài đã đăng", value: count(data, "content", "Published"), previous: previous.content?.length ? count(previous, "content", "Published") : null },
    { key: "audits.done", label: "Lỗi đã xử lý", value: count(data, "audits", "Done"), previous: previous.audits?.length ? count(previous, "audits", "Done") : null },
    { key: "worklogs.hours", label: "Giờ làm việc", value: sum(data.worklogs || [], "hours"), previous: previous.worklogs?.length ? sum(previous.worklogs, "hours") : null, digits: 1 },
  ];
  return [...performance, ...work];
}

// Saved reports are explicit, user-selected totals, including legacy imports without period metadata.
export function mainReportMetrics(data: Record<string, SeoRow[]>): Metric[] {
  const gsc = gscMetrics(data.rankings || []);
  const ga = analyticsMetrics(data.analytics || []);
  const keywords = gscKeywordsForPeriod(data.rankings || [], { from: "1900-01-01", to: "2999-12-31" });
  const count = (module: string, status: string) => (data[module] || []).filter(row => row.status === status).length;
  const entries: [string, string, MetricValue, Metric["kind"]?][] = [
    ["rankings.clicks", "Organic clicks", gsc.clicks], ["rankings.impressions", "Impressions", gsc.impressions],
    ["rankings.ctr", "CTR", gsc.ctr, "percent"], ["rankings.position", "Vị trí trung bình", gsc.position, "position"],
    ["rankings.top3", "Từ khóa Top 3", keywords.length ? keywords.filter(row => Number(row.position) > 0 && Number(row.position) <= 3).length : null],
    ["rankings.top10", "Từ khóa Top 10", keywords.length ? keywords.filter(row => Number(row.position) > 0 && Number(row.position) <= 10).length : null],
    ["analytics.sessions", "GA4 Sessions", ga.sessions], ["analytics.users", "GA4 Users", ga.users],
    ["analytics.views", "GA4 Lượt xem trang", ga.views], ["analytics.conversions", "Chuyển đổi", ga.conversions],
    ["work.total", "Tổng mục công việc", ["tasks", "content", "audits", "indexing", "backlinks", "worklogs"].reduce((total, module) => total + (data[module] || []).length, 0)],
    ["tasks.done", "Công việc hoàn thành", count("tasks", "Done")], ["content.published", "Bài đã đăng", count("content", "Published")],
    ["audits.done", "Lỗi đã sửa", count("audits", "Done")], ["worklogs.hours", "Giờ làm việc", sum(data.worklogs || [], "hours")],
  ];
  return entries.map(([key, label, value, kind]) => ({ key, label, value, kind, previous: null, ...(key === "worklogs.hours" ? { digits: 1 } : {}) }));
}

export function compareReportSnapshots(current: Record<string, SeoRow[]>, baseline?: Record<string, SeoRow[]>): Metric[] {
  const previous = new Map((baseline ? mainReportMetrics(baseline) : []).map(metric => [metric.key, metric.value]));
  return mainReportMetrics(current).map(metric => ({ ...metric, previous: previous.get(metric.key) ?? null }));
}
