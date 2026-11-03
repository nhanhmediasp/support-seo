"use client";

import { Metric, metricChange, monthPeriod, Period, periodLabel, previousPeriod, vietnamToday } from "../lib/seo-periods";

export function MonthPicker({ month, onChange }: { month: string; onChange: (value: string) => void }) {
  const period = monthPeriod(month);
  return <div className="month-picker print-hide">
    <label>Tháng báo cáo<input aria-label="Tháng báo cáo" type="month" value={month} max={vietnamToday().slice(0, 7)} onChange={event => { if (/^\d{4}-(0[1-9]|1[0-2])$/.test(event.target.value)) onChange(event.target.value); }} /></label>
    <p><strong>{periodLabel(period)}</strong><span>So với {periodLabel(previousPeriod(period))}{period.to === vietnamToday() ? " · Cùng số ngày của tháng trước" : ""}</span></p>
  </div>;
}

export function MetricDelta({ metric }: { metric: Metric }) {
  const change = metricChange(metric.value, metric.previous, metric.kind, metric.digits);
  return <small className={`metric-delta ${change.tone}`}>{change.text}</small>;
}

export function MetricStrip({ metrics, label, showComparison = true }: { metrics: Metric[]; label: string; showComparison?: boolean }) {
  const format = (metric: Metric, value: number | null) => value === null ? "—" : `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: metric.digits ?? (metric.kind === "position" ? 1 : metric.kind === "percent" ? 2 : 0) }).format(value)}${metric.kind === "percent" ? "%" : ""}`;
  return <section className="period-metrics" aria-label={label}>{metrics.map(metric => <div className="period-metric" key={metric.key}>
    <span>{metric.label}</span><strong>{format(metric, metric.value)}</strong>{showComparison && <MetricDelta metric={metric} />}
    {showComparison && metric.previous !== null && <small className="metric-baseline">Kỳ trước: {format(metric, metric.previous)}</small>}
  </div>)}</section>;
}

export function ComparisonTable({ metrics, period, title = "So sánh KPI với tháng trước", targets, onTargetsChange }: { metrics: Metric[]; period: Period; title?: string; targets?: Record<string, number>; onTargetsChange?: (targets: Record<string, number>) => void }) {
  const format = (metric: Metric, value: number | null) => value === null ? "—" : `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: metric.digits ?? (metric.kind === "percent" ? 2 : metric.kind === "position" ? 1 : 0) }).format(value)}${metric.kind === "percent" ? "%" : ""}`;
  return <section className="comparison-section">
    <h3>{title}</h3><p className="comparison-period">{periodLabel(period)} so với {periodLabel(previousPeriod(period))}</p>
    <div className="comparison-table-wrap"><table className="comparison-table"><thead><tr><th>Chỉ số</th><th>Kỳ trước</th><th>Kỳ này</th><th>Thay đổi</th>{targets && <><th>Mục tiêu</th><th>Tỷ lệ đạt</th></>}</tr></thead><tbody>
      {metrics.map(metric => <tr key={metric.key}><th scope="row">{metric.label}</th><td>{format(metric, metric.previous)}</td><td>{format(metric, metric.value)}</td><td><MetricDelta metric={metric} /></td>{targets && <><td>{onTargetsChange ? <input aria-label={`Mục tiêu ${metric.label}`} type="number" min="0" step="any" value={targets[metric.key] ?? ""} onChange={event => { const next = { ...targets }; if (event.target.value === "") delete next[metric.key]; else if (Number.isFinite(Number(event.target.value)) && Number(event.target.value) >= 0) next[metric.key] = Number(event.target.value); onTargetsChange(next); }} /> : targets[metric.key] !== undefined ? format(metric, targets[metric.key]) : "—"}</td><td>{metric.value !== null && targets[metric.key] > 0 && (metric.kind !== "position" || metric.value > 0) ? `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format((metric.kind === "position" ? targets[metric.key] / metric.value : metric.value / targets[metric.key]) * 100)}%` : "—"}</td></>}</tr>)}
    </tbody></table></div>
    <p className="comparison-footnote">CTR và tỷ lệ tương tác so theo điểm phần trăm. Vị trí nhỏ hơn là tốt hơn. Chỉ tính mức thay đổi khi cả hai kỳ có đủ dữ liệu.</p>
  </section>;
}
