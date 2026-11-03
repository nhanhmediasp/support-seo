import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const code = ts.transpileModule(readFileSync(new URL("../lib/seo-periods.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const { monthPeriod, previousPeriod, validPeriod, vietnamToday, rowsInPeriod, gscMetrics, analyticsMetrics, comparisonMetrics, metricChange, planImport, reportRange, reportComparison } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
const september = { from: "2026-09-01", to: "2026-09-30" };
const october = { from: "2026-10-01", to: "2026-10-31" };
const row = (id, period, extra) => ({ id, date: period.to, periodStart: period.from, periodEnd: period.to, granularity: "period", ...extra });
const keyword = (id, period, clicks, extra = {}) => row(id, period, { keyword: "vận tải biển", page: "/dich-vu", clicks, impressions: clicks * 10, position: 8, ...extra });
const overview = (id, period, extra = {}) => row(id, period, { channel: "Tổng quan", sessions: 100, users: 80, views: 200, engagedSessions: 60, ...extra });

test("calendar months, leap years and year rollover retain full previous month", () => {
  assert.deepEqual(previousPeriod(october), september);
  assert.deepEqual(previousPeriod({ from: "2026-01-01", to: "2026-01-31" }), { from: "2025-12-01", to: "2025-12-31" });
  assert.deepEqual(previousPeriod({ from: "2024-03-01", to: "2024-03-31" }), { from: "2024-02-01", to: "2024-02-29" });
  assert.deepEqual(previousPeriod({ from: "2026-02-01", to: "2026-02-28" }), { from: "2026-01-01", to: "2026-01-31" });
  assert.equal(validPeriod({ from: "2026-02-30", to: "2026-03-01" }), false);
});
test("current month compares the same days, in Vietnam time", () => {
  assert.deepEqual(monthPeriod("2026-11", "2026-11-03"), { from: "2026-11-01", to: "2026-11-03" });
  assert.deepEqual(previousPeriod(monthPeriod("2026-11", "2026-11-03")), { from: "2026-10-01", to: "2026-10-03" });
  assert.equal(vietnamToday(new Date("2026-11-02T18:00:00Z")), "2026-11-03");
});
test("growth, decline, zero baseline, missing baseline and percentage points", () => {
  assert.equal(metricChange(1250, 1000).text, "+250 · +25%");
  assert.equal(metricChange(750, 1000).text, "-250 · -25%");
  assert.match(metricChange(10, 0).text, /Phát sinh mới/);
  assert.equal(metricChange(0, 0).tone, "neutral");
  assert.equal(metricChange(0, null).text, "Chưa đủ dữ liệu so sánh");
  assert.equal(metricChange(null, 0).text, "Chưa có dữ liệu");
  assert.equal(metricChange(3, 2, "percent").text, "+1 điểm phần trăm");
  assert.equal(metricChange(5, 8, "position").text, "Tăng 3 bậc");
  assert.equal(metricChange(5, 8, "position").tone, "positive");
  assert.equal(metricChange(8, 5, "position").tone, "negative");
});
test("aggregate totals cannot leak into a partial month", () => {
  const rows = [overview("a", october)];
  assert.equal(rowsInPeriod(rows, { from: "2026-10-01", to: "2026-10-03" }).length, 0);
  assert.equal(analyticsMetrics(rows, { from: "2026-10-01", to: "2026-10-03" }).sessions, null);
});
test("GSC uses daily totals, weighted position and total-based CTR without double counting keywords", () => {
  const days = [
    { id: "day1", date: "2026-10-01", gscSummary: true, clicks: 10, impressions: 100, position: 10 },
    { id: "day2", date: "2026-10-02", gscSummary: true, clicks: 0, impressions: 0, position: 0 },
    { id: "day3", date: "2026-10-03", gscSummary: true, clicks: 30, impressions: 300, position: 2 },
    keyword("k", { from: "2026-10-01", to: "2026-10-03" }, 35),
  ];
  const result = gscMetrics(days, { from: "2026-10-01", to: "2026-10-03" });
  assert.equal(result.clicks, 40); assert.equal(result.ctr, 10); assert.equal(result.position, 4); assert.equal(result.complete, true);
  assert.equal(gscMetrics(days.filter(r => r.id !== "day2"), { from: "2026-10-01", to: "2026-10-03" }).complete, false);
});
test("GA4 overview is authoritative, including zero, and users are never added across channels or months", () => {
  const rows = [overview("a", october, { sessions: 0 }), row("channel", october, { channel: "Direct", sessions: 50, users: 40 }), row("page", october, { channel: "Trang xem nhiều", page: "/", views: 50 })];
  assert.equal(analyticsMetrics(rows, october).sessions, 0);
  assert.equal(analyticsMetrics(rows, october).users, 80);
  assert.equal(analyticsMetrics(rows.filter(r => r.id !== "a"), october).users, null);
  assert.equal(analyticsMetrics([overview("a", october), overview("b", september)], { from: "2026-09-01", to: "2026-10-31" }).users, null);
});
test("percentages require complete comparable periods; legacy rows are preserved without invented monthly coverage", () => {
  const rows = [keyword("s", september, 1000), keyword("o", october, 1250)];
  const metric = comparisonMetrics("rankings", rows, october).find(r => r.key === "clicks");
  assert.equal(metric.previous, 1000);
  assert.equal(metricChange(metric.value, metric.previous).text, "+250 · +25%");
  const legacy = { id: "legacy", keyword: "old", date: "2026-09-30", clicks: 1000 };
  assert.equal(comparisonMetrics("rankings", [legacy, rows[1]], october)[0].previous, null);
  assert.equal(rowsInPeriod([legacy], september).length, 1);
});
test("GSC does not compare full site totals against query-only totals", () => {
  const result = comparisonMetrics("rankings", [keyword("s", september, 1000), row("summary", october, { gscSummary: true, clicks: 1250, impressions: 12500, position: 5 })], october);
  assert.equal(result[0].value, 1250);
  assert.equal(result[0].previous, null);
});
test("re-import replaces the entire matching dataset, removes vanished keywords and retains other months", () => {
  const existing = [keyword("s", september, 1000), keyword("o1", october, 100), keyword("o2", october, 200, { keyword: "vanished" })];
  const plan = planImport("rankings", existing, [keyword("new", october, 1250)], october, "October.csv");
  assert.equal(plan.replaced.length, 2); assert.equal(plan.preserved.length, 1);
  assert.equal(plan.preserved[0].id, "s"); assert.equal(plan.incoming[0].previous, 8);
  const repeated = planImport("rankings", [...plan.incoming, ...plan.preserved], [keyword("again", october, 1250)], october, "October.csv");
  assert.equal(repeated.incoming.length + repeated.preserved.length, 2);
  assert.equal(existing.length, 3);
});
test("GSC summary-only import preserves keywords; GA4 channel-only import preserves page and overview datasets", () => {
  const gsc = planImport("rankings", [keyword("k", october, 10)], [{ id: "d", date: "2026-10-01", gscSummary: true, clicks: 0, impressions: 0 }], october, "Dates.csv");
  assert.equal(gsc.preserved.length, 1);
  const ga = planImport("analytics", [overview("total", october), row("p", october, { channel: "Trang xem nhiều", page: "/" }), row("ch", october, { channel: "Direct", sessions: 10 })], [{ id: "new", channel: "Organic Search", sessions: 20 }], october, "Traffic.csv");
  assert.equal(ga.preserved.length, 2); assert.equal(ga.replaced.length, 1);
});
test("overlapping aggregate periods and out-of-period daily data cannot overwrite history", () => {
  assert.throws(() => planImport("analytics", [overview("a", october)], [overview("new", { from: "2026-10-01", to: "2026-10-03" })], { from: "2026-10-01", to: "2026-10-03" }, "partial.csv"), /chồng lấn/);
  assert.throws(() => planImport("rankings", [], [{ id: "a", gscSummary: true, date: "2026-09-30" }], october, "wrong.csv"), /ngoài kỳ/);
});
test("a growing month-to-date import may replace the shorter old period", () => {
  const oldPeriod = { from: "2026-10-01", to: "2026-10-03" };
  const newPeriod = { from: "2026-10-01", to: "2026-10-04" };
  const plan = planImport("analytics", [overview("old", oldPeriod)], [overview("new", newPeriod)], newPeriod, "update.csv");
  assert.equal(plan.replaced.length, 1);
  assert.equal(plan.incoming[0].periodEnd, "2026-10-04");
});
test("GA4 totals-only import retains other datasets while a full snapshot replaces them", () => {
  const existing = [overview("a", october), row("channel", october, { channel: "Direct" }), row("page", october, { channel: "Trang xem nhiều", page: "/" })];
  assert.equal(planImport("analytics", existing, [overview("b", october)], october, "overview.csv").preserved.length, 2);
  assert.equal(planImport("analytics", existing, [overview("b", october, { reportType: "snapshot" })], october, "snapshot.csv").preserved.length, 0);
});
test("duplicate rows deduplicate without collapsing case-sensitive URL paths", () => {
  const plan = planImport("rankings", [], [keyword("a", october, 10), keyword("b", october, 10), keyword("c", october, 10, { page: "/Dich-vu" })], october, "file.csv");
  assert.equal(plan.incoming.length, 2);
});
test("work KPI uses completion and publication dates; undated records never enter every month", () => {
  const data = { tasks: [{ id: "a", status: "Done", startDate: "2026-09-01", completedDate: "2026-10-02" }, { id: "b", status: "Done", startDate: "2026-09-01" }], content: [{ id: "c", status: "Published" }] };
  assert.equal(reportRange(data, october).tasks.length, 1);
  assert.equal(reportRange(data, september).tasks.length, 0);
  assert.equal(reportRange(data, october).content.length, 0);
});
test("serialized report snapshots freeze both current and baseline metrics independently of new imports", () => {
  const data = { rankings: [keyword("s", september, 1000), keyword("o", october, 1250)], analytics: [overview("s", september), overview("o", october, { sessions: 120 })] };
  const saved = JSON.parse(JSON.stringify({ snapshot: reportRange(data, october), comparisonSnapshot: reportRange(data, september) }));
  const before = reportComparison(saved.snapshot, saved.comparisonSnapshot, october);
  data.rankings[0].clicks = 0; data.rankings[1].clicks = 0; data.analytics[0].sessions = 9999;
  assert.deepEqual(reportComparison(saved.snapshot, saved.comparisonSnapshot, october), before);
  assert.equal(before.find(metric => metric.key === "rankings.clicks").previous, 1000);
});
