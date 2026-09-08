import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "E:/SEO/air seagolbal/outputs/seo-plan";
const workbook = Workbook.create();

const colors = {
  navy: "#1F4E78",
  blue: "#D9EAF7",
  lightBlue: "#EAF3F8",
  green: "#E2F0D9",
  yellow: "#FFF2CC",
  red: "#FCE4D6",
  gray: "#F2F2F2",
  border: "#D9E2F3",
  white: "#FFFFFF",
  text: "#1F1F1F",
};

const sheets = {};
for (const name of ["Tổng quan", "Checklist", "Keyword", "Content plan", "Technical", "Backlink", "KPI", "Timeline"]) {
  sheets[name] = workbook.worksheets.add(name);
  sheets[name].showGridLines = false;
  sheets[name].tabColor = name === "Tổng quan" ? colors.navy : colors.blue;
}

function title(sheet, text, subtitle = "") {
  sheet.getRange("A1").values = [[text]];
  sheet.getRange("A1:H1").format = { font: { name: "Arial", size: 16, bold: true, color: colors.navy } };
  sheet.getRange("A2").values = [[subtitle]];
  sheet.getRange("A2:H2").format = { font: { name: "Arial", size: 10, italic: true, color: "#666666" } };
}

function section(sheet, cell, text, endCol = "H") {
  sheet.getRange(`${cell}:${endCol}${cell.match(/\d+/)[0]}`).values = [[text]];
  sheet.getRange(`${cell}:${endCol}${cell.match(/\d+/)[0]}`).format = {
    fill: colors.navy,
    font: { name: "Arial", size: 10, bold: true, color: colors.white },
    verticalAlignment: "center",
  };
}

function header(sheet, range) {
  sheet.getRange(range).format = {
    fill: colors.navy,
    font: { name: "Arial", size: 10, bold: true, color: colors.white },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    wrapText: true,
    borders: { preset: "all", style: "thin", color: colors.white },
  };
}

function body(sheet, range) {
  sheet.getRange(range).format = {
    font: { name: "Arial", size: 10, color: colors.text },
    verticalAlignment: "center",
    wrapText: true,
    borders: { preset: "inside", style: "thin", color: colors.border },
  };
}

function widths(sheet, entries) {
  for (const [col, width] of Object.entries(entries)) sheet.getRange(`${col}:${col}`).format.columnWidth = width;
}

