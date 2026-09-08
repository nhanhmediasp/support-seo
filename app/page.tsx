"use client";

import { ChangeEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { localModeAllowed, Project, supabase, supabaseConfigured } from "../lib/supabase";

type Row = Record<string, string | number | boolean> & { id: string };
type Field = { key: string; label: string; type?: "text" | "number" | "date" | "select" | "textarea" | "checkbox"; options?: string[]; required?: boolean };
type ModuleKey = "tasks" | "content" | "calendar" | "onpage" | "audits" | "indexing" | "backlinks" | "entities" | "seeding" | "rankings" | "worklogs" | "changes" | "personnel";
type SiteSettings = { name: string; domain: string; owner: string; email: string; timezone: string };
type AppData = Record<ModuleKey, Row[]>;
type ConfirmConfig = { eyebrow: string; title: string; description: string; confirmLabel: string; danger?: boolean; onConfirm: () => void };

const today = () => new Date().toISOString().slice(0, 10);
const uid = (prefix: string) => `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
const slugify = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const csvEscape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const parseCsvLine = (line: string) => {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"' && quoted) { value += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { values.push(value.trim()); value = ""; }
    else value += char;
  }
  values.push(value.trim());
  return values;
};
const normalizeCsvHeader = (value: string) => value.replace(/^\uFEFF/, "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
const csvNumber = (value: string) => Number(String(value || "").replace(/%/g, "").replace(/,/g, ".").replace(/\s/g, "")) || 0;
const parseStored = <T,>(value: string | null, fallback: T): T => { try { return value ? JSON.parse(value) as T : fallback; } catch { return fallback; } };
const normalizeDomain = (value: string) => value.trim().toLowerCase().replace(/\/$/, "");

const defaultSettings: SiteSettings = { name: "Air & Sea Global", domain: "https://airandseaglobal.vn", owner: "SEO Freelancer", email: "", timezone: "Asia/Ho_Chi_Minh" };

const seedData: AppData = {
  tasks: [
    { id: "TASK-001", title: "Audit technical toàn site", group: "Technical", priority: "High", status: "In progress", startDate: "2026-09-08", owner: "SEO Freelancer", estimated: 6, actual: 2, url: "https://airandseaglobal.vn", result: "" },
    { id: "TASK-002", title: "Viết bài visa Singapore", group: "Content", priority: "High", status: "Review", startDate: "2026-09-07", owner: "SEO Freelancer", estimated: 4, actual: 3, url: "", result: "Đã hoàn thiện bản nháp" },
  ],
  content: [
    { id: "CONTENT-001", topic: "Dịch vụ visa Singapore trọn gói", keyword: "visa Singapore", secondary: "xin visa Singapore, hồ sơ visa Singapore", intent: "Commercial", funnel: "BOFU", cluster: "Visa Singapore", pillar: "", owner: "SEO Freelancer", status: "Published", deadline: "2026-09-05", publishDate: "2026-09-05", priority: "High", volume: 2400, difficulty: 42, business: 9, relevance: 10, potential: 8, score: 85, url: "/dich-vu-visa-singapore", notes: "" },
  ],
  calendar: [{ id: "CAL-001", date: "2026-09-10", title: "Kinh nghiệm xin visa Úc tự túc", keyword: "visa Úc tự túc", url: "/blog/visa-uc-tu-tuc", channel: "Website", status: "Review", owner: "SEO Freelancer", approved: "", campaign: "SEO Visa" }],
  onpage: [{ id: "ONPAGE-001", url: "/dich-vu-visa-singapore", https: true, canonical: true, indexable: true, title: true, meta: true, h1: true, headings: true, intent: true, internal: true, external: true, alt: true, schema: true, mobile: true, score: 100, missing: "" }],
  audits: [{ id: "AUDIT-001", url: "/blog/visa-singapore", category: "Canonical", issue: "Canonical chưa trỏ đúng URL", severity: "High", affected: 1, value: 10, impact: 30, resolution: "Cập nhật canonical tự tham chiếu", owner: "SEO Freelancer", due: "2026-09-09", status: "Open", found: "2026-09-07", completed: "", evidence: "" }],
  indexing: [{ id: "INDEX-001", url: "/blog/visa-singapore", type: "Article", created: "2026-09-05", submitted: "2026-09-05", checked: "2026-09-07", status: "Crawled - not indexed", reason: "Chưa đủ tín hiệu chất lượng", action: "Bổ sung internal link", next: "2026-09-10", priority: "High" }],
  backlinks: [{ id: "BL-001", domain: "dulichviet.vn", sourceUrl: "https://dulichviet.vn/visa", targetUrl: "/dich-vu-visa-uc", anchor: "dịch vụ visa Úc", linkType: "Dofollow", topic: "Du lịch", authority: 72, relevance: 22, trust: 18, placement: 14, natural: 14, traffic: 12, stability: 9, score: 89, status: "Live", placed: "2026-09-02", checked: "2026-09-07" }],
  entities: [{ id: "ENTITY-001", name: "Air & Sea Global Google Business", type: "Google Business Profile", platform: "Google", url: "", account: "", nap: "Consistent", website: "https://airandseaglobal.vn", verified: "Verified", indexed: "Indexed", updated: "2026-09-07", notes: "" }],
  seeding: [{ id: "SEED-001", platform: "Facebook Group", postUrl: "", content: "Chia sẻ kinh nghiệm xin visa", account: "", posted: "2026-09-07", targetUrl: "/blog/visa-singapore", status: "Live", removed: false, checked: "2026-09-07" }],
  rankings: [{ id: "KW-001", keyword: "visa Singapore", page: "/dich-vu-visa-singapore", position: 4, previous: 6, clicks: 284, impressions: 4200, ctr: 6.76, date: "2026-09-07" }],
  worklogs: [{ id: "LOG-001", date: "2026-09-07", taskId: "TASK-001", group: "Technical", description: "Rà soát URL chưa index", start: "08:30", end: "10:00", hours: 1.5, result: "Đã cập nhật 12 URL", blockers: "", nextStep: "Kiểm tra canonical", document: "", completion: 70 }],
  changes: [{ id: "CHANGE-001", date: "2026-09-07 09:42", action: "Khởi tạo workspace", entity: "Hệ thống SEO", user: "SEO Freelancer", detail: "Tạo dữ liệu ban đầu" }],
  personnel: [{ id: "PERSON-001", name: "SEO Freelancer", role: "SEO Lead", email: "", phone: "", status: "Active", note: "" }],
};

const emptyData = (): AppData => ({
  tasks: [], content: [], calendar: [], onpage: [], audits: [], indexing: [],
  backlinks: [], entities: [], seeding: [], rankings: [], worklogs: [], changes: [], personnel: [],
});
const ensureUniqueIds = (source: AppData): AppData => {
  const next = { ...source };
  (Object.keys(next) as ModuleKey[]).forEach(module => {
    const seen = new Set<string>();
    next[module] = next[module].map(row => {
      const currentId = String(row.id || "");
      const id = currentId && !seen.has(currentId) ? currentId : uid(module.toUpperCase());
      seen.add(id);
      let normalizedRow = module === "worklogs" && !row.status ? { ...row, status: Number(row.completion || 0) >= 100 ? "Đã xong" : Number(row.completion || 0) > 0 ? "Đang làm" : "Chưa làm" } : row;
      if (module === "tasks" && !normalizedRow.startDate && normalizedRow.due) normalizedRow = { ...normalizedRow, startDate: normalizedRow.due };
      return { ...normalizedRow, id };
    });
  });
  return next;
};

const fields: Record<ModuleKey, Field[]> = {
  tasks: [
    { key: "title", label: "Tên công việc", required: true }, { key: "group", label: "Nhóm SEO", type: "select", options: ["Content", "Technical", "On-page", "Off-page", "Entity", "Index", "Report", "General"] },
    { key: "priority", label: "Ưu tiên", type: "select", options: ["Low", "Medium", "High", "Critical"] }, { key: "status", label: "Trạng thái", type: "select", options: ["Backlog", "To do", "In progress", "Waiting", "Review", "Done", "Cancelled"] },
    { key: "startDate", label: "Ngày bắt đầu", type: "date" }, { key: "completedDate", label: "Ngày hoàn thành", type: "date" }, { key: "owner", label: "Người phụ trách" }, { key: "estimated", label: "Giờ dự kiến", type: "number" }, { key: "actual", label: "Giờ thực tế", type: "number" },
    { key: "url", label: "URL liên quan" }, { key: "result", label: "Kết quả/Ghi chú", type: "textarea" },
  ],
  content: [
    { key: "topic", label: "Chủ đề/Tiêu đề", required: true }, { key: "keyword", label: "Keyword chính", required: true }, { key: "secondary", label: "Keyword phụ" }, { key: "intent", label: "Search intent", type: "select", options: ["Informational", "Commercial", "Transactional", "Navigational"] },
    { key: "funnel", label: "Funnel", type: "select", options: ["TOFU", "MOFU", "BOFU"] }, { key: "cluster", label: "Topic cluster" }, { key: "pillar", label: "Pillar page" }, { key: "url", label: "URL dự kiến" },
    { key: "owner", label: "Người thực hiện" }, { key: "status", label: "Trạng thái", type: "select", options: ["Idea", "Outline", "In progress", "Review", "Scheduled", "Published", "Updating"] },
    { key: "deadline", label: "Deadline", type: "date" }, { key: "publishDate", label: "Ngày đăng", type: "date" }, { key: "priority", label: "Ưu tiên", type: "select", options: ["Low", "Medium", "High"] },
    { key: "volume", label: "Search volume", type: "number" }, { key: "difficulty", label: "Keyword difficulty", type: "number" }, { key: "business", label: "Business value (1-10)", type: "number" },
    { key: "relevance", label: "Độ liên quan (1-10)", type: "number" }, { key: "potential", label: "Ranking potential (1-10)", type: "number" }, { key: "notes", label: "Ghi chú", type: "textarea" },
  ],
  calendar: [{ key: "date", label: "Ngày đăng", type: "date", required: true }, { key: "title", label: "Tên bài", required: true }, { key: "keyword", label: "Keyword" }, { key: "url", label: "URL" }, { key: "channel", label: "Kênh", type: "select", options: ["Website", "Website + Social", "Facebook", "LinkedIn", "Google Business"] }, { key: "status", label: "Trạng thái", type: "select", options: ["Planned", "Review", "Scheduled", "Published"] }, { key: "owner", label: "Người phụ trách" }, { key: "approved", label: "Ngày duyệt", type: "date" }, { key: "campaign", label: "Chiến dịch/Ghi chú" }],
  onpage: [{ key: "url", label: "URL", required: true }, { key: "owner", label: "Người phụ trách" }, { key: "checked", label: "Ngày kiểm tra", type: "date" }, ...["https", "canonical", "indexable", "title", "meta", "h1", "headings", "intent", "internal", "external", "alt", "schema", "mobile"].map(key => ({ key, label: key.toUpperCase(), type: "checkbox" as const })), { key: "missing", label: "Việc còn thiếu", type: "textarea" }],
  audits: [{ key: "url", label: "URL/Khu vực", required: true }, { key: "category", label: "Nhóm lỗi", type: "select", options: ["404", "5xx", "Redirect", "Canonical", "Noindex", "Sitemap", "Duplicate", "Thin content", "Orphan page", "Page speed", "Mobile", "Schema", "Image"] }, { key: "issue", label: "Mô tả lỗi", required: true }, { key: "severity", label: "Mức độ", type: "select", options: ["Low", "Medium", "High", "Critical"] }, { key: "affected", label: "Số URL ảnh hưởng", type: "number" }, { key: "value", label: "Giá trị URL (1-10)", type: "number" }, { key: "resolution", label: "Cách xử lý", type: "textarea" }, { key: "owner", label: "Người xử lý" }, { key: "due", label: "Deadline", type: "date" }, { key: "status", label: "Trạng thái", type: "select", options: ["Open", "In progress", "Done", "Ignored"] }, { key: "found", label: "Ngày phát hiện", type: "date" }, { key: "completed", label: "Ngày hoàn tất", type: "date" }, { key: "evidence", label: "Link bằng chứng" }],
  indexing: [{ key: "url", label: "URL", required: true }, { key: "owner", label: "Người phụ trách" }, { key: "type", label: "Loại URL", type: "select", options: ["Article", "Landing page", "Entity", "Backlink", "Service"] }, { key: "created", label: "Ngày tạo", type: "date" }, { key: "submitted", label: "Ngày submit", type: "date" }, { key: "checked", label: "Kiểm tra gần nhất", type: "date" }, { key: "status", label: "Trạng thái", type: "select", options: ["Indexed", "Not indexed", "Crawled - not indexed", "Discovered - not indexed", "Error", "Unknown"] }, { key: "reason", label: "Lý do" }, { key: "action", label: "Hành động tiếp theo" }, { key: "next", label: "Ngày kiểm tra lại", type: "date" }, { key: "priority", label: "Ưu tiên", type: "select", options: ["Low", "Medium", "High"] }],
  backlinks: [{ key: "domain", label: "Domain", required: true }, { key: "owner", label: "Người phụ trách" }, { key: "sourceUrl", label: "URL đặt link" }, { key: "targetUrl", label: "URL đích" }, { key: "anchor", label: "Anchor text" }, { key: "linkType", label: "Loại link", type: "select", options: ["Dofollow", "Nofollow", "Sponsored", "UGC"] }, { key: "topic", label: "Chủ đề website" }, { key: "authority", label: "Authority", type: "number" }, { key: "relevance", label: "Liên quan (0-25)", type: "number" }, { key: "trust", label: "Tin cậy (0-20)", type: "number" }, { key: "placement", label: "Vị trí (0-15)", type: "number" }, { key: "natural", label: "Anchor tự nhiên (0-15)", type: "number" }, { key: "traffic", label: "Traffic (0-15)", type: "number" }, { key: "stability", label: "Ổn định (0-10)", type: "number" }, { key: "status", label: "Trạng thái", type: "select", options: ["Prospect", "Contacted", "Accepted", "Live", "Lost", "Pending check", "Risk"] }, { key: "placed", label: "Ngày đặt", type: "date" }, { key: "checked", label: "Ngày kiểm tra", type: "date" }],
  entities: [{ key: "name", label: "Entity name", required: true }, { key: "owner", label: "Người phụ trách" }, { key: "type", label: "Loại", type: "select", options: ["Google Business Profile", "Social profile", "Directory", "Partner", "PR", "Expert profile", "Local citation"] }, { key: "platform", label: "Nền tảng" }, { key: "url", label: "URL" }, { key: "account", label: "Email/Tài khoản" }, { key: "nap", label: "NAP consistency", type: "select", options: ["Consistent", "Needs review", "Incorrect"] }, { key: "website", label: "Website" }, { key: "verified", label: "Xác minh", type: "select", options: ["Draft", "Pending", "Complete", "Verified"] }, { key: "indexed", label: "Index", type: "select", options: ["Indexed", "Not indexed", "Unknown"] }, { key: "updated", label: "Ngày cập nhật", type: "date" }, { key: "notes", label: "Ghi chú", type: "textarea" }],
  seeding: [{ key: "platform", label: "Nền tảng", required: true }, { key: "owner", label: "Người phụ trách" }, { key: "postUrl", label: "Link bài seeding" }, { key: "content", label: "Nội dung seeding", type: "textarea" }, { key: "account", label: "Tài khoản" }, { key: "posted", label: "Ngày đăng", type: "date" }, { key: "targetUrl", label: "Link trỏ về" }, { key: "status", label: "Trạng thái", type: "select", options: ["Draft", "Live", "Pending check", "Removed"] }, { key: "removed", label: "Đã bị xóa", type: "checkbox" }, { key: "checked", label: "Kiểm tra gần nhất", type: "date" }],
  rankings: [{ key: "keyword", label: "Keyword", required: true }, { key: "owner", label: "Người phụ trách" }, { key: "page", label: "Landing page" }, { key: "position", label: "Vị trí hiện tại", type: "number" }, { key: "previous", label: "Vị trí trước", type: "number" }, { key: "clicks", label: "Clicks", type: "number" }, { key: "impressions", label: "Impressions", type: "number" }, { key: "ctr", label: "CTR (%)", type: "number" }, { key: "date", label: "Ngày dữ liệu", type: "date" }],
  worklogs: [{ key: "date", label: "Ngày", type: "date", required: true }, { key: "owner", label: "Người phụ trách" }, { key: "group", label: "Nhóm công việc", type: "select", options: ["Nghiên cứu từ khóa", "Content", "Technical SEO", "On-page", "Off-page", "Local SEO", "Entity SEO", "Indexing", "Social/Seeding", "Analytics & Reporting", "Khác"] }, { key: "description", label: "Nội dung thực hiện", type: "textarea", required: true }, { key: "result", label: "Kết quả", type: "textarea" }, { key: "status", label: "Trạng thái", type: "select", options: ["Chưa làm", "Đang làm", "Đã xong"] }, { key: "imageUrl", label: "Ảnh đính kèm", type: "textarea" }, { key: "document", label: "Link tài liệu" }],
  changes: [{ key: "date", label: "Thời gian" }, { key: "action", label: "Hành động" }, { key: "entity", label: "Đối tượng" }, { key: "user", label: "Người thực hiện" }, { key: "detail", label: "Chi tiết" }],
  personnel: [{ key: "name", label: "Họ tên", required: true }, { key: "role", label: "Vai trò" }, { key: "email", label: "Email" }, { key: "phone", label: "Số điện thoại" }, { key: "status", label: "Trạng thái", type: "select", options: ["Active", "Inactive"] }, { key: "updated", label: "Ngày cập nhật", type: "date" }, { key: "note", label: "Ghi chú", type: "textarea" }],
};

const moduleMeta: Record<ModuleKey, { title: string; eyebrow: string; description: string; columns: string[]; prefix: string }> = {
  tasks: { title: "Công việc", eyebrow: "WORKFLOW MANAGEMENT", description: "Theo dõi công việc từ ngày bắt đầu đến ngày hoàn thành.", columns: ["title", "group", "priority", "startDate", "completedDate", "status", "owner"], prefix: "TASK" },
  content: { title: "Kế hoạch nội dung", eyebrow: "CONTENT OPERATIONS", description: "Quản lý keyword, topic cluster, tiến độ và điểm cơ hội.", columns: ["topic", "keyword", "intent", "cluster", "publishDate", "score", "owner", "status"], prefix: "CONTENT" },
  calendar: { title: "Lịch đăng bài", eyebrow: "PUBLISHING CALENDAR", description: "Theo dõi lịch xuất bản, duyệt bài và phân phối nội dung.", columns: ["date", "title", "keyword", "channel", "owner", "status"], prefix: "CAL" },
  onpage: { title: "On-page Checklist", eyebrow: "URL QUALITY CONTROL", description: "Chấm điểm từng URL và phát hiện hạng mục còn thiếu.", columns: ["url", "owner", "checked", "title", "meta", "h1", "internal", "alt", "schema", "score"], prefix: "ONPAGE" },
  audits: { title: "Technical SEO Audit", eyebrow: "TECHNICAL SEO", description: "Theo dõi lỗi, mức ảnh hưởng và tiến độ khắc phục.", columns: ["url", "owner", "category", "issue", "severity", "impact", "due", "status"], prefix: "AUDIT" },
  indexing: { title: "Index Tracking", eyebrow: "INDEXATION", description: "Quản lý submit, trạng thái index và lịch kiểm tra 3/7/14 ngày.", columns: ["url", "owner", "type", "submitted", "status", "reason", "next", "priority"], prefix: "INDEX" },
  backlinks: { title: "Backlinks", eyebrow: "OFF-PAGE SEO", description: "Quản lý nguồn link, anchor, chất lượng và trạng thái.", columns: ["domain", "owner", "targetUrl", "anchor", "linkType", "authority", "score", "status"], prefix: "BL" },
  entities: { title: "Entity SEO", eyebrow: "BRAND ENTITY", description: "Theo dõi hồ sơ thương hiệu, NAP, xác minh và index.", columns: ["name", "owner", "type", "platform", "nap", "verified", "indexed", "updated"], prefix: "ENTITY" },
  seeding: { title: "Seeding", eyebrow: "DISTRIBUTION", description: "Theo dõi bài seeding, tài khoản, link đích và tình trạng tồn tại.", columns: ["platform", "owner", "postUrl", "targetUrl", "posted", "status", "removed", "checked"], prefix: "SEED" },
  rankings: { title: "Keyword Rankings", eyebrow: "SEARCH PERFORMANCE", description: "Quản lý vị trí, clicks, impressions và CTR.", columns: ["keyword", "owner", "page", "position", "previous", "clicks", "impressions", "ctr", "date"], prefix: "KW" },
  worklogs: { title: "Nhật ký làm việc", eyebrow: "DAILY EXECUTION", description: "Ghi nội dung thực hiện, kết quả, trạng thái và hình ảnh đính kèm.", columns: ["date", "owner", "group", "description", "status", "result", "imageUrl"], prefix: "LOG" },
  changes: { title: "Change Log", eyebrow: "AUDIT TRAIL", description: "Lịch sử các thay đổi quan trọng trong hệ thống.", columns: ["date", "action", "entity", "user", "detail"], prefix: "CHANGE" },
  personnel: { title: "Nhân sự", eyebrow: "TEAM MANAGEMENT", description: "Quản lý người phụ trách để chọn nhanh khi tạo task và nội dung.", columns: ["name", "role", "email", "phone", "status", "updated", "note"], prefix: "PERSON" },
};

const moduleDateKeys: Record<ModuleKey, string[]> = {
  tasks: ["completedDate", "startDate"],
  content: ["publishDate", "deadline"],
  calendar: ["date", "approved"],
  onpage: ["checked"],
  audits: ["completed", "found", "due"],
  indexing: ["checked", "submitted", "created", "next"],
  backlinks: ["checked", "placed"],
  entities: ["updated"],
  seeding: ["checked", "posted"],
  rankings: ["date"],
  worklogs: ["date"],
  changes: ["date"],
  personnel: ["updated"],
};

const normalizeFilterDate = (value: unknown) => {
  const raw = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const vietnameseDate = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return vietnameseDate ? `${vietnameseDate[3]}-${vietnameseDate[2].padStart(2, "0")}-${vietnameseDate[1].padStart(2, "0")}` : "";
};

const navGroups: { label: string; items: [string, string][] }[] = [
  { label: "Tổng quan", items: [["dashboard", "Dashboard"]] },
  { label: "Điều hành", items: [["tasks", "Công việc"], ["content", "Nội dung"], ["calendar", "Lịch đăng bài"], ["worklogs", "Nhật ký làm việc"], ["personnel", "Nhân sự"]] },
  { label: "SEO On-site", items: [["onpage", "On-page Checklist"], ["audits", "Technical Audit"], ["indexing", "Index Tracking"]] },
  { label: "SEO Off-site", items: [["backlinks", "Backlinks"], ["entities", "Entity SEO"], ["seeding", "Seeding"]] },
  { label: "Dữ liệu & báo cáo", items: [["rankings", "Keyword Rankings"], ["reports", "Báo cáo KPI"], ["changes", "Change Log"]] },
];
const routeNames: Record<string, string> = Object.fromEntries(navGroups.flatMap(group => group.items));
const pagePaths: Record<string, string> = { dashboard: "/", settings: "/settings", ...Object.fromEntries(Object.keys(routeNames).filter(key => key !== "dashboard").map(key => [key, `/${key}`])) };
const pathToPage = (path: string) => { const key = Object.keys(pagePaths).find(item => pagePaths[item] === path); return key || "dashboard"; };

function normalizeRow(module: ModuleKey, draft: Row): Row {
  const row = { ...draft };
  if (module === "content") {
    if (!row.url && row.topic) row.url = `/blog/${slugify(String(row.topic))}`;
    const volume = Math.min(Number(row.volume || 0) / 100, 30);
    row.score = Math.max(0, Math.min(100, Math.round(volume + Number(row.business || 0) * 2 + Number(row.relevance || 0) * 2 + Number(row.potential || 0) * 2 - Number(row.difficulty || 0) * .1)));
  }
  if (module === "onpage") {
    const keys = ["https", "canonical", "indexable", "title", "meta", "h1", "headings", "intent", "internal", "external", "alt", "schema", "mobile"];
    row.score = Math.round(keys.filter(key => Boolean(row[key])).length / keys.length * 100);
    row.missing = keys.filter(key => !row[key]).join(", ");
  }
  if (module === "audits") {
    const weight: Record<string, number> = { Low: 1, Medium: 2, High: 3, Critical: 4 };
    row.impact = (weight[String(row.severity)] || 2) * Number(row.affected || 1) * Number(row.value || 1);
  }
  if (module === "backlinks") row.score = ["relevance", "trust", "placement", "natural", "traffic", "stability"].reduce((sum, key) => sum + Number(row[key] || 0), 0);
  return row;
}

function downloadFile(name: string, content: string, type: string) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([content], { type }));
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
}

export default function Home() {
  const [active, setActive] = useState("dashboard");
  const [data, setData] = useState<AppData>(seedData);
  const [settings, setSettings] = useState<SiteSettings>(defaultSettings);
  const [projects, setProjects] = useState<Project[]>([{ id: "project-air-sea", name: "Air & Sea Global", domain: "https://airandseaglobal.vn", timezone: "Asia/Ho_Chi_Minh" }]);
  const [activeProjectId, setActiveProjectId] = useState("project-air-sea");
  const [projectLoaded, setProjectLoaded] = useState(false);
  const [loadedProjectId, setLoadedProjectId] = useState("");
  const [cloudReady, setCloudReady] = useState(false);
  const [accountEmail, setAccountEmail] = useState("");
  const [authChecked, setAuthChecked] = useState(false);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<ConfirmConfig | null>(null);
  const [startupError, setStartupError] = useState("");
  const suppressCloudWriteRef = useRef(false);
  const dataRef = useRef(data);
  const settingsRef = useRef(settings);

  useEffect(() => {
    try {
      const savedProjects = localStorage.getItem("air-sea-projects-v1");
      const savedActive = localStorage.getItem("air-sea-active-project-v1");
      const storedProjects = parseStored<Project[]>(savedProjects, []);
      const projectList = storedProjects.length ? storedProjects : [{ id: "project-air-sea", name: "Air & Sea Global", domain: "https://airandseaglobal.vn", timezone: "Asia/Ho_Chi_Minh" }];
      setProjects(projectList);
      setActiveProjectId(savedActive || projectList[0].id);
      if (!localStorage.getItem(`air-sea-seo-data-${savedActive || projectList[0].id}`)) {
        const legacyData = localStorage.getItem("air-sea-seo-data-v2");
        const legacySettings = localStorage.getItem("air-sea-seo-settings-v2");
        if (legacyData) localStorage.setItem(`air-sea-seo-data-${savedActive || projectList[0].id}`, legacyData);
        if (legacySettings) localStorage.setItem(`air-sea-seo-settings-${savedActive || projectList[0].id}`, legacySettings);
      }
    } catch { /* keep valid defaults */ }
    setReady(true);
  }, []);
  useEffect(() => { dataRef.current = data; }, [data]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => {
    const syncPage = () => setActive(pathToPage(window.location.pathname));
    syncPage();
    window.addEventListener("popstate", syncPage);
    return () => window.removeEventListener("popstate", syncPage);
  }, []);
  useEffect(() => {
    if (!ready || !activeProjectId) return;
    let cancelled = false;
    setProjectLoaded(false);
    setLoadedProjectId("");
    const saved = localStorage.getItem(`air-sea-seo-data-${activeProjectId}`);
    const savedSettings = localStorage.getItem(`air-sea-seo-settings-${activeProjectId}`);
    const project = projects.find(item => item.id === activeProjectId);
    const isStarterDemo = activeProjectId === "project-air-sea";
    const savedData = parseStored<Partial<AppData> | null>(saved, null);
    const containsOnlyLeakedDemoData = !isStarterDemo && savedData && JSON.stringify(savedData) === JSON.stringify(seedData);
    const localData = ensureUniqueIds(savedData && !containsOnlyLeakedDemoData ? { ...emptyData(), ...savedData } : isStarterDemo ? seedData : emptyData());
    const localSettings = savedSettings ? { ...defaultSettings, ...parseStored<Partial<SiteSettings>>(savedSettings, {}) } : { ...defaultSettings, name: project?.name || defaultSettings.name, domain: project?.domain || defaultSettings.domain, timezone: project?.timezone || defaultSettings.timezone };
    const finishLoading = (nextData: AppData, nextSettings: SiteSettings) => {
      if (cancelled) return;
      setData(nextData);
      setSettings(nextSettings);
      localStorage.setItem("air-sea-active-project-v1", activeProjectId);
      setLoadedProjectId(activeProjectId);
      setProjectLoaded(true);
    };
    if (cloudReady && supabase) {
      const client = supabase;
      client.from("site_workspaces").select("data,settings").eq("site_id", activeProjectId).maybeSingle().then(({ data: workspace, error }) => {
        if (error) { setStartupError(`Không tải được dữ liệu cloud: ${error.message}`); return; }
        finishLoading(ensureUniqueIds(workspace?.data ? { ...emptyData(), ...workspace.data } : localData), workspace?.settings ? { ...defaultSettings, ...workspace.settings } : localSettings);
      });
    } else finishLoading(localData, localSettings);
    return () => { cancelled = true; };
  }, [activeProjectId, ready, cloudReady, projects]);
  useEffect(() => { if (ready) try { localStorage.setItem("air-sea-projects-v1", JSON.stringify(projects)); } catch { setToast("Không đủ bộ nhớ trình duyệt để lưu danh sách project"); } }, [projects, ready]);
  useEffect(() => { if (ready && projectLoaded && loadedProjectId === activeProjectId) try { localStorage.setItem(`air-sea-seo-data-${activeProjectId}`, JSON.stringify(data)); } catch { setToast("Dữ liệu lớn: trình duyệt không lưu được bản cache local"); } }, [data, ready, projectLoaded, loadedProjectId, activeProjectId]);
  useEffect(() => { if (ready && projectLoaded && loadedProjectId === activeProjectId) try { localStorage.setItem(`air-sea-seo-settings-${activeProjectId}`, JSON.stringify(settings)); } catch { setToast("Không lưu được cài đặt trên trình duyệt"); } }, [settings, ready, projectLoaded, loadedProjectId, activeProjectId]);
  useEffect(() => {
    if (!cloudReady || !supabase || !activeProjectId || !projectLoaded || loadedProjectId !== activeProjectId) return;
    if (suppressCloudWriteRef.current) { suppressCloudWriteRef.current = false; return; }
    const client = supabase;
    const timer = setTimeout(() => {
      client.from("site_workspaces").upsert({ site_id: activeProjectId, data, settings, updated_at: new Date().toISOString() }).then(({ error }) => { if (error) setToast(`Đồng bộ cloud thất bại: ${error.message}`); });
    }, 500);
    return () => clearTimeout(timer);
  }, [data, settings, activeProjectId, cloudReady, projectLoaded, loadedProjectId]);
  useEffect(() => {
    if (!cloudReady || !supabase || !activeProjectId || loadedProjectId !== activeProjectId) return;
    const client = supabase;
    const channel = client.channel(`workspace-${activeProjectId}`).on("postgres_changes", { event: "*", schema: "public", table: "site_workspaces", filter: `site_id=eq.${activeProjectId}` }, payload => {
      const workspace = payload.new as { data?: Partial<AppData>; settings?: Partial<SiteSettings> };
      if (!workspace?.data && !workspace?.settings) return;
      const nextData = workspace.data ? ensureUniqueIds({ ...emptyData(), ...workspace.data }) : dataRef.current;
      const nextSettings = workspace.settings ? { ...defaultSettings, ...workspace.settings } : settingsRef.current;
      if (JSON.stringify(nextData) === JSON.stringify(dataRef.current) && JSON.stringify(nextSettings) === JSON.stringify(settingsRef.current)) return;
      suppressCloudWriteRef.current = true;
      setData(nextData);
      setSettings(nextSettings);
      setToast("Đã nhận cập nhật mới từ cloud");
    }).subscribe();
    return () => { void client.removeChannel(channel); };
  }, [activeProjectId, cloudReady, loadedProjectId]);
  useEffect(() => {
    if (!supabaseConfigured || !supabase) {
      if (localModeAllowed) setAuthChecked(true);
      else window.location.replace("/auth?setup=required");
      return;
    }
    const client = supabase;
    let cancelled = false;
    const { data: authListener } = client.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || (!session && event !== "INITIAL_SESSION")) {
        setAuthChecked(false);
        window.location.replace("/auth");
        return;
      }
      if (session) setAccountEmail(session.user.email || "");
    });
    client.auth.getSession().then(async ({ data: sessionData, error: sessionError }) => {
      if (cancelled) return;
      if (sessionError || !sessionData.session) { window.location.replace("/auth"); return; }
      const user = sessionData.session.user;
      setAccountEmail(user.email || "");
      setStartupError("");
      const { data: cloudProjects, error: projectsError } = await client.from("sites").select("id,name,domain,timezone,created_at").order("created_at", { ascending: true });
      if (cancelled) return;
      if (projectsError) { setStartupError(`Không đọc được danh sách project: ${projectsError.message}`); setAuthChecked(true); return; }
      let availableProjects = cloudProjects || [];
      if (!availableProjects.length) {
        const storedProjects = parseStored<Project[]>(localStorage.getItem("air-sea-projects-v1"), []);
        const localProjects = storedProjects.length ? storedProjects : [{ id: "project-air-sea", name: defaultSettings.name, domain: defaultSettings.domain, timezone: defaultSettings.timezone }];
        for (const localProject of localProjects) {
          const { data: createdProjectData, error: createProjectError } = await client.rpc("create_site_project", { p_name: localProject.name, p_domain: normalizeDomain(localProject.domain), p_timezone: localProject.timezone || defaultSettings.timezone });
          const createdProject = createdProjectData as (Project & { created_at: string }) | null;
          if (createProjectError) {
            setStartupError(`Không tạo được project cloud: ${createProjectError.message}`);
            setAuthChecked(true);
            return;
          }
          if (!createdProject) {
            setStartupError("Không tạo được project cloud: Supabase không trả về dữ liệu project vừa tạo.");
            setAuthChecked(true);
            return;
          }
          availableProjects.push(createdProject);
          const rawData = localStorage.getItem(`air-sea-seo-data-${localProject.id}`);
          const rawSettings = localStorage.getItem(`air-sea-seo-settings-${localProject.id}`);
          const storedData = parseStored<Partial<AppData>>(rawData, {});
          const migratedData = ensureUniqueIds({ ...emptyData(), ...storedData });
          const migratedSettings = { ...defaultSettings, name: createdProject.name, domain: createdProject.domain, timezone: createdProject.timezone, ...parseStored<Partial<SiteSettings>>(rawSettings, {}) };
          const { error: migrationError } = await client.from("site_workspaces").upsert({ site_id: createdProject.id, data: migratedData, settings: migratedSettings, updated_at: new Date().toISOString() });
          if (migrationError) {
            await client.from("sites").delete().eq("id", createdProject.id);
            setStartupError(`Không chuyển được dữ liệu local lên cloud: ${migrationError.message}`);
            setAuthChecked(true);
            return;
          }
        }
      }
      if (!availableProjects.length) { setStartupError("Không tạo được project cloud. Hãy chạy đầy đủ schema.sql và multi-project.sql trong Supabase."); setAuthChecked(true); return; }
      setProjects(availableProjects);
      const savedDomain = parseStored<Project[]>(localStorage.getItem("air-sea-projects-v1"), []).find(project => project.id === localStorage.getItem("air-sea-active-project-v1"))?.domain;
      const selectedId = availableProjects.find(project => savedDomain && normalizeDomain(project.domain) === normalizeDomain(savedDomain))?.id || availableProjects[0].id;
      setActiveProjectId(selectedId);
      setProjectLoaded(false);
      setLoadedProjectId("");
      setCloudReady(true);
      setAuthChecked(true);
    }).catch(() => { if (!cancelled) window.location.replace("/auth?error=session"); });
    return () => { cancelled = true; authListener.subscription.unsubscribe(); };
  }, []);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(""), 2600); return () => clearTimeout(timer); }, [toast]);

  const addChange = (action: string, entity: string, detail = "") => setData(current => ({ ...current, changes: [{ id: uid("CHANGE"), date: new Date().toLocaleString("vi-VN"), action, entity, user: settings.owner, detail }, ...current.changes].slice(0, 500) }));
  const saveRows = (module: ModuleKey, rows: Row[]) => setData(current => ({ ...current, [module]: rows }));
  const navigate = (page: string) => {
    const nextPath = pagePaths[page] || "/";
    if (window.location.pathname !== nextPath) window.history.pushState({}, "", nextPath);
    setActive(page);
  };
  const switchProject = (id: string) => { setActiveProjectId(id); setProjectLoaded(false); navigate("dashboard"); };
  const createProject = async (name: string, domain: string) => {
    if (!name.trim() || !domain.trim()) return;
    let project: Project = { id: uid("PROJECT").toLowerCase(), name: name.trim(), domain: normalizeDomain(domain), timezone: "Asia/Ho_Chi_Minh" };
    if (supabaseConfigured && supabase) {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) { setToast("Phiên đăng nhập đã hết hạn"); return; }
      const { data: insertedData, error: insertError } = await supabase.rpc("create_site_project", { p_name: project.name, p_domain: project.domain, p_timezone: project.timezone });
      const inserted = insertedData as Project | null;
      if (insertError || !inserted) { setToast(`Không tạo được project cloud: ${insertError?.message || "Lỗi không xác định"}`); return; }
      project = inserted;
    }
    setProjects(current => [...current, project]); setActiveProjectId(project.id); setProjectLoaded(false); setProjectMenuOpen(false); setProjectModalOpen(false); navigate("dashboard"); setToast(`Đã tạo project ${project.name}`);
  };
  const logout = async () => { if (supabaseConfigured && supabase) await supabase.auth.signOut({ scope: "local" }); window.location.href = "/auth"; };
  const activeProject = projects.find(project => project.id === activeProjectId) || projects[0];
  const runAutomation = () => {
    const existing = new Set(data.tasks.map(row => String(row.title)));
    const generated: Row[] = [];
    data.audits.filter(row => row.status !== "Done" && ["High", "Critical"].includes(String(row.severity))).forEach(row => {
      const title = `Xử lý audit: ${row.issue}`;
      if (!existing.has(title)) generated.push({ id: uid("TASK"), title, group: "Technical", priority: row.severity, status: "To do", startDate: today(), owner: row.owner || settings.owner, estimated: 2, actual: 0, url: row.url, result: "Tự tạo từ Technical Audit" });
    });
    data.indexing.filter(row => row.status !== "Indexed" && String(row.next) <= today()).forEach(row => {
      const title = `Kiểm tra index: ${row.url}`;
      if (!existing.has(title)) generated.push({ id: uid("TASK"), title, group: "Index", priority: row.priority || "High", status: "To do", startDate: today(), owner: settings.owner, estimated: 1, actual: 0, url: row.url, result: "Tự tạo từ Index Tracking" });
    });
    if (generated.length) { setData(current => ({ ...current, tasks: [...generated, ...current.tasks] })); addChange("Chạy tự động hóa", "Tasks", `Tạo ${generated.length} công việc`); }
    setToast(generated.length ? `Đã tạo ${generated.length} công việc cần xử lý` : "Không có cảnh báo mới");
  };
  const toastTone = /thất bại|không thể|không đủ|không lưu|lỗi|hết hạn|chưa được/i.test(toast) ? "error" : /cảnh báo|không có/i.test(toast) ? "info" : "success";

  if (!ready || !authChecked) return <div className="loading"><div className="loading-card"><span className="loading-mark">A+</span><b>Đang xác thực tài khoản…</b><small>SEO Control Center</small></div></div>;
  if (startupError) return <div className="loading"><div className="loading-card startup-error"><span className="loading-mark">!</span><b>Không thể mở dữ liệu cloud</b><small>{startupError}</small><div><button className="secondary" onClick={() => window.location.reload()}>Thử lại</button><button className="danger-button" onClick={logout}>Đăng xuất</button></div></div></div>;
  if (!projectLoaded || loadedProjectId !== activeProjectId) return <div className="loading"><div className="loading-card"><span className="loading-mark">A+</span><b>Đang tải dữ liệu dự án…</b><small>Đang mở đúng workspace của website</small></div></div>;
  const moduleKey = active as ModuleKey;
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">A<span>+</span></div><div><strong>Air & Sea</strong><small>SEO Command Center</small></div></div>
      <div className="project-switcher"><label>WEBSITE PROJECT</label><button className="project-trigger" onClick={() => setProjectMenuOpen(value => !value)}><span><b>{activeProject?.name || "Chọn website"}</b><small>{activeProject?.domain?.replace(/^https?:\/\//, "")}</small></span><strong>⌄</strong></button>{projectMenuOpen && <div className="project-menu">{projects.map(project => <button key={project.id} className={project.id === activeProjectId ? "project-option selected" : "project-option"} onClick={() => { switchProject(project.id); setProjectMenuOpen(false); }}><span><b>{project.name}</b><small>{project.domain}</small></span>{project.id === activeProjectId && <em>Đang dùng</em>}</button>)}<button className="project-add" onClick={() => { setProjectModalOpen(true); setProjectMenuOpen(false); }}>＋ Tạo website mới</button></div>}</div>
      <nav>{navGroups.map(group => <div className="nav-group" key={group.label}><div className="nav-group-label">{group.label}</div>{group.items.map(([key, label]) => <button key={key} className={active === key ? "nav-item active" : "nav-item"} onClick={() => navigate(key)}>{label}{key === "tasks" && <em>{data.tasks.filter(row => row.status !== "Done").length}</em>}</button>)}</div>)}</nav>
      <div className="sidebar-bottom"><div className="sync-card"><span>●</span><div><b>Workspace đang hoạt động</b><small>Tự động lưu trên thiết bị</small></div></div><button className="settings" onClick={() => navigate("settings")}>Cài đặt & dữ liệu</button></div>
    </aside>
    <main className="main">
      <header className="topbar"><div><div className="breadcrumb">{settings.name.toUpperCase()} <span>/</span> {new Date().toLocaleDateString("vi-VN")}</div><h1>{active === "settings" ? "Cài đặt hệ thống" : active === "reports" ? "Báo cáo KPI" : active === "dashboard" ? "Dashboard" : moduleMeta[moduleKey]?.title}</h1></div><div className="top-actions"><button className="automation" onClick={runAutomation}>Chạy tự động hóa</button><div className="account-wrap"><button className="account-button" onClick={() => setAccountMenuOpen(value => !value)}><span className="account-avatar">{supabaseConfigured && accountEmail ? accountEmail.slice(0, 1).toUpperCase() : "SEO"}</span><span><b>{supabaseConfigured && accountEmail ? accountEmail : "Local workspace"}</b><small>{supabaseConfigured ? "Tài khoản Google/Supabase" : "Chưa đăng nhập cloud"}</small></span><strong>⌄</strong></button>{accountMenuOpen && <div className="account-menu">{supabaseConfigured ? <><div className="account-menu-head"><b>{accountEmail || "Tài khoản hiện tại"}</b><small>Đang đăng nhập</small></div><button onClick={() => navigate("settings")}>Cài đặt tài khoản</button><button className="logout-button" onClick={logout}>Đăng xuất</button></> : <><div className="account-menu-head"><b>Local workspace</b><small>Dữ liệu đang lưu trên thiết bị này</small></div><button onClick={() => { window.location.href = "/auth"; }}>Đăng nhập / Đăng ký</button></>}</div>}</div></div></header>
      <div className="content-wrap">
        {active === "dashboard" && <Dashboard data={data} settings={settings} setActive={navigate} runAutomation={runAutomation} />}
        {active === "reports" && <ReportWithGsc data={data} settings={settings} />}
        {active === "settings" && <Settings data={data} setData={setData} settings={settings} setSettings={setSettings} notify={setToast} requestConfirm={setConfirmDialog} />}
        {moduleMeta[moduleKey] && <ModuleView module={moduleKey} rows={data[moduleKey]} setRows={rows => saveRows(moduleKey, rows)} onChange={addChange} siteUrl={settings.domain} personnel={data.personnel} />}
      </div>
    </main>
    {toast && <div className={`toast ${toastTone}`} role="status"><span className="toast-icon">{toastTone === "error" ? "!" : toastTone === "info" ? "i" : "✓"}</span><div><b>{toastTone === "error" ? "Có lỗi xảy ra" : toastTone === "info" ? "Thông tin" : "Thành công"}</b><p>{toast}</p></div><button type="button" onClick={() => setToast("")} aria-label="Đóng thông báo">×</button></div>}
    {projectModalOpen && <ProjectModal onClose={() => setProjectModalOpen(false)} onCreate={createProject} />}
    {confirmDialog && <ConfirmDialog {...confirmDialog} onConfirm={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }} onClose={() => setConfirmDialog(null)} />}
  </div>;
}

function ConfirmDialog({ eyebrow, title, description, confirmLabel, danger = false, onConfirm, onClose }: { eyebrow: string; title: string; description: string; confirmLabel: string; danger?: boolean; onConfirm: () => void; onClose: () => void }) {
  return <div className="modal-backdrop confirm-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title"><div className={danger ? "confirm-icon danger" : "confirm-icon"}>{danger ? "!" : "?"}</div><div className="confirm-copy"><p className="eyebrow">{eyebrow}</p><h2 id="confirm-title">{title}</h2><p>{description}</p></div><div className="confirm-actions"><button type="button" className="secondary" onClick={onClose}>Hủy</button><button type="button" className={danger ? "confirm-danger" : "primary"} onClick={onConfirm}>{confirmLabel}</button></div></section></div>;
}

function ProjectModal({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string, domain: string) => void }) {
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("https://");
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><form className="modal project-modal" onSubmit={event => { event.preventDefault(); onCreate(name, domain); }}><div className="modal-head"><div><p className="eyebrow">NEW WEBSITE PROJECT</p><h2>Tạo website mới</h2></div><button type="button" onClick={onClose}>×</button></div><p className="modal-intro">Mỗi website sẽ có bộ task, content, audit, backlink và báo cáo riêng.</p><label><span>Tên website *</span><input autoFocus required value={name} onChange={event => setName(event.target.value)} placeholder="Ví dụ: Air & Sea Global" /></label><label><span>Domain website *</span><input required value={domain} onChange={event => setDomain(event.target.value)} placeholder="https://example.com" /></label><div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Hủy</button><button className="primary" type="submit">Tạo project</button></div></form></div>;
}

function Dashboard({ data, settings, setActive, runAutomation }: { data: AppData; settings: SiteSettings; setActive: (value: string) => void; runAutomation: () => void }) {
  const done = data.tasks.filter(row => row.status === "Done").length;
  const inProgress = data.tasks.filter(row => !["Done", "Cancelled"].includes(String(row.status))).length;
  const indexed = data.indexing.filter(row => row.status === "Indexed").length;
  const hours = data.worklogs.reduce((sum, row) => sum + Number(row.hours || 0), 0);
  const clicks = data.rankings.reduce((sum, row) => sum + Number(row.clicks || 0), 0);
  const impressions = data.rankings.reduce((sum, row) => sum + Number(row.impressions || 0), 0);
  const cards = [
    ["Hoàn thành task", `${data.tasks.length ? Math.round(done / data.tasks.length * 100) : 0}%`, `${done}/${data.tasks.length} công việc`, "blue"],
    ["Công việc đang làm", inProgress, `${inProgress} công việc đang mở`, inProgress ? "orange" : "green"],
    ["URL đã index", `${indexed}/${data.indexing.length}`, `${data.indexing.length - indexed} URL cần theo dõi`, "orange"],
    ["Thời gian thực hiện", `${hours}h`, "Từ nhật ký làm việc", "purple"],
  ];
  return <>
    <section className="hero-row"><div><p className="eyebrow">TỔNG QUAN HIỆU SUẤT</p><h2>Chào mừng trở lại, {settings.owner}</h2><p className="muted">Tình trạng SEO hiện tại của <b>{settings.domain}</b>.</p></div><div className="button-row"><button className="secondary" onClick={runAutomation}>⚡ Quét cảnh báo</button><button className="primary" onClick={() => setActive("tasks")}>Mở công việc →</button></div></section>
    <section className="metric-grid">{cards.map(([label, value, note, color]) => <div className="metric-card" key={String(label)}><div className={`metric-icon ${color}`}>◆</div><div className="metric-copy"><span>{label}</span><strong>{value}</strong><small>{note}</small></div></div>)}</section>
    <section className="dashboard-grid"><div className="panel"><div className="panel-title"><h3>Hiệu suất tìm kiếm</h3><button onClick={() => setActive("rankings")}>Chi tiết →</button></div><div className="kpi-strip"><div><span>Organic clicks</span><b>{clicks.toLocaleString()}</b></div><div><span>Impressions</span><b>{impressions.toLocaleString()}</b></div><div><span>CTR</span><b>{impressions ? (clicks / impressions * 100).toFixed(2) : 0}%</b></div><div><span>Vị trí TB</span><b>{data.rankings.length ? (data.rankings.reduce((sum, row) => sum + Number(row.position || 0), 0) / data.rankings.length).toFixed(1) : 0}</b></div></div><div className="chart-bars">{data.rankings.slice(0, 8).map(row => <div key={row.id}><span>{row.keyword}</span><i style={{ width: `${Math.max(8, 100 - Number(row.position) * 2)}%` }} /><b>#{row.position}</b></div>)}</div></div><div className="panel"><div className="panel-title"><h3>Trạng thái hệ thống</h3></div><div className="signal-list"><Signal label="Bài đã xuất bản" value={data.content.filter(row => row.status === "Published").length} /><Signal label="Audit High/Critical" value={data.audits.filter(row => ["High", "Critical"].includes(String(row.severity)) && row.status !== "Done").length} danger /><Signal label="Backlink đang live" value={data.backlinks.filter(row => row.status === "Live").length} /><Signal label="Entity đã xác minh" value={data.entities.filter(row => row.verified === "Verified").length} /></div></div></section>
    <section className="panel full"><div className="panel-head-pad"><h3>Công việc cần ưu tiên</h3><button onClick={() => setActive("tasks")}>Xem tất cả →</button></div><SimpleTable rows={data.tasks.filter(row => row.status !== "Done").slice(0, 5)} columns={["title", "group", "priority", "startDate", "status"]} /></section>
  </>;
}

function Signal({ label, value, danger }: { label: string; value: number; danger?: boolean }) { return <div className="signal"><span className={danger ? "signal-dot danger" : "signal-dot"} /><div><b>{label}</b><small>{danger && value ? "Cần ưu tiên" : "Đang theo dõi"}</small></div><strong>{value}</strong></div>; }

function ModuleView({ module, rows, setRows, onChange, siteUrl, personnel }: { module: ModuleKey; rows: Row[]; setRows: (rows: Row[]) => void; onChange: (action: string, entity: string, detail?: string) => void; siteUrl: string; personnel: Row[] }) {
  const meta = moduleMeta[module];
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [datePreset, setDatePreset] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [editing, setEditing] = useState<Row | null>(null);
  const [viewing, setViewing] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [gallery, setGallery] = useState<{ images: string[]; index: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [gscStatus, setGscStatus] = useState("");
  const [rankBand, setRankBand] = useState("All");
  const [rankSort, setRankSort] = useState("position");
  const [rankDirection, setRankDirection] = useState<"asc" | "desc">("asc");
  const [rankPage, setRankPage] = useState(1);
  const fileRef = useRef<HTMLInputElement>(null);
  const dateKeys = moduleDateKeys[module];
  const applyDatePreset = (preset: string) => {
    const end = new Date();
    const format = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    setDatePreset(preset);
    if (preset === "all") { setDateFrom(""); setDateTo(""); return; }
    if (preset === "today") { setDateFrom(today()); setDateTo(today()); return; }
    if (preset === "7days" || preset === "30days") { const start = new Date(end); start.setDate(start.getDate() - (preset === "7days" ? 6 : 29)); setDateFrom(format(start)); setDateTo(format(end)); return; }
    if (preset === "previousMonth") { const start = new Date(end.getFullYear(), end.getMonth() - 1, 1); const last = new Date(end.getFullYear(), end.getMonth(), 0); setDateFrom(format(start)); setDateTo(format(last)); return; }
    if (preset === "custom" && !dateFrom && !dateTo) { setDateFrom(today()); setDateTo(today()); }
  };
  const filtered = useMemo(() => {
    const result = rows.filter(row => {
      const matchesQuery = Object.values(row).join(" ").toLowerCase().includes(query.toLowerCase());
      const matchesStatus = status === "All" || String(row.status) === status;
      const rowDate = dateKeys.map(key => normalizeFilterDate(row[key])).find(Boolean) || "";
      const matchesDate = (!dateFrom && !dateTo) || Boolean(rowDate && (!dateFrom || rowDate >= dateFrom) && (!dateTo || rowDate <= dateTo));
      if (module !== "rankings") return matchesQuery && matchesStatus && matchesDate;
      const position = Number(row.position || 0);
      const matchesBand = rankBand === "All" || (rankBand === "top3" && position > 0 && position <= 3) || (rankBand === "top10" && position > 0 && position <= 10) || (rankBand === "top20" && position > 0 && position <= 20) || (rankBand === "21-50" && position > 20 && position <= 50) || (rankBand === "51-100" && position > 50 && position <= 100) || (rankBand === "100+" && position > 100) || (rankBand === "unknown" && position <= 0);
      return matchesQuery && matchesStatus && matchesBand && matchesDate;
    });
    if (module !== "rankings") return result;
    return result.sort((left, right) => {
      if (rankSort === "keyword") return String(left.keyword || "").localeCompare(String(right.keyword || ""), "vi") * (rankDirection === "asc" ? 1 : -1);
      const difference = Number(left[rankSort] || 0) - Number(right[rankSort] || 0);
      return (difference || String(left.keyword || "").localeCompare(String(right.keyword || ""), "vi")) * (rankDirection === "asc" ? 1 : -1);
    });
  }, [rows, query, status, module, rankBand, rankSort, rankDirection, dateKeys, dateFrom, dateTo]);
  const rankPageSize = 30;
  const rankTotalPages = module === "rankings" ? Math.max(1, Math.ceil(filtered.length / rankPageSize)) : 1;
  const visibleRows = module === "rankings" ? filtered.slice((rankPage - 1) * rankPageSize, rankPage * rankPageSize) : filtered;
  useEffect(() => { setDatePreset("all"); setDateFrom(""); setDateTo(""); }, [module]);
  useEffect(() => {
    if (module !== "worklogs") return;
    const timer = window.setTimeout(() => {
      document.querySelectorAll(".panel.full table").forEach(table => {
        const imageColumn = Array.from(table.querySelectorAll("thead th")).findIndex(header => (header.textContent || "").toLowerCase().includes("ảnh đính kèm"));
        if (imageColumn < 0) return;
        table.querySelectorAll("tbody tr").forEach(row => {
          const cell = row.children[imageColumn];
          if (!cell || cell.querySelector("img")) return;
          const links = (cell.textContent || "").split(/\r?\n/).map(value => value.trim()).filter(value => value.startsWith("http"));
          if (!links.length) return;
          cell.textContent = "";
          const wrapper = document.createElement("div"); wrapper.className = "attachment-previews";
          links.forEach((link, index) => { const anchor = document.createElement("a"); anchor.href = link; anchor.title = "Xem album ảnh"; anchor.addEventListener("click", event => { event.preventDefault(); setGallery({ images: links, index }); }); const image = document.createElement("img"); image.src = link; image.alt = `Ảnh đính kèm ${index + 1}`; image.loading = "lazy"; anchor.appendChild(image); wrapper.appendChild(anchor); });
          cell.appendChild(wrapper);
        });
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [module, visibleRows]);
  useEffect(() => { if (module === "rankings") setRankPage(1); }, [module, query, status, rankBand, rankSort, rankDirection, rows.length]);
  useEffect(() => { if (rankPage > rankTotalPages) setRankPage(rankTotalPages); }, [rankPage, rankTotalPages]);
  const statuses = Array.from(new Set(rows.map(row => String(row.status || "")).filter(Boolean)));

  const save = (draft: Row) => {
    let normalized = normalizeRow(module, draft);
    if (module === "tasks") {
      normalized = { ...normalized, startDate: normalized.startDate || today() };
      if (normalized.status === "Done" && !normalized.completedDate) normalized.completedDate = today();
      if (normalized.status !== "Done") normalized.completedDate = "";
    }
    const exists = rows.some(row => row.id === normalized.id);
    setRows(exists ? rows.map(row => row.id === normalized.id ? normalized : row) : [normalized, ...rows]);
    onChange(exists ? "Cập nhật" : "Tạo mới", `${meta.title}: ${normalized.id}`);
    setOpen(false); setEditing(null);
  };
  const remove = (row: Row) => setDeleting(row);
  const confirmRemove = () => { if (!deleting) return; setRows(rows.filter(item => item.id !== deleting.id)); onChange("Xóa", `${meta.title}: ${deleting.id}`); setDeleting(null); };
  const exportCsv = () => { const keys = fields[module].map(field => field.key); const content = "\uFEFF" + [keys.map(csvEscape).join(","), ...rows.map(row => keys.map(key => csvEscape(row[key])).join(","))].join("\n"); downloadFile(`${module}-${today()}.csv`, content, "text/csv;charset=utf-8"); };
  const importCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    const lines = (await file.text()).replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
    const headers = parseCsvLine(lines[0]);
    const imported = module === "rankings" ? (() => {
      const headerMap = new Map(headers.map((header, index) => [normalizeCsvHeader(header), index]));
      const findColumn = (...names: string[]) => names.map(name => headerMap.get(normalizeCsvHeader(name))).find(index => index !== undefined);
      const keywordIndex = findColumn("Truy vấn phổ biến nhất", "Truy vấn", "Query", "Top queries", "Search query");
      const pageIndex = findColumn("Trang phổ biến nhất", "Trang", "Page", "Top pages", "Landing page");
      const clicksIndex = findColumn("Lượt nhấp", "Clicks");
      const impressionsIndex = findColumn("Lượt hiển thị", "Impressions");
      const ctrIndex = findColumn("CTR");
      const positionIndex = findColumn("Vị trí", "Position", "Average position");
      if (keywordIndex === undefined || clicksIndex === undefined || impressionsIndex === undefined || ctrIndex === undefined || positionIndex === undefined) return null;
      return lines.slice(1).map(line => {
        const values = parseCsvLine(line);
        const position = csvNumber(values[positionIndex]);
        return normalizeRow(module, {
          id: uid(meta.prefix), keyword: values[keywordIndex] || "", page: pageIndex === undefined ? "" : values[pageIndex] || "",
          position, previous: position, clicks: csvNumber(values[clicksIndex]), impressions: csvNumber(values[impressionsIndex]),
          ctr: csvNumber(values[ctrIndex]), date: today(), source: file.name,
        });
      });
    })() : lines.slice(1).map(line => { const values = parseCsvLine(line); const row: Row = { id: uid(meta.prefix) }; headers.forEach((key, index) => row[key] = values[index] ?? ""); return normalizeRow(module, row); });
    if (!imported) { setGscStatus("Không nhận diện được đủ cột GSC: truy vấn, nhấp, hiển thị, CTR, vị trí."); event.target.value = ""; return; }
    setRows(module === "rankings" ? imported : [...imported, ...rows]);
    onChange(module === "rankings" ? "Import GSC CSV" : "Import CSV", meta.title, `${imported.length} bản ghi`);
    if (module === "rankings") setGscStatus(`Đã nhập ${imported.length} keyword từ ${file.name}`);
    event.target.value = "";
  };
  const syncSearchConsole = async () => {
    setGscStatus("Đang lấy dữ liệu…");
    const end = today(); const startDate = new Date(); startDate.setDate(startDate.getDate() - 28);
    const session = supabaseConfigured && supabase ? (await supabase.auth.getSession()).data.session : null;
    const response = await fetch(`/api/search-console/query?siteUrl=${encodeURIComponent(siteUrl.endsWith("/") ? siteUrl : `${siteUrl}/`)}&startDate=${startDate.toISOString().slice(0, 10)}&endDate=${end}`, { headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {} });
    const result = await response.json();
    if (!response.ok) { setGscStatus(result.error || "Không lấy được dữ liệu"); return; }
    const imported: Row[] = (result.rows || []).map((item: { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }) => ({ id: uid("KW"), keyword: item.keys?.[0] || "", page: item.keys?.[1] || "", position: Number(item.position || 0), previous: Number(item.position || 0), clicks: Number(item.clicks || 0), impressions: Number(item.impressions || 0), ctr: Number(((item.ctr || 0) * 100).toFixed(2)), date: end }));
    setRows(imported); onChange("Đồng bộ Search Console", "Keyword Rankings", `${imported.length} dòng`); setGscStatus(`Đã cập nhật ${imported.length} dòng`);
  };

  return <>
    <section className="page-heading"><div><p className="eyebrow">{meta.eyebrow}</p><h2>{meta.title}</h2><p className="muted">{meta.description}</p>{module === "rankings" && gscStatus && <p className="sync-status">{gscStatus}</p>}</div><div className="button-row">{module === "rankings" && <><button className="secondary" onClick={() => { window.location.href = "/api/search-console/auth?returnTo=/rankings"; }}>Kết nối GSC</button><button className="secondary" onClick={syncSearchConsole}>↻ Đồng bộ GSC</button></>}<button className="primary" onClick={() => { setEditing(null); setOpen(true); }}>＋ Thêm bản ghi</button></div></section>
    {dateKeys.length > 0 && <DateFilterBar preset={datePreset} from={dateFrom} to={dateTo} onPreset={applyDatePreset} onFrom={value => { setDatePreset("custom"); setDateFrom(value); }} onTo={value => { setDatePreset("custom"); setDateTo(value); }} />}
    <div className="toolbar"><div className="toolbar-left"><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm kiếm dữ liệu…" />{statuses.length > 0 && <select value={status} onChange={event => setStatus(event.target.value)}><option>All</option>{statuses.map(item => <option key={item}>{item}</option>)}</select>}{module === "rankings" && <><select value={rankBand} onChange={event => setRankBand(event.target.value)}><option value="All">Tất cả thứ hạng</option><option value="top3">Top 3</option><option value="top10">Top 10</option><option value="top20">Top 20</option><option value="21-50">Top 21–50</option><option value="51-100">Top 51–100</option><option value="100+">Ngoài Top 100</option><option value="unknown">Chưa có thứ hạng</option></select><select value={rankSort} onChange={event => setRankSort(event.target.value)}><option value="position">Sắp xếp: Vị trí</option><option value="keyword">Sắp xếp: Keyword</option><option value="clicks">Sắp xếp: Clicks</option><option value="impressions">Sắp xếp: Impressions</option><option value="ctr">Sắp xếp: CTR</option></select><button className="secondary sort-direction" onClick={() => setRankDirection(current => current === "asc" ? "desc" : "asc")}>{rankDirection === "asc" ? "Tăng dần ↑" : "Giảm dần ↓"}</button></>}</div><div className="button-row"><input ref={fileRef} hidden type="file" accept=".csv" onChange={importCsv} /><button className="secondary" onClick={() => fileRef.current?.click()}>{module === "rankings" ? "Nhập CSV GSC" : "Nhập CSV"}</button><button className="secondary" onClick={exportCsv}>Xuất CSV</button></div></div>
    <div className="panel full"><SimpleTable rows={visibleRows} columns={meta.columns} showIndex={module === "rankings"} indexOffset={module === "rankings" ? (rankPage - 1) * rankPageSize : 0} actions={row => <><button className="table-action" onClick={() => setViewing(row)}>Xem</button><button className="table-action" onClick={() => { setEditing(row); setOpen(true); }}>Sửa</button><button className="table-action delete" onClick={() => remove(row)}>Xóa</button></>} /></div>
    {module === "rankings" && <div className="pagination"><span>Hiển thị {filtered.length ? (rankPage - 1) * rankPageSize + 1 : 0}–{Math.min(rankPage * rankPageSize, filtered.length)} / {filtered.length} keyword</span><div><button className="secondary" disabled={rankPage <= 1} onClick={() => setRankPage(page => Math.max(1, page - 1))}>← Trước</button><b>Trang {rankPage} / {rankTotalPages}</b><button className="secondary" disabled={rankPage >= rankTotalPages} onClick={() => setRankPage(page => Math.min(rankTotalPages, page + 1))}>Sau →</button></div></div>}
    {open && <EditorModal title={`${editing ? "Sửa" : "Thêm"} ${meta.title}`} module={module} row={editing || { id: uid(meta.prefix) }} personnel={personnel} defaultOwner={personnel.find(person => String(person.status || "Active") !== "Inactive")?.name?.toString() || ""} onSave={save} onClose={() => { setOpen(false); setEditing(null); }} />}
    {viewing && <DetailModal title={`Thông tin ${meta.title}`} module={module} row={viewing} onOpenGallery={(images, index) => setGallery({ images, index })} onClose={() => setViewing(null)} />}
    {gallery && <GalleryModal images={gallery.images} initialIndex={gallery.index} onClose={() => setGallery(null)} />}
    {deleting && <ConfirmDialog eyebrow="XÁC NHẬN XÓA" title="Xóa bản ghi này?" description={`Bản ghi ${deleting.id} sẽ bị xóa khỏi ${meta.title}. Hành động này không thể hoàn tác.`} confirmLabel="Xóa bản ghi" danger onConfirm={confirmRemove} onClose={() => setDeleting(null)} />}
  </>;
}

function DateFilterBar({ preset, from, to, onPreset, onFrom, onTo }: { preset: string; from: string; to: string; onPreset: (value: string) => void; onFrom: (value: string) => void; onTo: (value: string) => void }) {
  const options = [["all", "Tất cả"], ["today", "Hôm nay"], ["7days", "7 ngày qua"], ["30days", "30 ngày qua"], ["previousMonth", "Tháng trước"], ["custom", "Tùy chỉnh"]];
  return <div className="date-filter-bar"><div className="date-filter-options">{options.map(([value, label]) => <button type="button" key={value} className={preset === value ? "active" : ""} onClick={() => onPreset(value)}>{label}</button>)}</div>{preset === "custom" && <div className="custom-date-range"><label><span>Từ ngày</span><input type="date" value={from} onChange={event => onFrom(event.target.value)} /></label><span className="date-range-separator">→</span><label><span>Đến ngày</span><input type="date" value={to} min={from || undefined} onChange={event => onTo(event.target.value)} /></label></div>}</div>;
}

function SimpleTable({ rows, columns, actions, showIndex = false, indexOffset = 0 }: { rows: Row[]; columns: string[]; actions?: (row: Row) => ReactNode; showIndex?: boolean; indexOffset?: number }) {
  const labels: Record<string, string> = Object.values(fields).flat().reduce((map, field) => ({ ...map, [field.key]: field.label }), {});
  return <div className="table-wrap"><table><thead><tr>{showIndex && <th>STT</th>}{columns.map(column => <th key={column}>{labels[column] || column}</th>)}{actions && <th>Thao tác</th>}</tr></thead><tbody>{rows.length ? rows.map((row, rowIndex) => <tr key={row.id}>{showIndex && <td className="row-number">{indexOffset + rowIndex + 1}</td>}{columns.map(column => <td key={column}>{typeof row[column] === "boolean" ? <span className={row[column] ? "check yes" : "check no"}>{row[column] ? "✓" : "×"}</span> : ["status", "priority", "severity", "verified", "indexed"].includes(column) ? <Badge value={String(row[column] ?? "")} /> : column === "score" || column === "impact" ? <strong className="score-value">{String(row[column] ?? 0)}</strong> : <span className={column === columns[0] ? "cell-main" : ""}>{String(row[column] ?? "—")}</span>}</td>)}{actions && <td><div className="row-actions">{actions(row)}</div></td>}</tr>) : <tr><td colSpan={columns.length + (showIndex ? 1 : 0) + (actions ? 1 : 0)}><div className="empty">Chưa có dữ liệu. Bấm “Thêm bản ghi” hoặc nhập CSV để bắt đầu.</div></td></tr>}</tbody></table></div>;
}

function Badge({ value }: { value: string }) { const lower = value.toLowerCase(); const tone = ["done", "published", "indexed", "live", "verified", "complete"].some(x => lower.includes(x)) ? "good" : ["high", "critical", "error", "lost", "removed", "overdue"].some(x => lower.includes(x)) ? "bad" : "warn"; return <span className={`badge ${tone}`}>{value || "—"}</span>; }

function EditorModal({ title, module, row, personnel, defaultOwner, onSave, onClose }: { title: string; module: ModuleKey; row: Row; personnel: Row[]; defaultOwner: string; onSave: (row: Row) => void | Promise<void>; onClose: () => void }) {
  const [draft, setDraft] = useState<Row>(() => ({ ...row, ...(fields[module].some(field => field.key === "owner") && !row.owner && defaultOwner ? { owner: defaultOwner } : {}), ...(module === "tasks" && !row.startDate ? { startDate: today() } : {}), ...(module === "worklogs" && !row.date ? { date: today() } : {}), ...(module === "onpage" && !row.checked ? { checked: today() } : {}), ...(module === "personnel" && !row.updated ? { updated: today() } : {}) }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const uploadPastedImage = async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const imageFile = Array.from(event.clipboardData.files).find(file => file.type.startsWith("image/"));
    if (!imageFile) return;
    event.preventDefault();
    setSaving(true); setError("");
    try {
      const formData = new FormData();
      formData.append("file", imageFile, imageFile.name || "pasted-image.png");
      const response = await fetch("/api/cloudinary/upload-from-url", { method: "POST", body: formData });
      const result = await response.json() as { url?: string; error?: string };
      if (!response.ok || !result.url) throw new Error(result.error || "Upload ảnh thất bại.");
      setDraft(current => ({ ...current, imageUrl: [String(current.imageUrl || "").trim(), result.url].filter(Boolean).join("\n") }));
    } catch (pasteError) {
      setError(pasteError instanceof Error ? pasteError.message : "Không thể upload ảnh dán vào.");
    } finally { setSaving(false); }
  };
  const uploadPastedImageFile = async (imageFile: File) => {
    setSaving(true); setError("");
    try {
      const formData = new FormData();
      formData.append("file", imageFile, imageFile.name || "pasted-image.png");
      const response = await fetch("/api/cloudinary/upload-from-url", { method: "POST", body: formData });
      const result = await response.json() as { url?: string; error?: string };
      if (!response.ok || !result.url) throw new Error(result.error || "Upload ảnh thất bại.");
      setDraft(current => ({ ...current, imageUrl: [String(current.imageUrl || "").trim(), result.url].filter(Boolean).join("\n") }));
    } catch (pasteError) {
      setError(pasteError instanceof Error ? pasteError.message : "Không thể upload ảnh dán vào.");
    } finally { setSaving(false); }
  };
  useEffect(() => {
    if (module !== "worklogs") return;
    const handlePaste = (event: ClipboardEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLTextAreaElement) || !target.placeholder.includes("Google Drive")) return;
      const imageFile = Array.from(event.clipboardData?.files || []).find(file => file.type.startsWith("image/"));
      if (!imageFile) return;
      event.preventDefault();
      void uploadPastedImageFile(imageFile);
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [module]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true); setError("");
    try {
      let nextDraft = { ...draft };
      if (module === "worklogs" && String(draft.imageUrl || "").trim()) {
        const imageLinks = String(draft.imageUrl).split(/\r?\n/).map(link => link.trim()).filter(Boolean);
        const uploadedLinks: string[] = [];
        for (const imageUrl of imageLinks) {
          if (imageUrl.includes("res.cloudinary.com/")) { uploadedLinks.push(imageUrl); continue; }
          const response = await fetch("/api/cloudinary/upload-from-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageUrl }) });
          const result = await response.json() as { url?: string; error?: string };
          if (!response.ok || !result.url) throw new Error(result.error || "Upload ảnh thất bại.");
          uploadedLinks.push(result.url);
        }
        nextDraft = { ...nextDraft, imageUrl: uploadedLinks.join("\n") };
      }
      await onSave(nextDraft);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Không thể lưu bản ghi.");
    } finally { setSaving(false); }
  };
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !saving) onClose(); }}><form className="modal" onSubmit={submit}><div className="modal-head"><div><p className="eyebrow">DATA EDITOR</p><h2>{title}</h2></div><button type="button" disabled={saving} onClick={onClose}>×</button></div><div className="form-grid">{fields[module].map(field => <label key={field.key} className={field.type === "textarea" ? "wide" : ""}>{field.type === "checkbox" ? <span className="checkbox-label"><input type="checkbox" checked={Boolean(draft[field.key])} onChange={event => setDraft({ ...draft, [field.key]: event.target.checked })} /> {field.label}</span> : <><span>{field.label}{field.required && " *"}</span>{field.key === "owner" ? <select value={String(draft[field.key] ?? "")} onChange={event => setDraft({ ...draft, [field.key]: event.target.value })}><option value="">Chưa gán</option>{personnel.filter(person => String(person.status || "Active") !== "Inactive").map(person => <option key={person.id} value={String(person.name)}>{String(person.name)}{person.role ? ` — ${person.role}` : ""}</option>)}</select> : field.type === "select" ? <select required={field.required} value={String(draft[field.key] ?? field.options?.[0] ?? "")} onChange={event => setDraft({ ...draft, [field.key]: event.target.value })}>{field.options?.map(option => <option key={option}>{option}</option>)}</select> : field.type === "textarea" ? <textarea required={field.required} placeholder={field.key === "imageUrl" ? "Dán link ảnh Google Drive, Cloudinary... mỗi dòng một link" : undefined} value={String(draft[field.key] ?? "")} onChange={event => setDraft({ ...draft, [field.key]: event.target.value })} /> : <input required={field.required} type={field.type || "text"} step={field.type === "number" ? "any" : undefined} value={String(draft[field.key] ?? "")} onChange={event => setDraft({ ...draft, [field.key]: field.type === "number" ? Number(event.target.value) : event.target.value })} />}</>}</label>)}</div>{error && <p className="form-error">{error}</p>}<div className="modal-actions"><button type="button" className="secondary" disabled={saving} onClick={onClose}>Hủy</button><button className="primary" disabled={saving} type="submit">{saving ? "Đang tải ảnh..." : "Lưu dữ liệu"}</button></div></form></div>;
}

function DetailModal({ title, module, row, onOpenGallery, onClose }: { title: string; module: ModuleKey; row: Row; onOpenGallery: (images: string[], index: number) => void; onClose: () => void }) {
  const moduleFields = fields[module];
  useEffect(() => {
    const imageFieldIndex = moduleFields.findIndex(field => field.key === "imageUrl");
    if (imageFieldIndex < 0) return;
    const timer = window.setTimeout(() => {
      const item = document.querySelectorAll(".detail-modal .detail-item")[imageFieldIndex];
      const value = item?.querySelector("strong")?.textContent || "";
      const links = value.split(/\r?\n/).map(link => link.trim()).filter(link => link.startsWith("http"));
      if (!item || !links.length || item.querySelector("img")) return;
      const strong = item.querySelector("strong"); if (strong) strong.remove();
      const wrapper = document.createElement("div"); wrapper.className = "detail-attachment-album";
      links.forEach((link, index) => { const button = document.createElement("button"); button.type = "button"; button.title = "Xem album ảnh"; button.addEventListener("click", () => onOpenGallery(links, index)); const image = document.createElement("img"); image.src = link; image.alt = `Ảnh đính kèm ${index + 1}`; image.loading = "lazy"; button.appendChild(image); wrapper.appendChild(button); });
      item.appendChild(wrapper);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [moduleFields, onOpenGallery]);
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="modal detail-modal"><div className="modal-head"><div><p className="eyebrow">VIEW DETAILS</p><h2>{title}</h2></div><button type="button" onClick={onClose}>×</button></div><div className="detail-grid">{moduleFields.map(field => <div className="detail-item" key={field.key}><span>{field.label}</span><strong>{typeof row[field.key] === "boolean" ? (row[field.key] ? "Có" : "Không") : String(row[field.key] ?? "—")}</strong></div>)}</div><div className="modal-actions"><button type="button" className="primary" onClick={onClose}>Đóng</button></div></section></div>;
}

function GalleryModal({ images, initialIndex, onClose }: { images: string[]; initialIndex: number; onClose: () => void }) {
  const [index, setIndex] = useState(initialIndex);
  const previous = () => setIndex(current => (current - 1 + images.length) % images.length);
  const next = () => setIndex(current => (current + 1) % images.length);
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); else if (event.key === "ArrowLeft") previous(); else if (event.key === "ArrowRight") next(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [images.length, onClose]);
  return <div className="gallery-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="gallery-modal"><div className="gallery-head"><div><strong>Ảnh đính kèm</strong><span>{index + 1} / {images.length}</span></div><button type="button" onClick={onClose} aria-label="Đóng">×</button></div><div className="gallery-stage">{images.length > 1 && <button className="gallery-nav previous" type="button" onClick={previous} aria-label="Ảnh trước">‹</button>}<img src={images[index]} alt={`Ảnh đính kèm ${index + 1}`} />{images.length > 1 && <button className="gallery-nav next" type="button" onClick={next} aria-label="Ảnh tiếp theo">›</button>}</div>{images.length > 1 && <div className="gallery-thumbnails">{images.map((image, imageIndex) => <button type="button" className={imageIndex === index ? "active" : ""} key={`${image}-${imageIndex}`} onClick={() => setIndex(imageIndex)}><img src={image} alt={`Xem ảnh ${imageIndex + 1}`} /></button>)}</div>}</section></div>;
}

function ReportWithGsc({ data, settings }: { data: AppData; settings: SiteSettings }) {
  const firstDay = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`;
  const [from, setFrom] = useState(firstDay);
  const [to, setTo] = useState(today());
  const inRange = (value: unknown) => { const date = String(value || ""); return Boolean(date && date >= from && date <= to); };
  const logs = data.worklogs.filter(row => inRange(row.date));
  const tasks = data.tasks.filter(row => row.status === "Done" && inRange(row.completedDate || row.startDate));
  const content = data.content.filter(row => inRange(row.publishDate || row.deadline));
  const audits = data.audits.filter(row => inRange(row.completed || row.found || row.due));
  const indexing = data.indexing.filter(row => inRange(row.checked || row.submitted));
  const backlinks = data.backlinks.filter(row => inRange(row.placed || row.checked));
  const rankings = data.rankings.filter(row => inRange(row.date));
  const clicks = rankings.reduce((sum, row) => sum + Number(row.clicks || 0), 0);
  const impressions = rankings.reduce((sum, row) => sum + Number(row.impressions || 0), 0);
  const ctr = impressions ? clicks / impressions * 100 : 0;
  const avgPosition = rankings.length ? rankings.reduce((sum, row) => sum + Number(row.position || 0), 0) / rankings.length : 0;
  const top3 = rankings.filter(row => Number(row.position) <= 3).length;
  const top10 = rankings.filter(row => Number(row.position) <= 10).length;
  const top20 = rankings.filter(row => Number(row.position) <= 20).length;
  const improved = rankings.filter(row => Number(row.position) < Number(row.previous)).length;
  const hours = logs.reduce((sum, row) => sum + Number(row.hours || 0), 0);
  const topQueries = [...rankings].sort((a, b) => Number(b.clicks || 0) - Number(a.clicks || 0)).slice(0, 10);
  const pageMap = new Map<string, Row>();
  rankings.forEach(row => { const page = String(row.page || ""); const current = pageMap.get(page) || { id: uid("PAGE"), page, clicks: 0, impressions: 0, position: 0, ctr: 0 }; current.clicks = Number(current.clicks) + Number(row.clicks || 0); current.impressions = Number(current.impressions) + Number(row.impressions || 0); current.position = Number(row.position || 0); current.ctr = Number(current.impressions) ? Number(current.clicks) / Number(current.impressions) * 100 : 0; pageMap.set(page, current); });
  const topPages = [...pageMap.values()].sort((a, b) => Number(b.clicks || 0) - Number(a.clicks || 0)).slice(0, 10);
  const metricRows = [["GSC Clicks", clicks.toLocaleString()], ["GSC Impressions", impressions.toLocaleString()], ["GSC CTR", `${ctr.toFixed(2)}%`], ["Vị trí trung bình", avgPosition ? avgPosition.toFixed(1) : "—"], ["Keyword Top 3", top3], ["Keyword Top 10", top10], ["Keyword Top 20", top20], ["Keyword tăng hạng", improved], ["Task hoàn thành", tasks.length], ["Giờ làm việc", `${hours}h`], ["Bài đã đăng", content.filter(row => row.status === "Published").length], ["Audit đã xử lý", audits.filter(row => row.status === "Done").length]];
  const exportReport = () => { const rows = [["Báo cáo SEO", settings.name, from, to], ...metricRows, ["Top keyword", "Page", "Position", "Clicks", "Impressions", "CTR"], ...topQueries.map(row => [row.keyword, row.page, row.position, row.clicks, row.impressions, row.ctr])]; downloadFile(`bao-cao-seo-${from}-${to}.csv`, "\uFEFF" + rows.map(row => row.map(csvEscape).join(",")).join("\n"), "text/csv;charset=utf-8"); };
  return <><section className="page-heading print-hide"><div><p className="eyebrow">PERFORMANCE REPORTING + SEARCH CONSOLE</p><h2>Báo cáo SEO chi tiết</h2><p className="muted">Công việc vận hành và chỉ số Google Search Console trong cùng một khoảng thời gian.</p></div><div className="button-row"><button className="secondary" onClick={exportReport}>Xuất CSV</button><button className="primary" onClick={() => window.print()}>In / Lưu PDF</button></div></section><div className="report-filter panel print-hide"><div><label>Từ ngày<input type="date" value={from} onChange={event => setFrom(event.target.value)} /></label><label>Đến ngày<input type="date" value={to} onChange={event => setTo(event.target.value)} /></label></div><div className="quick-ranges"><button onClick={() => { setFrom(today()); setTo(today()); }}>Hôm nay</button><button onClick={() => { const date = new Date(); date.setDate(date.getDate() - 6); setFrom(date.toISOString().slice(0, 10)); setTo(today()); }}>7 ngày</button><button onClick={() => { setFrom(firstDay); setTo(today()); }}>Tháng này</button></div><span className="range-label">Đang xem: <b>{from}</b> → <b>{to}</b></span></div><div className="report-title"><h2>Báo cáo SEO — {settings.name}</h2><p>{from} → {to} · {settings.domain}</p></div><div className="report-grid">{metricRows.map(([label, value]) => <div className="report-card" key={String(label)}><span>{label}</span><strong>{value}</strong></div>)}</div><section className="report-detail-grid"><div className="panel"><div className="panel-title"><h3>Google Search Console</h3><span className="range-label">{rankings.length} dòng dữ liệu</span></div><div className="gsc-summary"><div><span>Clicks</span><b>{clicks.toLocaleString()}</b></div><div><span>Impressions</span><b>{impressions.toLocaleString()}</b></div><div><span>CTR</span><b>{ctr.toFixed(2)}%</b></div><div><span>Vị trí TB</span><b>{avgPosition ? avgPosition.toFixed(1) : "—"}</b></div></div><h4>Top từ khóa theo clicks</h4><SimpleTable rows={topQueries} columns={["keyword", "page", "position", "clicks", "impressions", "ctr"]} /></div><div className="panel"><div className="panel-title"><h3>Landing page hiệu suất cao</h3><span className="range-label">Xếp theo clicks</span></div><SimpleTable rows={topPages} columns={["page", "clicks", "impressions", "position", "ctr"]} /></div></section><section className="report-detail-grid"><div className="panel"><div className="panel-title"><h3>Nhật ký công việc ({logs.length})</h3><span className="range-label">{hours} giờ</span></div><SimpleTable rows={logs} columns={["date", "taskId", "group", "hours", "result"]} /></div><div className="panel"><div className="panel-title"><h3>Task, content, audit</h3></div><SimpleTable rows={[...tasks.map(row => ({ ...row, recordType: "Task" })), ...content.map(row => ({ ...row, recordType: "Content" })), ...audits.map(row => ({ ...row, recordType: "Audit" }))]} columns={["recordType", "title", "topic", "issue", "status", "startDate", "due"]} /></div></section><section className="report-detail-grid"><div className="panel"><div className="panel-title"><h3>Index tracking</h3></div><SimpleTable rows={indexing} columns={["url", "type", "status", "checked", "next", "priority"]} /></div><div className="panel"><div className="panel-title"><h3>Backlink triển khai</h3></div><SimpleTable rows={backlinks} columns={["domain", "targetUrl", "anchor", "status", "placed", "score"]} /></div></section></>;
}

