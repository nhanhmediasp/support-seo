"use client";

import { ReactNode, useEffect, useMemo, useRef, useState } from "react";

const paths: Record<string, ReactNode> = {
  dashboard: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
  tasks: <><path d="m9 11 3 3 8-8" /><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" /></>,
  content: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></>,
  worklogs: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  personnel: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c2 .7 3.2 2.4 3.5 5.2" /></>,
  expenses: <><rect x="2.5" y="6" width="19" height="13" rx="2" /><path d="M2.5 10.5h19M6.5 15h3" /></>,
  onpage: <><path d="M4 5h16M4 10h10M4 15h16M4 20h8" /></>,
  audits: <><path d="M12 3 4 6v6c0 4.5 3.2 7.6 8 9 4.8-1.4 8-4.5 8-9V6z" /><path d="m9 12 2 2 4-4" /></>,
  indexing: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5M8.5 11l2 2 3-3.5" /></>,
  backlinks: <><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" /><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" /></>,
  entities: <><circle cx="12" cy="12" r="3" /><circle cx="5" cy="6" r="2" /><circle cx="19" cy="6" r="2" /><circle cx="12" cy="20" r="2" /><path d="m6.5 7.5 3.3 3M17.5 7.5l-3.3 3M12 15v3" /></>,
  seeding: <><path d="M12 21v-9" /><path d="M12 12c0-4 2.5-6.5 7-6.5 0 4-2.5 6.5-7 6.5Z" /><path d="M12 14c0-3-2-5-6-5 0 3 2 5 6 5Z" /></>,
  rankings: <><path d="M3 20h18" /><path d="M6 20v-7M11 20V8M16 20v-5M21 20V4" /></>,
  analytics: <><path d="M3 3v18h18" /><path d="m7 15 4-5 3 3 5-7" /></>,
  reports: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 17v-3M12 17v-5M15 17v-2" /></>,
  changes: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 8v4l3 2" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  panel: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /></>,
  bolt: <><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></>,
  arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  up: <><path d="m6 15 6-6 6 6" /></>,
};

export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return <svg className="ico" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] ?? paths.dashboard}</svg>;
}

export function Ring({ value, size = 56, label }: { value: number; size?: number; label?: string }) {
  const r = (size - 8) / 2, c = 2 * Math.PI * r, pct = Math.max(0, Math.min(100, value));
  return <div className="ring" style={{ width: size, height: size }}><svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}><circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ring-track)" strokeWidth="6" /><circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#ringGrad)" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(pct / 100) * c} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} /><defs><linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8b8bf8" /><stop offset="1" stopColor="#4f46e5" /></linearGradient></defs></svg><b>{label ?? `${Math.round(pct)}%`}</b></div>;
}

export function Donut({ parts }: { parts: { label: string; value: number; color: string }[] }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  const r = 46, c = 2 * Math.PI * r;
  let offset = 0;
  return <div className="donut-wrap"><div className="donut"><svg width="132" height="132" viewBox="0 0 120 120"><circle cx="60" cy="60" r={r} fill="none" stroke="var(--ring-track)" strokeWidth="14" />{total > 0 && parts.map(p => { const len = (p.value / total) * c; const el = <circle key={p.label} cx="60" cy="60" r={r} fill="none" stroke={p.color} strokeWidth="14" strokeDasharray={`${Math.max(0, len - 2)} ${c}`} strokeDashoffset={-offset} transform="rotate(-90 60 60)" />; offset += len; return el; })}</svg><div><b>{total}</b><small>Tổng task</small></div></div><ul>{parts.map(p => <li key={p.label}><i style={{ background: p.color }} />{p.label}<b>{p.value}</b></li>)}</ul></div>;
}

export function Sparkline({ values, color = "#5b5bf0" }: { values: number[]; color?: string }) {
  const w = 120, h = 36, max = Math.max(...values, 1), min = Math.min(...values, 0);
  const pts = values.map((v, i) => [(i / Math.max(values.length - 1, 1)) * w, h - 4 - ((v - min) / Math.max(max - min, 1)) * (h - 8)]);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const id = `sp${color.replace("#", "")}`;
  return <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none"><defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".28" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs><path d={`${line} L${w} ${h} L0 ${h}Z`} fill={`url(#${id})`} /><path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export type PaletteItem = { key: string; label: string; group: string };

export function CommandPalette({ items, onPick, onClose }: { items: PaletteItem[]; onPick: (key: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").toLowerCase();
  const results = useMemo(() => { const q = norm(query.trim()); return q ? items.filter(item => norm(`${item.label} ${item.group}`).includes(q)) : items; }, [items, query]);
  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { setIndex(0); }, [query]);
  const onKey = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") { event.preventDefault(); setIndex(i => Math.min(i + 1, results.length - 1)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setIndex(i => Math.max(i - 1, 0)); }
    else if (event.key === "Enter" && results[index]) onPick(results[index].key);
    else if (event.key === "Escape") onClose();
  };
  return <div className="palette-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="palette" role="dialog" aria-modal="true" aria-label="Tìm nhanh" onKeyDown={onKey}>
      <div className="palette-input"><Icon name="search" /><input ref={inputRef} value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm trang hoặc module… (vd: backlink, báo cáo)" /><kbd>Esc</kbd></div>
      <div className="palette-list">{results.length ? results.map((item, i) => <button key={item.key} className={i === index ? "active" : ""} onMouseEnter={() => setIndex(i)} onClick={() => onPick(item.key)}><span className="palette-ico"><Icon name={item.key} size={16} /></span><b>{item.label}</b><small>{item.group}</small><Icon name="arrow" size={14} /></button>) : <p className="palette-empty">Không tìm thấy kết quả</p>}</div>
      <div className="palette-foot"><span><kbd>↑</kbd><kbd>↓</kbd> chọn</span><span><kbd>↵</kbd> mở</span><span><kbd>Esc</kbd> đóng</span></div>
    </div>
  </div>;
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return <div className="empty-state"><span className="empty-ico"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M9 13h6" /></svg></span><b>{title}</b>{hint && <p>{hint}</p>}</div>;
}