// Tổng quan
{
  const s = sheets["Tổng quan"];
  title(s, "KẾ HOẠCH SEO TỔNG THỂ", "Mẫu workbook tham khảo để lập kế hoạch, phân công và theo dõi dự án SEO");
  section(s, "A4", "THÔNG TIN DỰ ÁN", "D");
  s.getRange("A5:B11").values = [
    ["Tên dự án", ""], ["Website", ""], ["Sản phẩm/dịch vụ", ""], ["Thị trường", ""],
    ["Người phụ trách", ""], ["Ngày bắt đầu", ""], ["Thời gian dự kiến", ""],
  ];
  s.getRange("A5:A11").format = { fill: colors.gray, font: { name: "Arial", size: 10, bold: true, color: colors.text } };
  s.getRange("B5:B11").format = { fill: colors.yellow, font: { name: "Arial", size: 10, color: colors.text } };
  s.getRange("B10").setNumberFormat("yyyy-mm-dd");
  section(s, "A14", "KPI TỔNG QUAN", "D");
  s.getRange("A15:D15").values = [["Chỉ số", "Hiện tại", "Mục tiêu", "Tự động cập nhật"]];
  header(s, "A15:D15");
  s.getRange("A16:C20").values = [
    ["Tổng số công việc", 0, ""],
    ["Công việc hoàn thành", 0, ""],
    ["Tỷ lệ hoàn thành", 0, ""],
    ["Nội dung cần triển khai", 0, ""],
    ["Từ khóa đang theo dõi", 0, ""],
  ];
  s.getRange("D16:D20").formulas = [["=COUNTA(Checklist!$A$6:$A$45)"], ["=COUNTIF(Checklist!$G$6:$G$45,\"Đã hoàn thành\")"], ["=IFERROR(D17/D16,0)"], ["=COUNTA('Content plan'!$A$6:$A$35)"], ["=COUNTA(Keyword!$A$6:$A$35)"]];
  s.getRange("A16:C20").format = { font: { name: "Arial", size: 10, color: colors.text }, borders: { preset: "inside", style: "thin", color: colors.border } };
  s.getRange("D16:D20").format = { fill: colors.lightBlue, font: { name: "Arial", size: 10, bold: true, color: colors.navy }, horizontalAlignment: "right" };
  s.getRange("D18").setNumberFormat("0.0%");
  section(s, "F4", "HƯỚNG DẪN SỬ DỤNG", "H");
  s.getRange("F5:H10").values = [
    ["1", "Điền thông tin dự án ở sheet Tổng quan", ""],
    ["2", "Cập nhật trạng thái công việc ở sheet Checklist", ""],
    ["3", "Nhập bộ từ khóa và URL mục tiêu ở sheet Keyword", ""],
    ["4", "Lập lịch sản xuất nội dung ở sheet Content plan", ""],
    ["5", "Ghi nhận lỗi kỹ thuật và backlink cần xử lý", ""],
    ["6", "Cập nhật KPI theo tháng để đánh giá kết quả", ""],
  ];
  s.getRange("F5:F10").format = { fill: colors.blue, font: { name: "Arial", size: 10, bold: true, color: colors.navy }, horizontalAlignment: "center" };
  s.getRange("G5:H10").format = { font: { name: "Arial", size: 10, color: colors.text }, wrapText: true };
  widths(s, { A: 25, B: 22, C: 18, D: 18, E: 3, F: 8, G: 42, H: 8 });
}