function DetailedReports({ data, settings }: { data: AppData; settings: SiteSettings }) {
  const firstDay = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`;
  const [from, setFrom] = useState(firstDay);
  const [to, setTo] = useState(today());
  const inRange = (value: unknown) => { const date = String(value || ""); return Boolean(date && date >= from && date <= to); };
  const tasks = data.tasks.filter(row => row.status === "Done" && inRange(row.completedDate || row.startDate));
  const logs = data.worklogs.filter(row => inRange(row.date));
  const content = data.content.filter(row => inRange(row.publishDate || row.deadline));
  const audits = data.audits.filter(row => inRange(row.completed || row.found || row.due));
  const indexRows = data.indexing.filter(row => inRange(row.checked || row.submitted));
  const backlinks = data.backlinks.filter(row => inRange(row.placed || row.checked));
  const rankings = data.rankings.filter(row => inRange(row.date));
  const gscClicks = rankings.reduce((sum, row) => sum + Number(row.clicks || 0), 0);
  const gscImpressions = rankings.reduce((sum, row) => sum + Number(row.impressions || 0), 0);
  const gscCtr = gscImpressions ? gscClicks / gscImpressions * 100 : 0;
  const gscPosition = rankings.length ? rankings.reduce((sum, row) => sum + Number(row.position || 0), 0) / rankings.length : 0;
  const top3 = rankings.filter(row => Number(row.position) <= 3).length;
  const top10 = rankings.filter(row => Number(row.position) <= 10).length;
  const top20 = rankings.filter(row => Number(row.position) <= 20).length;
  const improved = rankings.filter(row => Number(row.position) < Number(row.previous)).length;
  const topQueries = [...rankings].sort((a, b) => Number(b.clicks || 0) - Number(a.clicks || 0)).slice(0, 10);
  const pageMap = new Map<string, Row>();
  rankings.forEach(row => { const key = String(row.page || ""); const current = pageMap.get(key) || { id: uid("PAGE"), page: key, clicks: 0, impressions: 0, position: 0, ctr: 0 }; current.clicks = Number(current.clicks || 0) + Number(row.clicks || 0); current.impressions = Number(current.impressions || 0) + Number(row.impressions || 0); current.position = Number(row.position || 0); current.ctr = Number(current.impressions) ? Number(current.clicks) / Number(current.impressions) * 100 : 0; pageMap.set(key, current); });
  const topPages = [...pageMap.values()].sort((a, b) => Number(b.clicks || 0) - Number(a.clicks || 0)).slice(0, 10);
  const hours = logs.reduce((sum, row) => sum + Number(row.hours || 0), 0);
  const estimated = tasks.reduce((sum, row) => sum + Number(row.estimated || 0), 0);
  const actual = tasks.reduce((sum, row) => sum + Number(row.actual || 0), 0) + hours;
  const withCompletionDate = tasks.filter(row => row.completedDate).length;
  const taskCountInRange = data.tasks.filter(row => inRange(row.completedDate || row.startDate)).length;
  const completion = taskCountInRange ? Math.round(tasks.length / taskCountInRange * 100) : 0;
  const metrics = [
    ["Đầu việc hoàn thành", tasks.length], ["Giờ đã làm", `${hours}h`], ["Bài đã đăng", content.filter(row => row.status === "Published").length], ["Audit đã xử lý", audits.filter(row => row.status === "Done").length],
    ["Tỷ lệ hoàn thành", `${completion}%`], ["Có ngày hoàn thành", `${withCompletionDate}/${tasks.length}`], ["URL đã kiểm tra", indexRows.length], ["Backlink triển khai", backlinks.length],
    ["GSC Clicks", gscClicks.toLocaleString()], ["GSC Impressions", gscImpressions.toLocaleString()], ["GSC CTR", `${gscCtr.toFixed(2)}%`], ["Vị trí trung bình", gscPosition ? gscPosition.toFixed(1) : "—"],
    ["Keyword Top 3", top3], ["Keyword Top 10", top10], ["Keyword Top 20", top20], ["Keyword tăng hạng", improved],
  ];
  const exportReport = () => {
    const sections = [
      ["BÁO CÁO SEO", settings.name, `${from} đến ${to}`],
      ["CHỈ SỐ", ...metrics.flatMap(([label, value]) => [label, value])],
      ["NHẬT KÝ CÔNG VIỆC", "Ngày", "Task", "Nhóm", "Số giờ", "Kết quả"],
      ...logs.map(row => [row.date, row.taskId, row.group, row.hours, row.result]),
      ["TASK HOÀN THÀNH", "Tên task", "Nhóm", "Ngày bắt đầu", "Ngày hoàn thành", "Giờ thực tế", "Kết quả"],
      ...tasks.map(row => [row.title, row.group, row.startDate, row.completedDate, row.actual, row.result]),
    ];
    downloadFile(`bao-cao-seo-${from}-${to}.csv`, "\uFEFF" + sections.map(row => row.map(csvEscape).join(",")).join("\n"), "text/csv;charset=utf-8");
  };
  return <><section className="page-heading print-hide"><div><p className="eyebrow">PERFORMANCE REPORTING</p><h2>Báo cáo theo thời gian</h2><p className="muted">Lọc và xuất chi tiết công việc, thời gian và số liệu trong khoảng mày chọn.</p></div><div className="button-row"><button className="secondary" onClick={exportReport}>Xuất báo cáo CSV</button><button className="primary" onClick={() => window.print()}>In / Lưu PDF</button></div></section><div className="report-filter panel print-hide"><div><label>Từ ngày<input type="date" value={from} onChange={event => setFrom(event.target.value)} /></label><label>Đến ngày<input type="date" value={to} onChange={event => setTo(event.target.value)} /></label></div><div className="quick-ranges"><button onClick={() => { setFrom(today()); setTo(today()); }}>Hôm nay</button><button onClick={() => { const date = new Date(); date.setDate(date.getDate() - 6); setFrom(date.toISOString().slice(0, 10)); setTo(today()); }}>7 ngày</button><button onClick={() => { setFrom(firstDay); setTo(today()); }}>Tháng này</button></div><span className="range-label">Đang xem: <b>{from}</b> → <b>{to}</b></span></div><div className="report-title"><h2>Báo cáo SEO — {settings.name}</h2><p>{from} → {to} · {settings.domain}</p></div><div className="report-grid">{metrics.map(([label, value]) => <div className="report-card" key={String(label)}><span>{label}</span><strong>{value}</strong></div>)}</div><section className="report-detail-grid"><div className="panel"><div className="panel-title"><h3>Nhật ký đã thực hiện ({logs.length})</h3><span className="range-label">{hours} giờ</span></div><SimpleTable rows={logs} columns={["date", "taskId", "group", "hours", "result"]} /></div><div className="panel"><div className="panel-title"><h3>Task hoàn thành ({tasks.length})</h3><span className="range-label">{actual} giờ thực tế</span></div><SimpleTable rows={tasks} columns={["title", "group", "completedDate", "actual", "result"]} /></div></section><section className="report-detail-grid"><div className="panel"><div className="panel-title"><h3>Nội dung và audit</h3></div><SimpleTable rows={[...content.map(row => ({ ...row, recordType: "Content" })), ...audits.map(row => ({ ...row, recordType: "Audit" }))]} columns={["recordType", "topic", "issue", "status", "publishDate", "completed"]} /></div><div className="panel"><div className="panel-title"><h3>Index và off-page</h3></div><SimpleTable rows={[...indexRows.map(row => ({ ...row, recordType: "Index" })), ...backlinks.map(row => ({ ...row, recordType: "Backlink" }))]} columns={["recordType", "url", "domain", "status", "checked", "placed"]} /></div></section></>;
}

function Reports({ data, settings }: { data: AppData; settings: SiteSettings }) {
  const done = data.tasks.filter(row => row.status === "Done").length;
  const completion = data.tasks.length ? Math.round(done / data.tasks.length * 100) : 0;
  const withCompletionDate = data.tasks.filter(row => row.status === "Done" && row.completedDate).length;
  const clicks = data.rankings.reduce((sum, row) => sum + Number(row.clicks || 0), 0);
  const impressions = data.rankings.reduce((sum, row) => sum + Number(row.impressions || 0), 0);
  const stats = [
    ["Bài đã đăng", data.content.filter(row => row.status === "Published").length], ["Task hoàn thành", done], ["Tỷ lệ hoàn thành", `${completion}%`], ["Có ngày hoàn thành", `${withCompletionDate}/${done}`],
    ["URL đã audit", data.audits.length], ["Lỗi đã xử lý", data.audits.filter(row => row.status === "Done").length], ["Backlink live", data.backlinks.filter(row => row.status === "Live").length], ["Entity đã tạo", data.entities.length],
    ["URL đã index", data.indexing.filter(row => row.status === "Indexed").length], ["Giờ làm việc", `${data.worklogs.reduce((sum, row) => sum + Number(row.hours || 0), 0)}h`], ["Organic clicks", clicks], ["Impressions", impressions.toLocaleString()],
  ];
  const exportSummary = () => downloadFile(`bao-cao-seo-${today()}.csv`, "\uFEFF" + stats.map(row => row.map(csvEscape).join(",")).join("\n"), "text/csv;charset=utf-8");
  return <><section className="page-heading print-hide"><div><p className="eyebrow">PERFORMANCE REPORTING</p><h2>Báo cáo KPI</h2><p className="muted">Tổng hợp dữ liệu vận hành và hiệu suất SEO.</p></div><div className="button-row"><button className="secondary" onClick={exportSummary}>Xuất CSV</button><button className="primary" onClick={() => window.print()}>In / Lưu PDF</button></div></section><div className="report-title"><h2>Báo cáo SEO — {settings.name}</h2><p>{today()} · {settings.domain}</p></div><div className="report-grid">{stats.map(([label, value]) => <div className="report-card" key={String(label)}><span>{label}</span><strong>{value}</strong></div>)}</div><div className="panel"><h3>Nhận định tự động</h3><p className="report-copy">Tỷ lệ hoàn thành công việc hiện ở mức {completion}%. Có {data.indexing.filter(row => row.status !== "Indexed").length} URL chưa index và {data.audits.filter(row => ["High", "Critical"].includes(String(row.severity)) && row.status !== "Done").length} lỗi ưu tiên cao cần xử lý. Tổng dữ liệu Search Performance ghi nhận {clicks.toLocaleString()} clicks trên {impressions.toLocaleString()} impressions.</p></div></>;
}

function Settings({ data, setData, settings, setSettings, notify, requestConfirm }: { data: AppData; setData: (data: AppData) => void; settings: SiteSettings; setSettings: (settings: SiteSettings) => void; notify: (message: string) => void; requestConfirm: (config: ConfirmConfig) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const backup = () => downloadFile(`seo-backup-${today()}.json`, JSON.stringify({ version: 2, settings, data }, null, 2), "application/json");
  const restore = async (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; try { const parsed = JSON.parse(await file.text()); setData({ ...seedData, ...parsed.data }); if (parsed.settings) setSettings({ ...defaultSettings, ...parsed.settings }); notify("Khôi phục dữ liệu thành công"); } catch { notify("File backup không hợp lệ"); } event.target.value = ""; };
  const reset = () => requestConfirm({ eyebrow: "KHÔI PHỤC DỮ LIỆU", title: "Khôi phục workspace ban đầu?", description: "Toàn bộ dữ liệu hiện tại sẽ được thay bằng dữ liệu mẫu. Hãy tải file backup trước nếu cần giữ lại thông tin.", confirmLabel: "Khôi phục dữ liệu", danger: true, onConfirm: () => { setData(seedData); setSettings(defaultSettings); notify("Đã khôi phục workspace ban đầu"); } });
  const askNotification = async () => { if (!("Notification" in window)) return notify("Trình duyệt không hỗ trợ thông báo"); const result = await Notification.requestPermission(); notify(result === "granted" ? "Đã bật thông báo" : "Chưa được cấp quyền thông báo"); };
  return <><section className="page-heading"><div><p className="eyebrow">WORKSPACE CONFIGURATION</p><h2>Cài đặt & dữ liệu</h2><p className="muted">Quản lý thông tin website, thông báo và sao lưu dữ liệu.</p></div></section><div className="settings-grid"><div className="panel settings-form"><h3>Thông tin website</h3>{(["name", "domain", "owner", "email", "timezone"] as const).map(key => <label key={key}><span>{{ name: "Tên website", domain: "Domain", owner: "Người phụ trách", email: "Email báo cáo", timezone: "Múi giờ" }[key]}</span><input value={settings[key]} onChange={event => setSettings({ ...settings, [key]: event.target.value })} /></label>)}<p className="save-note">Mọi thay đổi được tự động lưu.</p></div><div className="panel"><h3>Tiện ích dữ liệu</h3><div className="settings-actions"><button className="secondary" onClick={backup}>Tải file backup JSON</button><button className="secondary" onClick={() => fileRef.current?.click()}>Khôi phục từ backup</button><input ref={fileRef} hidden type="file" accept=".json" onChange={restore} /><button className="secondary" onClick={askNotification}>Bật thông báo trình duyệt</button><button className="danger-button" onClick={reset}>Khôi phục dữ liệu ban đầu</button></div><div className="storage-status"><span>●</span><div><b>Local Workspace</b><small>{Object.values(data).reduce((sum, rows) => sum + rows.length, 0)} bản ghi · tự động lưu · có backup/restore</small></div></div><p className="integration-note">Khi cấu hình Supabase, dữ liệu có thể đồng bộ nhiều thiết bị và phân quyền người dùng. Bản local hiện tại vẫn dùng đầy đủ trên một trình duyệt.</p></div></div></>;
}