// Checklist
{
  const s = sheets["Checklist"];
  title(s, "CHECKLIST TRIỂN KHAI SEO", "Theo dõi toàn bộ đầu việc, người phụ trách, deadline và trạng thái");
  s.getRange("A4:J4").values = [["STT", "Nhóm việc", "Công việc", "Kết quả cần đạt", "Người phụ trách", "Ưu tiên", "Trạng thái", "Ngày bắt đầu", "Deadline", "Ghi chú"]];
  header(s, "A4:J4");
  const rows = [
    [1,"Khởi động","Xác định mục tiêu SEO và KPI","Có mục tiêu traffic, leads, doanh thu","","P0","Chưa làm","","", ""],
    [2,"Khởi động","Phân tích khách hàng mục tiêu","Có chân dung và search journey","","P1","Chưa làm","","", ""],
    [3,"Audit","Audit crawl và index","Danh sách lỗi index/crawl","","P0","Chưa làm","","", ""],
    [4,"Audit","Kiểm tra robots.txt và sitemap.xml","Cấu hình hợp lệ","","P0","Chưa làm","","", ""],
    [5,"Audit","Kiểm tra canonical, redirect, 404","Không còn lỗi nghiêm trọng","","P0","Chưa làm","","", ""],
    [6,"Audit","Kiểm tra Core Web Vitals","Có báo cáo và việc cần sửa","","P1","Chưa làm","","", ""],
    [7,"Đối thủ","Phân tích đối thủ SEO","Danh sách đối thủ và cơ hội","","P1","Chưa làm","","", ""],
    [8,"Keyword","Nghiên cứu từ khóa","Bộ từ khóa đã phân nhóm","","P0","Chưa làm","","", ""],
    [9,"Keyword","Mapping từ khóa vào URL","Mỗi nhóm từ khóa có URL đích","","P0","Chưa làm","","", ""],
    [10,"Structure","Xây dựng topic cluster","Có pillar page và cluster","","P1","Chưa làm","","", ""],
    [11,"Technical","Tối ưu tốc độ website","Tốc độ đạt mục tiêu","","P1","Chưa làm","","", ""],
    [12,"Technical","Tối ưu mobile-first","Hiển thị tốt trên mobile","","P1","Chưa làm","","", ""],
    [13,"On-page","Tối ưu title và meta description","Tăng CTR tại SERP","","P1","Chưa làm","","", ""],
    [14,"On-page","Tối ưu heading và nội dung","Đúng search intent","","P1","Chưa làm","","", ""],
    [15,"On-page","Tối ưu internal link","Có liên kết theo cụm chủ đề","","P1","Chưa làm","","", ""],
    [16,"Content","Lập content calendar","Có lịch sản xuất theo tháng","","P0","Chưa làm","","", ""],
    [17,"Content","Viết bài pillar page","Hoàn thiện nội dung trụ cột","","P1","Chưa làm","","", ""],
    [18,"Content","Viết bài cluster","Phủ đủ chủ đề hỗ trợ","","P1","Chưa làm","","", ""],
    [19,"Content","Tối ưu nội dung cũ","Cải thiện ranking/traffic","","P1","Chưa làm","","", ""],
    [20,"Schema","Triển khai structured data","Schema hợp lệ","","P2","Chưa làm","","", ""],
    [21,"Local","Tối ưu Google Business Profile","Tăng hiển thị local","","P2","Chưa làm","","", ""],
    [22,"Off-page","Audit backlink hiện tại","Có danh sách backlink cần xử lý","","P1","Chưa làm","","", ""],
    [23,"Off-page","Xây dựng backlink liên quan","Tăng referring domains chất lượng","","P2","Chưa làm","","", ""],
    [24,"Entity","Xây dựng đề cập thương hiệu","Tăng độ tin cậy thương hiệu","","P2","Chưa làm","","", ""],
    [25,"Tracking","Thiết lập GA4 và GSC","Đo lường đầy đủ","","P0","Chưa làm","","", ""],
    [26,"Tracking","Thiết lập conversion tracking","Theo dõi lead/đơn hàng","","P0","Chưa làm","","", ""],
    [27,"Reporting","Tạo dashboard báo cáo","Có báo cáo tuần/tháng","","P1","Chưa làm","","", ""],
    [28,"Review","Đánh giá KPI hàng tháng","Có hành động cải tiến","","P1","Chưa làm","","", ""],
  ];
  s.getRange("A5:J32").values = rows;
  body(s, "A5:J32");
  s.getRange("A5:A32").format.horizontalAlignment = "center";
  s.getRange("F5:G32").dataValidation = { rule: { type: "list", values: ["P0", "P1", "P2", "P3"] } };
  s.getRange("G5:G32").dataValidation = { rule: { type: "list", values: ["Chưa làm", "Đang làm", "Chờ duyệt", "Đã hoàn thành", "Cần tối ưu lại"] } };
  s.getRange("H5:I32").setNumberFormat("yyyy-mm-dd");
  s.getRange("G5:G32").conditionalFormats.add("containsText", { text: "Đã hoàn thành", format: { fill: colors.green, font: { color: "#375623", bold: true } } });
  s.getRange("F5:F32").conditionalFormats.add("containsText", { text: "P0", format: { fill: colors.red, font: { color: "#9C0006", bold: true } } });
  s.freezePanes.freezeRows(4);
  widths(s, { A: 7, B: 15, C: 42, D: 34, E: 18, F: 10, G: 18, H: 14, I: 14, J: 24 });
}

// Keyword
{
  const s = sheets["Keyword"];
  title(s, "KEYWORD PLAN", "Quản lý từ khóa, search intent, URL mục tiêu và tiến độ ranking");
  s.getRange("A4:K4").values = [["STT","Từ khóa","Nhóm chủ đề","Search intent","Volume/tháng","Độ khó","URL mục tiêu","Ranking hiện tại","Ranking mục tiêu","Ưu tiên","Trạng thái"]];
  header(s, "A4:K4");
  const rows = [
    [1,"seo tổng thể","SEO tổng thể","Informational",0,0,"","","","P0","Chưa nghiên cứu"],
    [2,"dịch vụ seo","Dịch vụ SEO","Commercial",0,0,"","","","P0","Chưa nghiên cứu"],
    [3,"công ty seo uy tín","Dịch vụ SEO","Commercial",0,0,"","","","P1","Chưa nghiên cứu"],
    [4,"checklist seo website","SEO kỹ thuật","Informational",0,0,"","","","P1","Chưa nghiên cứu"],
    [5,"audit seo website","SEO kỹ thuật","Commercial",0,0,"","","","P1","Chưa nghiên cứu"],
    [6,"tối ưu website chuẩn seo","SEO On-page","Informational",0,0,"","","","P2","Chưa nghiên cứu"],
    [7,"content plan seo","Content SEO","Informational",0,0,"","","","P1","Chưa nghiên cứu"],
    [8,"nghiên cứu từ khóa seo","Keyword research","Informational",0,0,"","","","P1","Chưa nghiên cứu"],
  ];
  s.getRange("A5:K12").values = rows;
  body(s, "A5:K12");
  s.getRange("J5:J50").dataValidation = { rule: { type: "list", values: ["P0", "P1", "P2", "P3"] } };
  s.getRange("K5:K50").dataValidation = { rule: { type: "list", values: ["Chưa nghiên cứu", "Đang theo dõi", "Đang tối ưu", "Đạt mục tiêu"] } };
  s.getRange("E5:F50").setNumberFormat("#,##0");
  s.getRange("H5:I50").setNumberFormat("0");
  s.freezePanes.freezeRows(4);
  widths(s, { A: 7, B: 28, C: 20, D: 18, E: 14, F: 12, G: 42, H: 15, I: 15, J: 10, K: 18 });
}

// Content plan
{
  const s = sheets["Content plan"];
  title(s, "CONTENT PLAN", "Lập kế hoạch sản xuất và cập nhật nội dung SEO");
  s.getRange("A4:L4").values = [["STT","Chủ đề/Bài viết","Từ khóa chính","Search intent","Loại nội dung","URL dự kiến","Người viết","Ngày brief","Deadline","Trạng thái","Ưu tiên","Ghi chú"]];
  header(s, "A4:L4");
  const rows = [
    [1,"Trang dịch vụ SEO tổng thể","dịch vụ seo","Commercial","Landing page","","","","","Chưa làm","P0",""],
    [2,"Hướng dẫn lập kế hoạch SEO tổng thể","kế hoạch seo tổng thể","Informational","Pillar page","","","","","Chưa làm","P1",""],
    [3,"Checklist audit SEO website","audit seo website","Informational","Blog","","","","","Chưa làm","P1",""],
    [4,"Nghiên cứu từ khóa SEO từ A-Z","nghiên cứu từ khóa seo","Informational","Cluster article","","","","","Chưa làm","P1",""],
    [5,"SEO kỹ thuật là gì?","seo kỹ thuật","Informational","Cluster article","","","","","Chưa làm","P2",""],
    [6,"Cách tối ưu content chuẩn SEO","content chuẩn seo","Informational","Cluster article","","","","","Chưa làm","P2",""],
    [7,"Case study kết quả SEO","case study seo","Commercial","Case study","","","","","Chưa làm","P2",""],
  ];
  s.getRange("A5:L11").values = rows;
  body(s, "A5:L11");
  s.getRange("J5:J50").dataValidation = { rule: { type: "list", values: ["Chưa làm", "Đang viết", "Chờ duyệt", "Đã xuất bản", "Cần cập nhật"] } };
  s.getRange("K5:K50").dataValidation = { rule: { type: "list", values: ["P0", "P1", "P2", "P3"] } };
  s.getRange("H5:I50").setNumberFormat("yyyy-mm-dd");
  s.getRange("J5:J50").conditionalFormats.add("containsText", { text: "Đã xuất bản", format: { fill: colors.green, font: { color: "#375623", bold: true } } });
  s.freezePanes.freezeRows(4);
  widths(s, { A: 7, B: 36, C: 28, D: 18, E: 18, F: 40, G: 16, H: 14, I: 14, J: 18, K: 10, L: 24 });
}

// Technical
{
  const s = sheets["Technical"];
  title(s, "TECHNICAL SEO AUDIT", "Ghi nhận vấn đề kỹ thuật, mức độ ảnh hưởng và hướng xử lý");
  s.getRange("A4:J4").values = [["STT","Hạng mục","URL/Phạm vi","Vấn đề phát hiện","Mức độ","Đề xuất xử lý","Người phụ trách","Deadline","Trạng thái","Ghi chú"]];
  header(s, "A4:J4");
  const items = ["Crawl & index","Robots.txt","Sitemap.xml","Canonical","Redirect/404","Core Web Vitals","Mobile usability","Structured data","Internal link","Image SEO","JavaScript rendering","HTTPS/security"];
  s.getRange("A5:J16").values = items.map((x, i) => [i+1, x, "", "", i < 5 ? "P0" : "P1", "", "", "", "Chưa kiểm tra", ""]);
  body(s, "A5:J16");
  s.getRange("E5:E50").dataValidation = { rule: { type: "list", values: ["P0", "P1", "P2", "P3"] } };
  s.getRange("I5:I50").dataValidation = { rule: { type: "list", values: ["Chưa kiểm tra", "Đang xử lý", "Đã xử lý", "Không áp dụng"] } };
  s.getRange("H5:H50").setNumberFormat("yyyy-mm-dd");
  s.getRange("E5:E50").conditionalFormats.add("containsText", { text: "P0", format: { fill: colors.red, font: { color: "#9C0006", bold: true } } });
  s.freezePanes.freezeRows(4);
  widths(s, { A: 7, B: 22, C: 36, D: 34, E: 10, F: 40, G: 18, H: 14, I: 18, J: 24 });
}

// Backlink
{
  const s = sheets["Backlink"];
  title(s, "BACKLINK & ENTITY PLAN", "Theo dõi cơ hội backlink, digital PR và đề cập thương hiệu");
  s.getRange("A4:J4").values = [["STT","Website mục tiêu","Chủ đề/ngành","Loại cơ hội","DR/Authority","URL cần link","Anchor dự kiến","Trạng thái","Deadline","Ghi chú"]];
  header(s, "A4:J4");
  s.getRange("A5:J12").values = [
    [1,"","Website chuyên ngành","Guest post",0,"","","Chưa liên hệ","",""],
    [2,"","Báo chí/PR","Digital PR",0,"","","Chưa liên hệ","",""],
    [3,"","Đối tác/nhà cung cấp","Partner link",0,"","","Chưa liên hệ","",""],
    [4,"","Danh bạ địa phương","Local citation",0,"","","Chưa liên hệ","",""],
    [5,"","Cộng đồng chuyên môn","Community mention",0,"","","Chưa liên hệ","",""],
    [6,"","Review thương hiệu","Brand mention",0,"","","Chưa liên hệ","",""],
    [7,"","Tài nguyên hữu ích","Resource link",0,"","","Chưa liên hệ","",""],
    [8,"","Website liên quan","Broken link building",0,"","","Chưa liên hệ","",""],
  ];
  body(s, "A5:J12");
  s.getRange("H5:H50").dataValidation = { rule: { type: "list", values: ["Chưa liên hệ", "Đã liên hệ", "Đang trao đổi", "Đã có link", "Từ chối"] } };
  s.getRange("E5:E50").setNumberFormat("0");
  s.getRange("I5:I50").setNumberFormat("yyyy-mm-dd");
  s.freezePanes.freezeRows(4);
  widths(s, { A: 7, B: 30, C: 24, D: 22, E: 14, F: 40, G: 24, H: 18, I: 14, J: 24 });
}

// KPI
{
  const s = sheets["KPI"];
  title(s, "SEO KPI TRACKER", "Cập nhật định kỳ để đánh giá tiến độ và hiệu quả SEO");
  s.getRange("A4:H4").values = [["Chỉ số","Đơn vị","Baseline","Tháng 1","Tháng 2","Tháng 3","Tháng 4","Mục tiêu"]];
  header(s, "A4:H4");
  s.getRange("A5:H13").values = [
    ["Organic sessions","sessions",0,0,0,0,0,0],
    ["Organic users","users",0,0,0,0,0,0],
    ["Từ khóa Top 3","keywords",0,0,0,0,0,0],
    ["Từ khóa Top 10","keywords",0,0,0,0,0,0],
    ["Impressions","impressions",0,0,0,0,0,0],
    ["CTR","%",0,0,0,0,0,0],
    ["Leads từ organic","leads",0,0,0,0,0,0],
    ["Tỷ lệ chuyển đổi","%",0,0,0,0,0,0],
    ["Doanh thu từ SEO","VND",0,0,0,0,0,0],
  ];
  body(s, "A5:H13");
  s.getRange("C5:H13").setNumberFormat("#,##0");
  s.getRange("C10:H10").setNumberFormat("0.0%");
  s.getRange("C12:H12").setNumberFormat("0.0%");
  s.getRange("C13:H13").setNumberFormat("#,##0");
  s.getRange("C5:G13").format.fill = colors.yellow;
  s.getRange("H5:H13").format.fill = colors.blue;
  widths(s, { A: 26, B: 14, C: 14, D: 14, E: 14, F: 14, G: 14, H: 14 });
}

// Timeline
{
  const s = sheets["Timeline"];
  title(s, "SEO TIMELINE", "Kế hoạch triển khai theo giai đoạn và mốc bàn giao");
  s.getRange("A4:I4").values = [["Giai đoạn","Thời gian","Mục tiêu","Công việc chính","Deliverable","Người phụ trách","Bắt đầu","Kết thúc","Trạng thái"]];
  header(s, "A4:I4");
  s.getRange("A5:I8").values = [
    ["Nền tảng","Tháng 1","Có baseline và danh sách ưu tiên","Audit, keyword research, đối thủ, tracking","Audit report + keyword map","","","","Chưa làm"],
    ["Tăng trưởng","Tháng 2–3","Tăng độ phủ từ khóa","Content, on-page, internal link","Content cluster + landing pages","","","","Chưa làm"],
    ["Mở rộng","Tháng 4–6","Tăng traffic và leads","Mở rộng topic, backlink, tối ưu CTR","Báo cáo tăng trưởng","","","","Chưa làm"],
    ["Duy trì","Sau tháng 6","Duy trì và cải thiện","Audit định kỳ, cập nhật content, CRO","Báo cáo tháng + backlog mới","","","","Chưa làm"],
  ];
  body(s, "A5:I8");
  s.getRange("I5:I20").dataValidation = { rule: { type: "list", values: ["Chưa làm", "Đang làm", "Đã hoàn thành", "Tạm dừng"] } };
  s.getRange("G5:H20").setNumberFormat("yyyy-mm-dd");
  s.getRange("I5:I20").conditionalFormats.add("containsText", { text: "Đã hoàn thành", format: { fill: colors.green, font: { color: "#375623", bold: true } } });
  widths(s, { A: 16, B: 16, C: 28, D: 44, E: 34, F: 18, G: 14, H: 14, I: 18 });
}

// Global formatting and workbook finalization
for (const s of Object.values(sheets)) {
  const used = s.getUsedRange();
  if (used) used.format.verticalAlignment = "center";
}

workbook.recalculate();

const checks = [
  await workbook.inspect({ kind: "table", range: "Tổng quan!A1:H20", include: "values,formulas", tableMaxRows: 20, tableMaxCols: 8 }),
  await workbook.inspect({ kind: "table", range: "Checklist!A1:J12", include: "values,formulas", tableMaxRows: 12, tableMaxCols: 10 }),
  await workbook.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!", options: { useRegex: true, maxResults: 100 }, summary: "final formula error scan" }),
];
for (const check of checks) console.log(check.ndjson);

await fs.mkdir(outputDir, { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(`${outputDir}/SEO-TONG-THE-PLAN.xlsx`);

for (const name of Object.keys(sheets)) {
  const preview = await workbook.render({ sheetName: name, autoCrop: "all", scale: 1, format: "png" });
  const bytes = new Uint8Array(await preview.arrayBuffer());
  await fs.writeFile(`${outputDir}/${name.replaceAll(" ", "-")}.png`, bytes);
}

console.log(`Saved ${outputDir}/SEO-TONG-THE-PLAN.xlsx`);
